import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { startRouteSpan, endRouteSpan, getRequestContext, logAuditEvent } from '@/lib/security/logging'

export async function POST(request: NextRequest) {
  return withAuth(request, async ({ user }) => {
    const span = startRouteSpan('username.ensure', request, user?.uid)
    const db = getAdminDb()
    try {
      const profileRef = db.collection('profiles').doc(user.uid)
      // Derive roll number from university email and set as immutable username
      const emailPrefix = (user.email || '').split('@')[0] || ''
      const matches = Array.from(emailPrefix.matchAll(/\d+/g)).map(m => m[0])
      const roll = matches.length ? matches.reduce((a, b) => (b.length > a.length ? b : a)) : ''
      if (!roll) {
        await endRouteSpan(span, 400)
        return apiErrorByKey(400, 'VALIDATION_ERROR', 'Unable to derive roll number from email')
      }

      await db.runTransaction(async (tx) => {
        const nowTs = FieldValue.serverTimestamp()
        tx.set(
          profileRef,
          {
            username: roll,
            usernameLastChanged: nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        )
      })

      try {
        const { ipAddress, userAgent } = getRequestContext(request)
        await logAuditEvent({
          action: 'USERNAME_ENSURE',
          resource: user.uid,
          userId: user.uid,
          ipAddress,
          userAgent,
          correlationId: span.correlationId,
          details: { assigned: roll },
        })
      } catch {}

      await endRouteSpan(span, 200)
      return ok({ username: roll })
    } catch (err: any) {
      await endRouteSpan(span, 500, err)
      return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to ensure username')
    }
  })
}
