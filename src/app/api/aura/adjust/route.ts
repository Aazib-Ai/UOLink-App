import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { logAuditEvent, startRouteSpan, endRouteSpan, getRequestContext, logSecurityEvent } from '@/lib/security/logging'
import { secureRoute } from '@/lib/security/middleware'
import { z } from 'zod'

const bodySchema = z.object({
  userId: z.string().optional(),
  auraDelta: z.number(),
})

export async function POST(request: NextRequest) {
  return secureRoute<{ userId?: string; auraDelta: number }>(
    { routeName: 'aura.adjust', requireAuth: true, rateLimitPreset: 'generic', schema: bodySchema },
    async ({ request, user, body, securityCorrelationId }) => {
      const span = startRouteSpan('aura.adjust', request, user?.uid)
      const requestedUserId = typeof body?.userId === 'string' ? body!.userId! : user!.uid
      const auraDelta = Number(body!.auraDelta)
      if (!Number.isFinite(auraDelta) || auraDelta === 0) {
        await endRouteSpan(span, 400)
        return apiErrorByKey(400, 'VALIDATION_ERROR', 'auraDelta must be a non-zero number')
      }

      if (requestedUserId !== user!.uid) {
        const { ipAddress, userAgent } = getRequestContext(request)
        await logSecurityEvent({
          type: 'ACCESS_DENIED',
          severity: 'MEDIUM',
          userId: user!.uid,
          ipAddress,
          userAgent,
          endpoint: span.endpoint,
          correlationId: securityCorrelationId,
          details: { attemptedTarget: requestedUserId },
        })
        await endRouteSpan(span, 403)
        return apiErrorByKey(403, 'ACCESS_DENIED', 'You can only adjust your own aura')
      }

      const db = getAdminDb()
      const profileRef = db.collection('profiles').doc(requestedUserId)

      try {
        await db.runTransaction(async (tx) => {
          tx.set(
            profileRef,
            {
              aura: FieldValue.increment(auraDelta),
              auraUpdatedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
        })
        const { ipAddress, userAgent } = getRequestContext(request)
        await logAuditEvent({
          action: 'AURA_ADJUST',
          resource: requestedUserId,
          userId: user!.uid,
          ipAddress,
          userAgent,
          correlationId: securityCorrelationId,
          details: { delta: auraDelta },
        })
        await endRouteSpan(span, 200)
        return ok({ success: true })
      } catch (err: any) {
        await endRouteSpan(span, 500, err)
        return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to adjust aura')
      }
    }
  )(request)
}
