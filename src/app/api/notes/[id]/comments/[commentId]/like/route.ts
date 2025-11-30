import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey, apiError } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue } from 'firebase-admin/firestore'
import { clampNonNegative, toNumber } from '@/lib/data/common'
import { logRequestStart, logRequestEnd, logApiError } from '@/lib/api/logger'
import { enforceRateLimitOr429, rateLimitKeyByUser, enforceCooldownOr429 } from '@/lib/security/rateLimit'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  return withAuth(request, async ({ user }) => {
    const ctx = logRequestStart('/api/notes/[id]/comments/[commentId]/like:POST', request, user.uid)
    const { id: noteId, commentId } = await context.params
    if (!noteId || !commentId) {
      logRequestEnd(ctx, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing noteId or commentId')
    }

    const commentsDisabled = (process.env.COMMENTS_DISABLED !== 'false') && (process.env.COMMENTS_ENABLED !== 'true')
    if (commentsDisabled) {
      logRequestEnd(ctx, 503)
      return apiError(503, { error: 'Service unavailable', code: 'SERVICE_DISABLED', details: 'Comments are temporarily disabled' })
    }

    // 2s cooldown per user+comment to debounce
    const cd = await enforceCooldownOr429(request, `commentLike:${user.uid}:${commentId}`, 2000)
    if (!cd.allowed) return cd.response

    // Per-user like rate limit: 20/min
    const rl = await enforceRateLimitOr429(request, 'like', rateLimitKeyByUser(user.uid, 'like'), user.email || undefined)
    if (!rl.allowed) return rl.response

    const db = getAdminDb()

    try {
      const commentRef = db.collection('notes').doc(noteId).collection('comments').doc(commentId)
      const likeRef = db.collection('users').doc(user.uid).collection('commentLikes').doc(commentId)
      const profileRef = db.collection('profiles').doc(user.uid)

      const result = await db.runTransaction(async (tx) => {
        const [commentSnap, likeSnap] = await Promise.all([tx.get(commentRef), tx.get(likeRef)])
        if (!commentSnap.exists) {
          throw new Error('Comment not found')
        }
        const comment = commentSnap.data() || {}
        const ownerId = String(comment.userId || '')
        if (!ownerId) throw new Error('Comment owner missing')
        if (ownerId === user.uid) throw new Error('You cannot like your own comment')

        const currentlyLiked = likeSnap.exists
        const currentLikes = clampNonNegative(toNumber(comment.likes))

        let nextLikes = currentLikes
        let liked = currentlyLiked
        let auraDelta = 0

        if (currentlyLiked) {
          // Unlike
          nextLikes = clampNonNegative(currentLikes - 1)
          liked = false
          tx.delete(likeRef)
          auraDelta = -1
        } else {
          // Like
          nextLikes = currentLikes + 1
          liked = true
          tx.set(likeRef, {
            commentId,
            noteId,
            createdAt: FieldValue.serverTimestamp(),
          })
          auraDelta = 1
        }

        tx.update(commentRef, {
          likes: nextLikes,
          updatedAt: FieldValue.serverTimestamp(),
        })

        if (auraDelta !== 0 && ownerId) {
          const ownerProfileRef = db.collection('profiles').doc(ownerId)
          tx.update(ownerProfileRef, {
            aura: FieldValue.increment(auraDelta),
            updatedAt: FieldValue.serverTimestamp(),
          })
        }

        // Touch liker profile for updatedAt consistency
        tx.update(profileRef, { updatedAt: FieldValue.serverTimestamp() })

        return { liked }
      })

      logRequestEnd(ctx, 200, { liked: result.liked })
      const resp = ok(result)
      resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
      resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
      resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
      return resp
    } catch (err: any) {
      logApiError('/api/notes/[id]/comments/[commentId]/like:POST', err)
      const message: string = err?.message || 'Failed to like comment'
      const code = message.includes('own comment') ? 'VALIDATION_ERROR' : message.includes('not found') ? 'NOT_FOUND' : 'SERVER_ERROR'
      const status = code === 'VALIDATION_ERROR' ? 400 : code === 'NOT_FOUND' ? 404 : 500
      logRequestEnd(ctx, status)
      return apiErrorByKey(status, code, message)
    }
  })
}
