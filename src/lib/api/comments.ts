import { requireOk, authorizedJson } from '@/lib/api/client'
import type { CommentRecord, CommentReplyRecord } from '@/lib/data/types'

interface AddCommentBody {
  text: string
  userName?: string
  userDisplayName?: string
  userUsername?: string
}

interface AddReplyBody {
  text: string
  userName?: string
  userDisplayName?: string
  userUsername?: string
}

export async function addComment(noteId: string, commentData: AddCommentBody): Promise<{ id: string }> {
  return await requireOk<{ id: string }>(
    `/api/notes/${encodeURIComponent(noteId)}/comments`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(commentData || {}),
    },
    { requireAuth: true }
  )
}

export async function likeComment(noteId: string, commentId: string): Promise<boolean> {
  const result = await requireOk<{ liked: boolean }>(
    `/api/notes/${encodeURIComponent(noteId)}/comments/${encodeURIComponent(commentId)}/like`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    },
    { requireAuth: true }
  )
  return !!result.liked
}

export async function deleteComment(noteId: string, commentId: string, _ownerUserId?: string): Promise<boolean> {
  // Owner verification is handled server-side; third param kept for compatibility
  const result = await requireOk<{ success: boolean }>(
    `/api/notes/${encodeURIComponent(noteId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
    { requireAuth: true }
  )
  return !!result.success
}

export async function addReply(noteId: string, commentId: string, replyData: AddReplyBody): Promise<{ id: string }> {
  return await requireOk<{ id: string }>(
    `/api/notes/${encodeURIComponent(noteId)}/comments/${encodeURIComponent(commentId)}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replyData || {}),
    },
    { requireAuth: true }
  )
}

// Server-side paginated fetch for comments
export interface CommentsPageCursor { cursorCreatedAt?: number; cursorId?: string }
export interface CommentsPage {
  comments: CommentRecord[]
  nextCursor: CommentsPageCursor | null
  hasMore: boolean
}

export async function getCommentsPage(
  noteId: string,
  limit: number = 15,
  cursor?: CommentsPageCursor
): Promise<CommentsPage> {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (cursor?.cursorCreatedAt && cursor?.cursorId) {
    params.set('cursorCreatedAt', String(cursor.cursorCreatedAt))
    params.set('cursorId', cursor.cursorId)
  }

  const res = await authorizedJson<{
    comments: Array<{
      id: string
      text: string
      userId: string
      emailPrefix?: string | null
      userPhotoURL?: string | null
      userName?: string | null
      userDisplayName?: string | null
      userUsername?: string | null
      likes: number
      replyCount: number
      createdAtMs: number
      updatedAtMs: number
    }>
    nextCursor: CommentsPageCursor | null
    hasMore: boolean
  }>(`/api/notes/${encodeURIComponent(noteId)}/comments?${params.toString()}`, { method: 'GET' }, { requireAuth: false })

  const data = (res as any)?.data
  if (!data) {
    const err = res as any
    throw new Error(err?.error || 'Failed to fetch comments')
  }
  const comments: CommentRecord[] = data.comments.map((c: any) => ({
    id: c.id,
    text: c.text,
    userId: c.userId,
    emailPrefix: c.emailPrefix ?? undefined,
    userPhotoURL: c.userPhotoURL || undefined,
    userName: c.userName || undefined,
    userDisplayName: c.userDisplayName || undefined,
    userUsername: c.userUsername || undefined,
    likes: c.likes,
    replyCount: c.replyCount,
    createdAt: new Date(c.createdAtMs),
    updatedAt: new Date(c.updatedAtMs),
  }))
  return { comments, nextCursor: data.nextCursor, hasMore: !!data.hasMore }
}

// Server-side paginated fetch for replies
export interface RepliesPageCursor { cursorCreatedAt?: number; cursorId?: string }
export interface RepliesPage {
  replies: CommentReplyRecord[]
  nextCursor: RepliesPageCursor | null
  hasMore: boolean
}

export async function getRepliesPage(
  noteId: string,
  commentId: string,
  limit: number = 50,
  cursor?: RepliesPageCursor
): Promise<RepliesPage> {
  const params = new URLSearchParams()
  if (limit) params.set('limit', String(limit))
  if (cursor?.cursorCreatedAt && cursor?.cursorId) {
    params.set('cursorCreatedAt', String(cursor.cursorCreatedAt))
    params.set('cursorId', cursor.cursorId)
  }

  const res = await authorizedJson<{
    replies: Array<{
      id: string
      text: string
      userId: string
      emailPrefix?: string | null
      userPhotoURL?: string | null
      userName?: string | null
      userDisplayName?: string | null
      userUsername?: string | null
      likes: number
      createdAtMs: number
      updatedAtMs: number
    }>
    nextCursor: RepliesPageCursor | null
    hasMore: boolean
  }>(`/api/notes/${encodeURIComponent(noteId)}/comments/${encodeURIComponent(commentId)}/replies?${params.toString()}`, { method: 'GET' }, { requireAuth: false })

  const data = (res as any)?.data
  if (!data) {
    const err = res as any
    throw new Error(err?.error || 'Failed to fetch replies')
  }
  const replies: CommentReplyRecord[] = data.replies.map((r: any) => ({
    id: r.id,
    text: r.text,
    userId: r.userId,
    emailPrefix: r.emailPrefix ?? undefined,
    userPhotoURL: r.userPhotoURL || undefined,
    userName: r.userName || undefined,
    userDisplayName: r.userDisplayName || undefined,
    userUsername: r.userUsername || undefined,
    likes: r.likes,
    createdAt: new Date(r.createdAtMs),
    updatedAt: new Date(r.updatedAtMs),
  }))
  return { replies, nextCursor: data.nextCursor, hasMore: !!data.hasMore }
}
