import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth/authenticate'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { apiErrorByKey, apiError } from '@/lib/api/errors'
import { ok } from '@/lib/api/response'
import { FieldValue, FieldPath, Timestamp } from 'firebase-admin/firestore'
import { logRequestStart, logRequestEnd, logApiError } from '@/lib/api/logger'
import { addCommentSchema, validateRequestJSON } from '@/lib/security/validation'
import { enforceModeration } from '@/lib/security/moderation'
import { getRequestContext, logSecurityEvent, generateCorrelationId } from '@/lib/security/logging'
import { safeText, getEmailPrefix, computeDisplayName } from '@/lib/security/sanitization'

interface AddCommentBody {
  text?: string
  userName?: string
  userDisplayName?: string
  userUsername?: string
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async ({ user }) => {
    const ctx = logRequestStart('/api/notes/[id]/comments:POST', request, user.uid)
  const { id: noteId } = await context.params
    if (!noteId) {
      logRequestEnd(ctx, 400)
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
    }

    const commentsDisabled = (process.env.COMMENTS_DISABLED !== 'false') && (process.env.COMMENTS_ENABLED !== 'true')
    if (commentsDisabled) {
      logRequestEnd(ctx, 503)
      return apiError(503, { error: 'Service unavailable', code: 'SERVICE_DISABLED', details: 'Comments are temporarily disabled' })
    }

    const parsed = await validateRequestJSON(request, addCommentSchema)
    if (!parsed.ok) {
      logRequestEnd(ctx, 400)
      return parsed.error!
    }
    const body = parsed.data!
    // Content moderation enforcement
    const mod = await enforceModeration(body.text || '', { endpoint: request.nextUrl?.pathname, userId: user.uid })
    if (!mod.allowed) {
      logRequestEnd(ctx, 400)
      return apiErrorByKey(400, 'CONTENT_VIOLATION', 'Your comment violates content policy.')
    }

    const db = getAdminDb()

    try {
      const commentsCol = db.collection('notes').doc(noteId).collection('comments')
      const ref = commentsCol.doc()
      const emailPrefix = getEmailPrefix(user.email || undefined) || null
      const displayName = computeDisplayName(
        body.userDisplayName,
        body.userName,
        body.userUsername,
        emailPrefix
      ) || null
      const username = body.userUsername || null

      await ref.set({
        text: safeText(mod.sanitizedText, { maxLength: 2000 }),
        userId: user.uid,
        emailPrefix,
        userPhotoURL: (user as any).picture || null,
        userName: displayName ?? null,
        userDisplayName: displayName,
        userUsername: username,
        likes: 0,
        replyCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      const { ipAddress, userAgent } = getRequestContext(request)
      await logSecurityEvent({
        type: 'DATA_ACCESS',
        userId: user.uid,
        ipAddress,
        userAgent,
        endpoint: request.nextUrl?.pathname,
        correlationId: generateCorrelationId(),
        details: { action: 'create_comment', noteId },
      })

      logRequestEnd(ctx, 200)
      return ok({ id: ref.id })
    } catch (err: any) {
      logApiError('/api/notes/[id]/comments:POST', err)
      logRequestEnd(ctx, 500)
      return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to add comment')
    }
  })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = logRequestStart('/api/notes/[id]/comments:GET', request)
  const { id: noteId } = await context.params
  if (!noteId) {
    logRequestEnd(ctx, 400)
    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing note id')
  }

  const url = request.nextUrl
  const limitParam = url.searchParams.get('limit')
  const limitCount = Math.max(1, Math.min(100, Number(limitParam) || 15))
  const cursorCreatedAtParam = url.searchParams.get('cursorCreatedAt')
  const cursorId = url.searchParams.get('cursorId') || undefined

  const db = getAdminDb()

  try {
    const commentsCol = db.collection('notes').doc(noteId).collection('comments')

    let q = commentsCol
      .orderBy('createdAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc')
      .limit(limitCount) as FirebaseFirestore.Query

    if (cursorCreatedAtParam && cursorId) {
      const ms = Number(cursorCreatedAtParam)
      const ts = Timestamp.fromMillis(isNaN(ms) ? Date.now() : ms)
      q = commentsCol
        .orderBy('createdAt', 'desc')
        .orderBy(FieldPath.documentId(), 'desc')
        .startAfter(ts, cursorId)
        .limit(limitCount) as FirebaseFirestore.Query
    }

    const snap = await q.get()

    const comments = snap.docs.map((doc) => {
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
        replyCount: Number(data.replyCount || 0),
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

    logRequestEnd(ctx, 200, { count: comments.length, hasMore })
    return ok({ comments, nextCursor, hasMore })
  } catch (err: any) {
    logApiError('/api/notes/[id]/comments:GET', err)
    logRequestEnd(ctx, 500)
    return apiErrorByKey(500, 'SERVER_ERROR', err?.message || 'Failed to fetch comments')
  }
}
