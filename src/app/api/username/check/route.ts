import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { ok } from '@/lib/api/response'
import { apiErrorByKey } from '@/lib/api/errors'
import { validateUsername } from '@/lib/username/validation'
import { isReservedUsernameServer } from '@/lib/username/reserved-server'
import { enforceRateLimitOr429, rateLimitKeyByIp } from '@/lib/security/rateLimit'
import { startRouteSpan, endRouteSpan } from '@/lib/security/logging'

export async function GET(request: NextRequest) {
  const span = startRouteSpan('username.check', request)
  // IP-based rate limit: 50 requests/minute
  const rl = await enforceRateLimitOr429(request, 'username_check', rateLimitKeyByIp(request, 'username_check'))
  if (!('allowed' in rl) || rl.allowed !== true) {
    await endRouteSpan(span, 429)
    return rl.response
  }

  const username = request.nextUrl.searchParams.get('username') || ''

  // Basic validation using shared rules
  const validation = validateUsername(username)
  if (!validation.isValid) {
    await endRouteSpan(span, 200)
    return ok({ available: false })
  }

  const normalized = username.toLowerCase().trim()
  if (!normalized) {
    await endRouteSpan(span, 400)
    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Username is required')
  }

  try {
    // Dynamic reserved check (server-side list)
    const isReserved = await isReservedUsernameServer(normalized)
    if (isReserved) {
      await endRouteSpan(span, 200)
      return ok({ available: false })
    }

    const db = getAdminDb()
    const ref = db.collection('usernames').doc(normalized)
    const snap = await ref.get()
    const available = !snap.exists || (snap.exists && !snap.data()?.isActive)
    await endRouteSpan(span, 200)
    return ok({ available })
  } catch (err: any) {
    await endRouteSpan(span, 500, err)
    return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to check availability')
  }
}

