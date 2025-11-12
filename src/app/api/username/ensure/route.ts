import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { isReservedUsernameServer } from '@/lib/username/reserved-server'
import { generateBaseUsername } from '@/lib/username/generation'
import { startRouteSpan, endRouteSpan, getRequestContext, logAuditEvent } from '@/lib/security/logging'
import { usernameCache } from '@/lib/cache/username-cache'

export async function POST(request: NextRequest) {
  return withAuth(request, async ({ user }) => {
    const span = startRouteSpan('username.ensure', request, user?.uid)
    const db = getAdminDb()
    try {
      // If user already has an active username, ensure profile fields are set and return it
      const activeSnap = await db
        .collection('usernames')
        .where('userId', '==', user.uid)
        .where('isActive', '==', true)
        .limit(1)
        .get()

      const profileRef = db.collection('profiles').doc(user.uid)
      if (!activeSnap.empty) {
        const existing = activeSnap.docs[0].data()
        const displayUsername: string = existing.displayUsername || existing.id || ''
        await profileRef.set(
          {
            username: displayUsername,
            usernameLastChanged: existing.updatedAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
        await endRouteSpan(span, 200)
        return ok({ username: displayUsername })
      }

      // Derive a sensible base from profile name, email prefix, or a UID-based fallback
      const profileSnap = await profileRef.get()
      const profileData = profileSnap.exists ? profileSnap.data() : {}
      const fullName = String(profileData?.fullName || '').trim()
      const emailPrefix = (user.email || '').split('@')[0] || ''
      const baseSource = fullName || emailPrefix || `user-${user.uid.slice(-6)}`
      let base = generateBaseUsername(baseSource)

      // Ensure non-reserved and non-empty base
      if (!base || (await isReservedUsernameServer(base))) {
        base = `user-${user.uid.slice(-6)}`
      }

      // Find the first available candidate, appending numeric suffixes on conflict
      const candidateLower = base.toLowerCase()
      let suffix = 0
      const maxAttempts = 50
      while (suffix < maxAttempts) {
        const candidateId = suffix === 0 ? candidateLower : `${candidateLower}-${suffix}`
        const displayCandidate = suffix === 0 ? base : `${base}-${suffix}`

        // Skip reserved names even with suffix
        if (await isReservedUsernameServer(candidateId)) {
          suffix++
          continue
        }

        const usernameRef = db.collection('usernames').doc(candidateId)
        const existsSnap = await usernameRef.get()

        if (!existsSnap.exists || !existsSnap.data()?.isActive) {
          // Create records atomically
          await db.runTransaction(async (tx) => {
            const nowTs = FieldValue.serverTimestamp()
            tx.set(usernameRef, {
              id: candidateId,
              userId: user.uid,
              displayUsername: displayCandidate,
              createdAt: nowTs,
              updatedAt: nowTs,
              isActive: true,
            })
            tx.set(
              profileRef,
              {
                username: displayCandidate,
                usernameLastChanged: nowTs,
                updatedAt: nowTs,
              },
              { merge: true }
            )
          })
          try {
            usernameCache.invalidateByUserId(user.uid)
          } catch {}

          try {
            const { ipAddress, userAgent } = getRequestContext(request)
            await logAuditEvent({
              action: 'USERNAME_ENSURE',
              resource: user.uid,
              userId: user.uid,
              ipAddress,
              userAgent,
              correlationId: span.correlationId,
              details: { assigned: displayCandidate },
            })
          } catch {}

          await endRouteSpan(span, 200)
          return ok({ username: displayCandidate })
        }
        suffix++
      }

      await endRouteSpan(span, 500)
      return apiErrorByKey(500, 'SERVER_ERROR', 'Failed to auto-assign username')
    } catch (err: any) {
      await endRouteSpan(span, 500, err)
      return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to ensure username')
    }
  })
}

