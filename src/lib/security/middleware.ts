import { NextRequest, NextResponse } from 'next/server'
import { z, ZodSchema } from 'zod'
import { requireAuth } from '@/lib/auth/authenticate'
import { enforceRateLimitOr429, rateLimitKeyByIp } from '@/lib/security/rateLimit'
import { startRouteSpan, endRouteSpan, getRequestContext, generateCorrelationId, logSecurityEvent } from '@/lib/security/logging'
import { applySecurityHeaders } from '@/lib/security/headers'

type LimitPreset = 'upload' | 'comment' | 'like' | 'profile' | 'generic'

export interface SecureConfig<T> {
  routeName: string
  requireAuth?: boolean
  rateLimitPreset?: LimitPreset
  schema?: ZodSchema<T>
}

export interface SecurityErrorResponse {
  error: string
  code: string
  details?: string
  correlationId: string
  timestamp: string
  retryAfter?: number
}

export function securityError(status: number, code: string, message: string, retryAfter?: number) {
  const payload: SecurityErrorResponse = {
    error: message,
    code,
    correlationId: generateCorrelationId(),
    timestamp: new Date().toISOString(),
    retryAfter,
  }
  const resp = NextResponse.json(payload, { status })
  // Use per-request nonce forwarded by global middleware if available
  const nonce = typeof (globalThis as any).Headers === 'function' ? undefined : undefined
  return applySecurityHeaders ? applySecurityHeaders(resp, { nonce }) : resp
}

export function secureRoute<TBody, TContext = any>(
  config: SecureConfig<TBody>,
  handler: (args: {
    request: NextRequest
    user?: { uid: string; email?: string }
    body?: TBody
    securityCorrelationId: string
  }, routeContext?: TContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, routeContext?: TContext): Promise<NextResponse> => {
    const span = startRouteSpan(config.routeName, request)
    const cid = span.correlationId
    try {
      // Rate limit (IP-based by default)
      if (config.rateLimitPreset) {
        const rl = await enforceRateLimitOr429(request, config.rateLimitPreset, rateLimitKeyByIp(request, config.rateLimitPreset))
        if (!('allowed' in rl) || rl.allowed !== true) {
          await endRouteSpan(span, 429)
          return rl.response
        }
      }

      // Auth
      let user: { uid: string; email?: string } | undefined
      if (config.requireAuth) {
        const auth = await requireAuth(request)
        if (auth instanceof NextResponse) {
          await endRouteSpan(span, 401)
          return auth
        }
        user = auth.user
      }

      // Validation
      let body: TBody | undefined
      if (config.schema && (request.method === 'POST' || request.method === 'PATCH')) {
        let json: any
        try {
          json = await request.json()
        } catch (e) {
          await endRouteSpan(span, 400, e)
          return securityError(400, 'VALIDATION_ERROR', 'Invalid JSON body')
        }
        const parsed = (config.schema as ZodSchema<TBody>).safeParse(json)
        if (!parsed.success) {
          const fields = parsed.error.issues.map((i) => i.path.join('.') || 'root').join(', ')
          await endRouteSpan(span, 400)
          return securityError(400, 'VALIDATION_ERROR', `Invalid fields: ${fields}`)
        }
        body = parsed.data
      }

      const resp = await handler({ request, user, body, securityCorrelationId: cid }, routeContext)
      await endRouteSpan(span, resp.status)
      // Forward the CSP nonce from the request if present for consistent headers
      const nonce = request.headers.get('x-csp-nonce') || undefined
      return applySecurityHeaders ? applySecurityHeaders(resp, { nonce }) : resp
    } catch (error: any) {
      const { ipAddress, userAgent, endpoint } = getRequestContext(request)
      await logSecurityEvent({
        type: 'ERROR',
        severity: 'LOW',
        ipAddress,
        userAgent,
        endpoint,
        correlationId: cid,
        details: { message: error?.message || String(error) },
      })
      await endRouteSpan(span, 500, error)
      return securityError(500, 'SERVER_ERROR', 'An unexpected error occurred')
    }
  }
}
