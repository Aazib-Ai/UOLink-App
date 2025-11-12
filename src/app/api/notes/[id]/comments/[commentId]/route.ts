import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { logRequestStart, logRequestEnd, logApiError } from '@/lib/api/logger'
import { enforceRateLimitOr429, rateLimitKeyByUser } from '@/lib/security/rateLimit'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  return withAuth(request, async ({ user }) => {
    const ctx = logRequestStart('/api/notes/[id]/comments/[commentId]:DELETE', request, user.uid)
    const { id: noteId, commentId } = await context.params
    if (!noteId || !commentId) {
      logRequestEnd(ctx, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing noteId or commentId')
    }

    // Per-user comment deletion limit: 10/min
    const rl = await enforceRateLimitOr429(request, 'comment', rateLimitKeyByUser(user.uid, 'comment'), user.email || undefined)
    if (!rl.allowed) return rl.response

    const db = getAdminDb()
    const commentRef = db.collection('notes').doc(noteId).collection('comments').doc(commentId)

    try {
      const snap = await commentRef.get()
      if (!snap.exists) {
        logRequestEnd(ctx, 404)
        return apiErrorByKey(404, 'NOT_FOUND', 'Comment not found')
      }
      const data = snap.data() || {}
      const ownerId = String(data.userId || '')
      if (ownerId !== user.uid) {
        logRequestEnd(ctx, 403)
        return apiErrorByKey(403, 'ACCESS_DENIED', 'You can only delete your own comments')
      }

      await commentRef.delete()
      logRequestEnd(ctx, 200)
      const resp = ok({ success: true })
      resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
      resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
      resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
      return resp
    } catch (err: any) {
      logApiError('/api/notes/[id]/comments/[commentId]:DELETE', err)
      logRequestEnd(ctx, 500)
      return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to delete comment')
    }
  })
}
