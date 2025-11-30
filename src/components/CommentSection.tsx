 'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import Link from 'next/link'
import { Heart, LogIn, MessageCircle, Send, Trash2, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  addComment,
  addReply,
  deleteComment,
  fetchCommentsPage,
  fetchReplies,
  likeComment,
} from '@/lib/firebase'
import { getEmailPrefix, computeDisplayName } from '@/lib/security/sanitization'

const COMMENTS_PAGE_SIZE = 5

interface CommentRecord {
  id: string
  text: string
  userId: string
  emailPrefix?: string
  userPhotoURL?: string
  userName?: string
  createdAt: Date
  updatedAt: Date
  likes: number
  replyCount: number
}

type ReplyRecord = Omit<CommentRecord, 'replyCount'>

interface CommentWithState extends CommentRecord {
  replies: ReplyRecord[]
  repliesLoaded: boolean
  repliesLoading: boolean
  showReplies: boolean
  replyDraft: string
  replySubmitting: boolean
}

const enhanceComment = (comment: CommentRecord): CommentWithState => ({
  ...comment,
  replies: [],
  repliesLoaded: false,
  repliesLoading: false,
  showReplies: false,
  replyDraft: '',
  replySubmitting: false,
})

const formatTimeAgo = (date: Date) => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`

  return date.toLocaleDateString()
}

interface CommentSectionProps {
  noteId: string
  className?: string
}

export default function CommentSection({ noteId, className }: CommentSectionProps) {
  const { user } = useAuth()

  const [comments, setComments] = useState<CommentWithState[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  const COMMENTS_DISABLED = (process.env.NEXT_PUBLIC_COMMENTS_DISABLED !== 'false') && (process.env.NEXT_PUBLIC_COMMENTS_ENABLED !== 'true')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)
  const lastVisibleRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null)

  const commentCount = comments.length
  const hasComments = commentCount > 0

  const containerBaseClass =
    'relative overflow-hidden rounded-2xl border border-amber-100/80 bg-white/70 backdrop-blur-sm shadow-lg transition-all duration-200 hover:shadow-xl'
  const containerClassName = className ? `${containerBaseClass} ${className}` : containerBaseClass

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const setCommentState = useCallback(
    (commentId: string, updater: (current: CommentWithState) => CommentWithState) => {
      setComments((previous) =>
        previous.map((comment) => (comment.id === commentId ? updater(comment) : comment))
      )
    },
    []
  )

  const loadInitialComments = useCallback(async () => {
    setInitialLoading(true)
    setError(null)
    lastVisibleRef.current = null

    try {
      const { comments: fetched, lastDoc, hasMore: more } = await fetchCommentsPage(
        noteId,
        COMMENTS_PAGE_SIZE
      )

      setComments(fetched.map(enhanceComment))
      lastVisibleRef.current = lastDoc
      setHasMore(more)
      const candidates = fetched.filter((c) => c.replyCount > 0).slice(0, 2)
      for (const c of candidates) {
        try {
          const replies = await fetchReplies(noteId, c.id, 10)
          setCommentState(c.id, (current) => ({
            ...current,
            replies,
            repliesLoaded: true,
            repliesLoading: false,
          }))
        } catch {}
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load comments. Please try again.')
      setComments([])
      setHasMore(false)
    } finally {
      setInitialLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      await loadInitialComments()
    }

    load()

    return () => {
      cancelled = true
      setComments([])
      lastVisibleRef.current = null
    }
  }, [loadInitialComments])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [newComment])

  useEffect(() => {
    if (user) {
      setShowLoginPrompt(false)
    }
  }, [user])

  const handleSubmitComment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (!newComment.trim()) {
      setError('Please write a comment before posting.')
      return
    }

    if (COMMENTS_DISABLED) {
      setError('Comments are temporarily disabled.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const commentRef = await addComment(noteId, {
        text: newComment.trim(),
        userName: computeDisplayName(
          user.displayName,
          user.displayName,
          undefined,
          getEmailPrefix(user.email) ?? undefined
        ),
      })

      const optimisticComment: CommentWithState = enhanceComment({
        id: commentRef.id,
        text: newComment.trim(),
        userId: user.uid,
        emailPrefix: getEmailPrefix(user.email) ?? undefined,
        userPhotoURL: user.photoURL || undefined,
        userName: computeDisplayName(
          user.displayName,
          user.displayName,
          undefined,
          getEmailPrefix(user.email) ?? undefined
        ),
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
        replyCount: 0,
      })

      setComments((previous) => [optimisticComment, ...previous])
      setNewComment('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch (err) {
      console.error(err)
      setError('Failed to post comment. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLikeComment = async (commentId: string) => {
    if (COMMENTS_DISABLED) {
      setError('Comments are temporarily disabled.')
      return
    }
    try {
      const isLiked = await likeComment(noteId, commentId)

      setLikedComments((previous) => {
        const updated = new Set(previous)
        if (isLiked) {
          updated.add(commentId)
        } else {
          updated.delete(commentId)
        }
        return updated
      })

      setCommentState(commentId, (current) => ({
        ...current,
        likes: isLiked ? current.likes + 1 : Math.max(current.likes - 1, 0),
      }))
    } catch (err) {
      console.error(err)
      const message = err instanceof Error && err.message ? err.message : 'Failed to update like. Please try again.'
      setError(message)
    }
  }

  const handleDeleteComment = async (commentId: string, commentOwnerId: string) => {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (COMMENTS_DISABLED) {
      setError('Comments are temporarily disabled.')
      return
    }

    try {
      await deleteComment(noteId, commentId, commentOwnerId)
      setComments((previous) => previous.filter((comment) => comment.id !== commentId))
    } catch (err) {
      console.error(err)
      setError('Failed to delete comment. Please try again.')
    }
  }

  const handleToggleReplies = async (commentId: string) => {
    const target = comments.find((comment) => comment.id === commentId)
    if (!target) return

    const nextShow = !target.showReplies
    setCommentState(commentId, (current) => ({ ...current, showReplies: nextShow }))

    if (nextShow && !target.repliesLoaded) {
      setCommentState(commentId, (current) => ({ ...current, repliesLoading: true }))
      try {
        const replies = await fetchReplies(noteId, commentId, 10)
        setCommentState(commentId, (current) => ({
          ...current,
          replies,
          repliesLoaded: true,
          repliesLoading: false,
        }))
      } catch (err) {
        console.error(err)
        setCommentState(commentId, (current) => ({ ...current, repliesLoading: false }))
        setError('Failed to load replies. Please try again.')
      }
    }
  }

  const handleReplyDraftChange = (commentId: string, value: string) => {
    setCommentState(commentId, (current) => ({
      ...current,
      replyDraft: value,
    }))
  }

  const handleReplySubmit = async (
    event: React.FormEvent<HTMLFormElement>,
    commentId: string
  ) => {
    event.preventDefault()

    const target = comments.find((comment) => comment.id === commentId)
    if (!target) return

    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    const trimmed = target.replyDraft.trim()
    if (!trimmed) {
      setError('Please write a reply before posting.')
      return
    }

    if (COMMENTS_DISABLED) {
      setError('Comments are temporarily disabled.')
      return
    }

    setCommentState(commentId, (current) => ({ ...current, replySubmitting: true }))
    setError(null)

    try {
      const replyRef = await addReply(noteId, commentId, {
        text: trimmed,
        userName: computeDisplayName(
          user.displayName,
          user.displayName,
          undefined,
          getEmailPrefix(user.email) ?? undefined
        ),
      })

      const optimisticReply: ReplyRecord = {
        id: replyRef.id,
        text: trimmed,
        userId: user.uid,
        emailPrefix: getEmailPrefix(user.email) ?? undefined,
        userPhotoURL: user.photoURL || undefined,
        userName: computeDisplayName(
          user.displayName,
          user.displayName,
          undefined,
          getEmailPrefix(user.email) ?? undefined
        ),
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0,
      }

      setCommentState(commentId, (current) => ({
        ...current,
        replies: [...current.replies, optimisticReply],
        repliesLoaded: true,
        replyDraft: '',
        replySubmitting: false,
        replyCount: current.replyCount + 1,
        showReplies: true,
      }))

      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error(err)
      setCommentState(commentId, (current) => ({ ...current, replySubmitting: false }))
      setError('Failed to post reply. Please try again.')
    }
  }

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return

    setLoadingMore(true)
    setError(null)

    try {
      const { comments: fetched, lastDoc, hasMore: more } = await fetchCommentsPage(
        noteId,
        COMMENTS_PAGE_SIZE,
        lastVisibleRef.current
      )

      const enriched = fetched.map(enhanceComment)

      setComments((previous) => {
        const existingIds = new Set(previous.map((comment) => comment.id))
        const filtered = enriched.filter((comment) => !existingIds.has(comment.id))
        return [...previous, ...filtered]
      })

      lastVisibleRef.current = lastDoc
      setHasMore(more)
    } catch (err) {
      console.error(err)
      setError('Failed to load more comments. Please try again.')
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, noteId])

  const getUserDisplayName = (comment: { userName?: string; emailPrefix?: string }) => {
    if (comment.userName) return comment.userName
    const ep = comment.emailPrefix || 'User'
    return ep.charAt(0).toUpperCase() + ep.slice(1)
  }

  useEffect(() => {
    const root = listContainerRef.current
    const target = commentsEndRef.current
    if (!root || !target || !hasMore) return
    let cancelled = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) return
        const [entry] = entries
        if (entry && entry.isIntersecting) {
          handleLoadMore()
        }
      },
      { root, rootMargin: '200px', threshold: 0 }
    )
    observer.observe(target)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [hasMore, handleLoadMore])

  const getUserInitial = (ep: string) => (ep || 'U').charAt(0).toUpperCase()

  const renderReply = (reply: ReplyRecord) => {
    return (
      <li
        key={reply.id}
        className="rounded-2xl border border-amber-100/60 bg-white/70 p-3 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100/80 text-[#90c639]">
            {reply.userPhotoURL ? (
              <img
                src={reply.userPhotoURL}
                alt="User avatar"
                className="h-8 w-8 rounded-full border border-amber-100 object-cover"
              />
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wide">
                {getUserInitial(reply.emailPrefix || '')}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-slate-900">
                {reply.userName || getUserDisplayName(reply)}
              </span>
              <span className="text-xs text-slate-400">{formatTimeAgo(reply.createdAt)}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {reply.text}
            </p>
          </div>
        </div>
      </li>
    )
  }

  return (
    <section className={containerClassName}>
      <header className="flex items-center justify-between gap-3 border-b border-amber-100/70 bg-gradient-to-r from-amber-50 via-white to-white px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#90c639]/12 text-[#3a7a1a]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-900">Community Discussion</p>
            <p className="text-xs text-slate-500">
              Share quick tips, questions, or clarifications for this note.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-amber-100/80 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </span>
      </header>

      <div className="space-y-5 px-4 py-5 md:px-6">
        {COMMENTS_DISABLED && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-700 shadow-sm">
            Comments are temporarily disabled.
          </div>
        )}
        {!user && (
          <div
            className={`flex flex-col gap-3 rounded-2xl border ${
              showLoginPrompt ? 'border-[#90c639]/60 ring-2 ring-[#90c639]/30' : 'border-amber-100/80'
            } bg-amber-50/70 px-4 py-4 text-sm text-slate-700 shadow-sm md:flex-row md:items-center md:justify-between`}
          >
            <div className="flex items-start gap-3 md:items-center">
              <LogIn className="h-5 w-5 flex-shrink-0 text-[#90c639]" />
              <div>
                <p className="font-semibold">Sign in to join the conversation</p>
                <p className="text-xs text-slate-600">
                  Your insights help classmates understand the material faster.
                </p>
              </div>
            </div>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[#90c639] bg-[#90c639] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#7ab332] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#90c639]/40"
            >
              <LogIn className="h-4 w-4" />
              Log in to comment
            </Link>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm font-medium text-red-600 shadow-sm"
          >
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-amber-100/80 bg-white/80 px-4 py-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
          <form onSubmit={handleSubmitComment} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Your avatar"
                    className="h-10 w-10 rounded-full border border-amber-100 object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100/80 text-[#90c639]">
                    {user ? (
                      <span className="text-sm font-semibold uppercase">
                        {getUserInitial(getEmailPrefix(user.email) ?? '')}
                      </span>
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)
                  }
                  placeholder={
                    user
                      ? 'Share something helpful for your classmates...'
                      : 'Sign in to share what you found helpful.'
                  }
                  disabled={!user || isSubmitting || COMMENTS_DISABLED}
                  className="w-full min-h-[72px] max-h-48 resize-none rounded-2xl border border-amber-100 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-inner transition-all placeholder:text-slate-400 focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">
                    {user ? 'Be kind and keep it relevant.' : ''}
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newComment.trim() || !user || COMMENTS_DISABLED}
                    className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {isSubmitting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Post
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div ref={listContainerRef} className="max-h-[22rem] overflow-y-auto pr-1 md:pr-2">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-amber-100/80 bg-white/70 px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/70 border-t-transparent" />
              Fetching the latest comments...
            </div>
          ) : !hasComments ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-amber-100 bg-amber-50/50 px-6 py-12 text-center shadow-inner">
              <MessageCircle className="h-10 w-10 text-[#90c639]" />
              <p className="text-sm font-semibold text-slate-700">No comments yet</p>
              <p className="text-xs text-slate-500">Be the first to let others know what stood out.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {comments.map((comment) => {
                  const isLiked = likedComments.has(comment.id)
                  const canDelete = user && user.uid === comment.userId

                  return (
                    <li
                      key={comment.id}
                      className="rounded-2xl border border-amber-100/70 bg-white/80 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100/80 text-[#90c639]">
                          {comment.userPhotoURL ? (
                            <img
                              src={comment.userPhotoURL}
                              alt="User avatar"
                              className="h-9 w-9 rounded-full border border-amber-100 object-cover"
                            />
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-wide">
                              {getUserInitial(comment.emailPrefix || '')}
                            </span>
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-slate-900">
                              {getUserDisplayName(comment)}
                            </span>
                            <span className="text-xs text-slate-400">
                              {formatTimeAgo(comment.createdAt)}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                            {comment.text}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleLikeComment(comment.id)}
                  aria-pressed={isLiked}
                  disabled={COMMENTS_DISABLED}
                  className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
                    isLiked
                      ? 'border-rose-200 bg-rose-50 text-rose-500'
                      : 'border-transparent text-slate-500 hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-500'
                  }`}
                >
                              <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
                              <span>{Math.max(comment.likes, 0)}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleReplies(comment.id)}
                              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {comment.showReplies
                                ? 'Hide replies'
                                : comment.replyCount > 0
                                ? `View replies (${comment.replyCount})`
                                : 'Reply'}
                            </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteComment(comment.id, comment.userId)}
                    disabled={COMMENTS_DISABLED}
                    className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
                          </div>

                          {comment.showReplies && (
                            <div className="mt-4 space-y-3 border-l border-amber-100 pl-4 md:pl-6">
                              {comment.repliesLoading ? (
                                <div className="text-xs text-slate-500">Loading replies...</div>
                              ) : comment.replies.length === 0 ? (
                                <div className="text-xs text-slate-500">
                                  No replies yet. Start the conversation!
                                </div>
                              ) : (
                                <ul className="space-y-3">{comment.replies.map(renderReply)}</ul>
                              )}

                              {user ? (
                                <form
                                  onSubmit={(event) => handleReplySubmit(event, comment.id)}
                                  className="space-y-2"
                                >
                                  <textarea
                                    value={comment.replyDraft}
                                    onChange={(event) =>
                                      handleReplyDraftChange(comment.id, event.target.value)
                                    }
                                    placeholder="Write a reply..."
                                    disabled={COMMENTS_DISABLED}
                                    className="w-full min-h-[60px] resize-none rounded-xl border border-amber-100 bg-white/80 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={comment.replySubmitting || !comment.replyDraft.trim() || COMMENTS_DISABLED}
                                      className="inline-flex min-h-[32px] items-center gap-2 rounded-full bg-[#90c639] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                      {comment.replySubmitting ? (
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                      ) : (
                                        <Send className="h-3.5 w-3.5" />
                                      )}
                                      Reply
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setShowLoginPrompt(true)}
                                  className="text-xs font-semibold text-[#90c639] underline underline-offset-4"
                                >
                                  Sign in to reply
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading more…' : 'Load older comments'}
                  </button>
                </div>
              )}

              <div ref={commentsEndRef} />
            </>
          )}
        </div>
      </div>
    </section>
  )
}
