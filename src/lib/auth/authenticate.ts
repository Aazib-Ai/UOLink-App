import { NextRequest, NextResponse } from 'next/server'
import { logAuthFailure } from '@/lib/api/logger'
import { logSecurityEvent, getRequestContext } from '@/lib/security/logging'
import { getAdminAuth } from '@/lib/firebaseAdmin'

export type SecurityContext = {
    ip: string | null
    userAgent: string | null
    correlationId: string
    riskScore: number
    flags: {
        emailDomainMismatch: boolean
        emailUnverified: boolean
        suspiciousUserAgent: boolean
        missingUserAgent: boolean
    }
}

export function generateCorrelationId(): string {
    const ts = Date.now().toString(36)
    const rand = Math.random().toString(16).slice(2, 10)
    return `${ts}-${rand}`
}

export function getClientIp(request: NextRequest): string | null {
    const hdr = request.headers
    const xff = hdr.get('x-forwarded-for') || hdr.get('X-Forwarded-For')
    if (xff) {
        const first = xff.split(',')[0].trim()
        return first || null
    }
    const cip = hdr.get('cf-connecting-ip') || hdr.get('CF-Connecting-IP')
    if (cip) return cip
    const realIp = hdr.get('x-real-ip') || hdr.get('X-Real-IP')
    if (realIp) return realIp
    return null
}

export function normalizeUserAgent(ua: string | null): string | null {
    if (!ua) return null
    return ua.trim().slice(0, 256) || null
}

export function isSuspiciousUserAgent(ua: string | null): boolean {
    if (!ua) return true
    const lowered = ua.toLowerCase()
    const patterns = [/curl\//, /wget\//, /python-requests/, /httpclient/, /bot/, /scraper/]
    return patterns.some((re) => re.test(lowered))
}

export function isAllowedEmail(email?: string | null): boolean {
    if (!email) return false
    const allowed = /^\d{8}@student\.uol\.edu\.pk$/
    return allowed.test(email)
}

export function computeRiskScore(args: {
    ua: string | null
    emailVerified?: boolean
    emailDomainOk: boolean
}): { score: number; flags: SecurityContext['flags'] } {
    let score = 0
    const missingUserAgent = !args.ua
    const suspiciousUserAgent = isSuspiciousUserAgent(args.ua)
    const emailUnverified = args.emailVerified === false
    const emailDomainMismatch = !args.emailDomainOk

    if (missingUserAgent) score += 2
    if (suspiciousUserAgent) score += 3
    if (emailUnverified) score += 2
    if (emailDomainMismatch) score += 3

    return {
        score,
        flags: {
            emailDomainMismatch,
            emailUnverified,
            suspiciousUserAgent,
            missingUserAgent,
        },
    }
}

export interface AuthenticatedUser {
    uid: string
    email?: string
    email_verified?: boolean
    [key: string]: any
}

export interface AuthenticatedRequest {
    user: AuthenticatedUser
    security: SecurityContext
}

/**
 * Extracts a Firebase ID token from the request headers or cookies.
 */
export function getTokenFromRequest(request: NextRequest): string | null {
    const authorization = request.headers.get('authorization') || request.headers.get('Authorization')
    if (authorization && authorization.startsWith('Bearer ')) {
        return authorization.substring('Bearer '.length)
    }
    // Fallback: cookie named "token" or "idToken"
    const tokenCookie = request.cookies.get('token')?.value || request.cookies.get('idToken')?.value
    return tokenCookie || null
}

/**
 * Verifies the Firebase ID token and returns authenticated user claims.
 * Throws on missing/invalid token.
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedRequest> {
    const token = getTokenFromRequest(request)
    if (!token) {
        throw new Error('Missing authentication token')
    }
    const decoded = await getAdminAuth().verifyIdToken(token)
    const { uid, email, email_verified, ...rest } = decoded
    // Enforce email domain per security requirements
    const emailDomainOk = isAllowedEmail(email)
    if (!emailDomainOk) {
        throw new Error('Email domain not allowed')
    }
    const ua = normalizeUserAgent(request.headers.get('user-agent') || request.headers.get('User-Agent'))
    const ip = getClientIp(request)
    const risk = computeRiskScore({ ua, emailVerified: email_verified, emailDomainOk })
    const security: SecurityContext = {
        ip,
        userAgent: ua,
        correlationId: generateCorrelationId(),
        riskScore: risk.score,
        flags: risk.flags,
    }
    const user: AuthenticatedUser = {
        uid,
        email,
        email_verified,
        ...rest,
    }
    return { user, security }
}

/**
 * Helper to require authentication and return a standardized 401 response when invalid.
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedRequest | NextResponse> {
    try {
        return await authenticateRequest(request)
  } catch (error: any) {
    // Log authentication failures for monitoring and security visibility
    logAuthFailure(request, error?.message || 'Authentication failed')
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({
      type: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: generateCorrelationId(),
      details: { reason: error?.message || 'Authentication failed' },
    })
    return NextResponse.json(
      { error: 'Authentication required', code: 'AUTH_REQUIRED', details: error?.message },
      { status: 401 }
    )
  }
}

/**
 * Wrap an API handler with authentication. The handler receives the authenticated context.
 */
export async function withAuth<T>(
    request: NextRequest,
    handler: (ctx: AuthenticatedRequest) => Promise<T | NextResponse>
): Promise<T | NextResponse> {
    const auth = await requireAuth(request)
    if (auth instanceof NextResponse) {
        return auth
    }
    return handler(auth)
}

