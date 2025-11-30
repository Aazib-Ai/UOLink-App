import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey, apiError } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore'
import { logRequestStart, logRequestEnd, logApiError } from '@/lib/api/logger'
import { getEmailPrefix, computeDisplayName, safeText } from '@/lib/security/sanitization'
import { validateRequestJSON } from '@/lib/security/validation'
import { addReplySchema } from '@/lib/security/validation'
import { enforceModeration } from '@/lib/security/moderation'
import { getRequestContext, logSecurityEvent, generateCorrelationId } from '@/lib/security/logging'

interface AddReplyBody {
  text?: string
  userName?: string
  userDisplayName?: string
  userUsername?: string
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  return withAuth(request, async ({ user }) => {
    const ctx = logRequestStart('/api/notes/[id]/comments/[commentId]/replies:POST', request, user.uid)
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

    const parsed = await validateRequestJSON<AddReplyBody>(request, addReplySchema)
    if (!parsed.ok || !parsed.data) {
      logRequestEnd(ctx, 400)
      return parsed.error!
    }
    const body = parsed.data
    const text = body.text
    const mod = await enforceModeration(text || '', { endpoint: request.nextUrl?.pathname, userId: user.uid })
    if (!mod.allowed) {
      logRequestEnd(ctx, 400)
      return apiErrorByKey(400, 'CONTENT_VIOLATION', 'Your reply violates content policy.')
    }

    const db = getAdminDb()

    try {
      const commentRef = db.collection('notes').doc(noteId).collection('comments').doc(commentId)
      const repliesCol = commentRef.collection('replies')
      const replyRef = repliesCol.doc()

      const emailPrefix = getEmailPrefix(user.email || undefined) || null
      const displayName = computeDisplayName(
        body.userDisplayName,
        body.userName,
        body.userUsername,
        emailPrefix
      ) || null
      const username = body.userUsername || null

      await db.runTransaction(async (tx) => {
        const commentSnap = await tx.get(commentRef)
        if (!commentSnap.exists) throw new Error('Comment not found')

        tx.set(replyRef, {
          text: mod.sanitizedText,
          userId: user.uid,
          emailPrefix,
          userPhotoURL: (user as any).picture || null,
          userName: displayName ?? null,
          userDisplayName: displayName,
          userUsername: username,
          likes: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        tx.update(commentRef, {
          replyCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        })
      })

      const { ipAddress, userAgent } = getRequestContext(request)
      await logSecurityEvent({
        type: 'DATA_ACCESS',
        userId: user.uid,
        ipAddress,
        userAgent,
        endpoint: request.nextUrl?.pathname,
        correlationId: generateCorrelationId(),
        details: { action: 'create_reply', noteId, commentId },
      })
      logRequestEnd(ctx, 200)
      return ok({ id: replyRef.id })
    } catch (err: any) {
      logApiError('/api/notes/[id]/comments/[commentId]/replies:POST', err)
      const message: string = err?.message || 'Failed to add reply'
      const code = message.includes('not found') ? 'NOT_FOUND' : 'SERVER_ERROR'
      const status = code === 'NOT_FOUND' ? 404 : 500
      logRequestEnd(ctx, status)
      return apiErrorByKey(status, code, message)
    }
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const ctx = logRequestStart('/api/notes/[id]/comments/[commentId]/replies:GET', request)
  const { id: noteId, commentId } = await context.params
  if (!noteId || !commentId) {
    logRequestEnd(ctx, 400)
    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing noteId or commentId')
  }

  const url = request.nextUrl
  const limitParam = url.searchParams.get('limit')
  const limitCount = Math.max(1, Math.min(100, Number(limitParam) || 50))
  const cursorCreatedAtParam = url.searchParams.get('cursorCreatedAt')
  const cursorId = url.searchParams.get('cursorId') || undefined

  const db = getAdminDb()

  try {
    const commentRef = db.collection('notes').doc(noteId).collection('comments').doc(commentId)
    const repliesCol = commentRef.collection('replies')

    let q = repliesCol
      .orderBy('createdAt', 'asc')
      .orderBy(FieldPath.documentId(), 'asc')
      .limit(limitCount)

    if (cursorCreatedAtParam && cursorId) {
      const ms = Number(cursorCreatedAtParam)
      const ts = Timestamp.fromMillis(isNaN(ms) ? Date.now() : ms)
      q = repliesCol
        .orderBy('createdAt', 'asc')
        .orderBy(FieldPath.documentId(), 'asc')
        .startAfter(ts, cursorId)
        .limit(limitCount)
    }

    const snap = await q.get()

    const replies = snap.docs.map((doc) => {
      const data = doc.data() || {}
      const createdAt = data.createdAt?.toDate?.() ? data.createdAt.toDate() as Date : new Date()
      const updatedAt = data.updatedAt?.toDate?.() ? data.updatedAt.toDate() as Date : createdAt
      return {
        id: doc.id,
        text: safeText(String(data.text || ''), { maxLength: 2000 }),
        userId: String(data.userId || ''),
        emailPrefix: data.emailPrefix || null,
        userPhotoURL: data.userPhotoURL || null,
        userName: data.userName || null,
        userDisplayName: data.userDisplayName || null,
        userUsername: data.userUsername || null,
        likes: Number(data.likes || 0),
        createdAtMs: createdAt.getTime(),
        updatedAtMs: updatedAt.getTime(),
      }
    })

    const lastDoc = snap.docs[snap.docs.length - 1]
    const nextCursor = lastDoc
      ? {
          cursorCreatedAt: (lastDoc.data()?.createdAt?.toDate?.() ? lastDoc.data().createdAt.toDate() : new Date()).getTime(),
          cursorId: lastDoc.id,
        }
      : null

    const hasMore = snap.docs.length === limitCount

    logRequestEnd(ctx, 200, { count: replies.length, hasMore })
    return ok({ replies, nextCursor, hasMore })
  } catch (err: any) {
    logApiError('/api/notes/[id]/comments/[commentId]/replies:GET', err)
    logRequestEnd(ctx, 500)
    return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to fetch replies')
  }
}
