import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { validateUsername } from '@/lib/username/validation'
import { FieldValue } from 'firebase-admin/firestore'
import { isReservedUsernameServer } from '@/lib/username/reserved-server'
import { enforceRateLimitOr429, rateLimitKeyByUser } from '@/lib/security/rateLimit'
import { startRouteSpan, endRouteSpan, getRequestContext, logAuditEvent } from '@/lib/security/logging'
import { usernameCache } from '@/lib/cache/username-cache'
import { UsernameError } from '@/lib/username/errors'

interface ChangeBody { username: string }

export async function POST(request: NextRequest) {
  return withAuth(request, async ({ user }) => {
    const span = startRouteSpan('username.change', request, user?.uid)
    // Per-user rate limit: 5 changes/hour
    const rl = await enforceRateLimitOr429(request, 'username_change', rateLimitKeyByUser(user.uid, 'username_change'), user.email || undefined)
    if (!('allowed' in rl) || rl.allowed !== true) {
      await endRouteSpan(span, 429)
      return rl.response
    }
    let body: ChangeBody
    try {
      body = await request.json()
    } catch {
      await endRouteSpan(span, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid JSON body')
    }

    const requested = typeof body.username === 'string' ? body.username.trim() : ''
    if (!requested) {
      await endRouteSpan(span, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Username is required')
    }

    const validation = validateUsername(requested)
    if (!validation.isValid) {
      await endRouteSpan(span, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', validation.errors[0] || 'Invalid username')
    }

    // Dynamic reserved check (server-side list)
    const isReserved = await isReservedUsernameServer(requested)
    if (isReserved) {
      await endRouteSpan(span, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'This username is reserved and cannot be used')
    }

    const usernameLower = requested.toLowerCase()
    const db = getAdminDb()

    // Enforce 30-day cooldown using username_history
    try {
      const lastChangeSnap = await db
        .collection('username_history')
        .where('userId', '==', user.uid)
        .orderBy('changedAt', 'desc')
        .limit(1)
        .get()

      if (!lastChangeSnap.empty) {
        const last = lastChangeSnap.docs[0].data()
        const changedAt = last.changedAt?.toMillis?.() ?? (last.changedAt instanceof Date ? last.changedAt.getTime() : Date.now())
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
        const since = Date.now() - changedAt
        if (since < thirtyDaysMs) {
          const remainingDays = Math.ceil((thirtyDaysMs - since) / (24 * 60 * 60 * 1000))
          try {
            const { ipAddress, userAgent } = getRequestContext(request)
            await logAuditEvent({
              action: 'USERNAME_CHANGE_FAILED',
              resource: user.uid,
              userId: user.uid,
              ipAddress,
              userAgent,
              correlationId: span.correlationId,
              details: { reason: 'COOLDOWN', attempted: requested, remainingDays },
            })
          } catch {}
          return apiErrorByKey(403, 'FORBIDDEN', `Username can only be changed once every 30 days. Please wait ${remainingDays} more days.`)
        }
      }
    } catch (err: any) {
      // If history query fails, proceed cautiously but log standardized error
      // We don't expose internal details
    }

    try {
      await db.runTransaction(async (tx) => {
        // Check requested username record
        const usernameRef = db.collection('usernames').doc(usernameLower)
        const usernameSnap = await tx.get(usernameRef)
        if (usernameSnap.exists) {
          const existing = usernameSnap.data() || {}
          if (existing.isActive) {
            throw new UsernameError('USERNAME_TAKEN', 'Username is already taken')
          }
        }

        // Deactivate existing active username for this user (if any)
        const activeQuery = db
          .collection('usernames')
          .where('userId', '==', user.uid)
          .where('isActive', '==', true)
        const activeQuerySnap = await tx.get(activeQuery)

        if (!activeQuerySnap.empty) {
          const old = activeQuerySnap.docs[0]
          tx.update(old.ref, { isActive: false, updatedAt: FieldValue.serverTimestamp() })

          const historyRef = db.collection('username_history').doc()
          tx.set(historyRef, {
            id: historyRef.id,
            userId: user.uid,
            oldUsername: old.data().displayUsername,
            oldUsernameLower: (old.data().displayUsername || '').toLowerCase(),
            newUsername: requested,
            changedAt: FieldValue.serverTimestamp(),
            aliasExpiresAt: FieldValue.serverTimestamp(), // overwritten below with +90d
          })

          // Overwrite aliasExpiresAt with +90 days using client date to reduce complexity
          const plus90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          tx.update(historyRef, { aliasExpiresAt: plus90 })
        }

        // Create/activate new username record
        const nowTs = FieldValue.serverTimestamp()
        tx.set(usernameRef, {
          id: usernameLower,
          userId: user.uid,
          displayUsername: requested,
          createdAt: nowTs,
          updatedAt: nowTs,
          isActive: true,
        })

        // Update profile with username fields
        const profileRef = db.collection('profiles').doc(user.uid)
        tx.set(
          profileRef,
          {
            username: requested,
            usernameLastChanged: nowTs,
            updatedAt: nowTs,
          },
          { merge: true }
        )
      })
      // Post-commit cache invalidation
      try {
        usernameCache.invalidateByUserId(user.uid)
      } catch {}

      // Security audit logging
      try {
        const { ipAddress, userAgent } = getRequestContext(request)
        await logAuditEvent({
          action: 'USERNAME_CHANGE',
          resource: user.uid,
          userId: user.uid,
          ipAddress,
          userAgent,
          correlationId: span.correlationId,
          details: { newUsername: requested },
        })
      } catch {}

      await endRouteSpan(span, 200)
      return ok({ username: requested })
    } catch (err: any) {
      if (err instanceof UsernameError && err.code === 'USERNAME_TAKEN') {
        await endRouteSpan(span, 409, err)
        try {
          const { ipAddress, userAgent } = getRequestContext(request)
          await logAuditEvent({
            action: 'USERNAME_CHANGE_FAILED',
            resource: user.uid,
            userId: user.uid,
            ipAddress,
            userAgent,
            correlationId: span.correlationId,
            details: { reason: 'USERNAME_TAKEN', attempted: requested },
          })
        } catch {}
        return apiErrorByKey(409, 'VALIDATION_ERROR', 'Username is already taken')
      }
      await endRouteSpan(span, 500, err)
      try {
        const { ipAddress, userAgent } = getRequestContext(request)
        await logAuditEvent({
          action: 'USERNAME_CHANGE_FAILED',
          resource: user.uid,
          userId: user.uid,
          ipAddress,
          userAgent,
          correlationId: span.correlationId,
          details: { reason: (err instanceof UsernameError ? err.code : 'SERVER_ERROR'), attempted: requested },
        })
      } catch {}
      return apiErrorByKey(500, 'VALIDATION_ERROR', err?.message || 'Failed to change username')
    }
  })
}
