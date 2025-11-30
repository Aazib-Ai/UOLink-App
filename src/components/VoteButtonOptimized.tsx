'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowBigUp, ArrowBigDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { voteOnNote } from '@/lib/api/notes'
import { fetchVotesIndexEfficient } from '@/lib/firebase/saved-notes-index'

interface VoteButtonProps {
  noteId: string
  initialUpvotes?: number
  initialDownvotes?: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  onScoreUpdate?: (result: VoteResult) => void
}

interface VoteData {
  upvotes: number
  downvotes: number
  userVote: 'up' | 'down' | null
}

interface VoteResult {
  upvotes: number
  downvotes: number
  userVote: 'up' | 'down' | null
  credibilityScore: number
}

const SIZE_CONFIGS = {
  sm: {
    icon: 'w-3.5 h-3.5',
    gap: 'gap-1',
    buttonPadding: 'p-1',
    containerPadding: 'px-1 py-0.5',
    countPadding: 'px-1.5 py-0.5',
    countText: 'text-[11px]',
  },
  md: {
    icon: 'w-4 h-4',
    gap: 'gap-1.5',
    buttonPadding: 'p-1.5',
    containerPadding: 'px-1.5 py-0.5',
    countPadding: 'px-2 py-0.5',
    countText: 'text-xs',
  },
  lg: {
    icon: 'w-5 h-5',
    gap: 'gap-2',
    buttonPadding: 'p-2',
    containerPadding: 'px-2 py-1',
    countPadding: 'px-2.5 py-0.5',
    countText: 'text-sm',
  },
} as const

const CONTAINER_BASE =
  'inline-flex items-center rounded-full border border-amber-100/70 bg-white/80 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-colors duration-150'

const BUTTON_BASE =
  'inline-flex items-center justify-center rounded-full border border-transparent transition-colors transition-transform duration-150 touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#90c639]/40 disabled:pointer-events-none'

const ACTIVE_UP_CLASSES = 'bg-[#90c639]/15 text-[#2a5014] border-[#90c639]/20'
const ACTIVE_DOWN_CLASSES = 'bg-rose-50 text-rose-500 border-rose-200/70'
const INACTIVE_UP_CLASSES = 'text-slate-500 hover:text-[#2a5014] hover:bg-[#90c639]/12'
const INACTIVE_DOWN_CLASSES = 'text-slate-500 hover:text-rose-500 hover:bg-rose-50/60'
const COUNT_BASE = 'font-semibold leading-none text-center rounded-full border border-transparent transition-colors duration-150'

export default function VoteButtonOptimized({
  noteId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  className = '',
  size = 'md',
  showLabel = false,
  onScoreUpdate,
}: VoteButtonProps) {
  const { user } = useAuth()
  const [voteData, setVoteData] = useState<VoteData>({
    upvotes: initialUpvotes,
    downvotes: initialDownvotes,
    userVote: null
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingVote, setPendingVote] = useState<'up' | 'down' | null>(null)

  const sizeConfig = SIZE_CONFIGS[size]

  useEffect(() => {
    let mounted = true
    const init = async () => {
      if (!noteId) return
      if (!user) {
        setVoteData({ upvotes: initialUpvotes, downvotes: initialDownvotes, userVote: null })
        return
      }
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(`votesIndex:${user.uid}`)
          const parsed = raw ? JSON.parse(raw) : null
          if (parsed && Array.isArray(parsed.up) && Array.isArray(parsed.down)) {
            const uv = parsed.up.includes(noteId) ? 'up' : parsed.down.includes(noteId) ? 'down' : null
            setVoteData({ upvotes: initialUpvotes, downvotes: initialDownvotes, userVote: uv })
          }
        } catch {}
      }
      const idx = await fetchVotesIndexEfficient(user.uid)
      if (!mounted) return
      const uv = idx.up.includes(noteId) ? 'up' : idx.down.includes(noteId) ? 'down' : null
      setVoteData({ upvotes: initialUpvotes, downvotes: initialDownvotes, userVote: uv })
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`votesIndex:${user.uid}`, JSON.stringify(idx))
        }
      } catch {}
    }
    init()
    return () => { mounted = false }
  }, [noteId, user?.uid])

  // Update vote data when initial values change (from parent component updates)
  useEffect(() => {
    // Only update if we don't have a pending vote operation
    if (!pendingVote) {
      console.log(`Initial values changed - noteId: ${noteId}, upvotes: ${initialUpvotes}, downvotes: ${initialDownvotes}`)
      setVoteData(prev => ({
        ...prev,
        upvotes: initialUpvotes,
        downvotes: initialDownvotes
      }))
    }
  }, [initialUpvotes, initialDownvotes, pendingVote, noteId])

  // Auto-clear error after 3 seconds
  useEffect(() => {
    if (!error) return
    const timeoutId = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(timeoutId)
  }, [error])

  // Optimistic update function
  const applyOptimisticUpdate = useCallback((voteType: 'up' | 'down') => {
    setVoteData(prev => {
      console.log(`Optimistic update - noteId: ${noteId}, voteType: ${voteType}, prevState:`, prev)
      
      let newUpvotes = prev.upvotes
      let newDownvotes = prev.downvotes
      let newUserVote: 'up' | 'down' | null = voteType

      // Handle vote logic optimistically
      if (prev.userVote === voteType) {
        // Removing vote
        if (voteType === 'up') {
          newUpvotes = Math.max(0, newUpvotes - 1)
        } else {
          newDownvotes = Math.max(0, newDownvotes - 1)
        }
        newUserVote = null
      } else {
        // Adding or changing vote
        if (prev.userVote === 'up') {
          newUpvotes = Math.max(0, newUpvotes - 1)
        } else if (prev.userVote === 'down') {
          newDownvotes = Math.max(0, newDownvotes - 1)
        }

        if (voteType === 'up') {
          newUpvotes += 1
        } else {
          newDownvotes += 1
        }
      }

      const newState = {
        upvotes: newUpvotes,
        downvotes: newDownvotes,
        userVote: newUserVote
      }
      
      console.log(`Optimistic update result - noteId: ${noteId}, newState:`, newState)
      return newState
    })
  }, [noteId])

  // Revert optimistic update on error
  const revertOptimisticUpdate = useCallback((originalData: VoteData) => {
    setVoteData(originalData)
  }, [])

  const handleVote = useCallback(async (voteType: 'up' | 'down', event?: React.MouseEvent) => {
    console.log(`Vote button clicked - noteId: ${noteId}, voteType: ${voteType}, event:`, event)
    
    // Prevent any default behavior and event bubbling
    if (event) {
      event.preventDefault()
      event.stopPropagation()
      console.log(`Event prevented - noteId: ${noteId}, voteType: ${voteType}`)
    }

    if (!user) {
      console.log(`Vote blocked - no user - noteId: ${noteId}`)
      setError('Please sign in to vote')
      return
    }

    if (isLoading || pendingVote) {
      console.warn(`Vote blocked - isLoading: ${isLoading}, pendingVote: ${pendingVote}, noteId: ${noteId}`)
      return
    }

    console.log(`Starting vote - noteId: ${noteId}, voteType: ${voteType}, currentVote: ${voteData.userVote}, user: ${user.uid}`)

    // Store original state for potential revert
    const originalData = { ...voteData }
    
    // Apply optimistic update immediately
    applyOptimisticUpdate(voteType)
    setPendingVote(voteType)
    setError(null)

    try {
      // Make the actual API call
      const result = await voteOnNote(noteId, voteType)
      
      console.log(`Vote successful - noteId: ${noteId}, result:`, result)
      
      // Update with server response
      setVoteData({
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        userVote: result.userVote
      })
      try {
        if (user && typeof window !== 'undefined') {
          const raw = window.localStorage.getItem(`votesIndex:${user.uid}`)
          const parsed = raw ? JSON.parse(raw) : null
          let up: string[] = Array.isArray(parsed?.up) ? parsed.up : []
          let down: string[] = Array.isArray(parsed?.down) ? parsed.down : []
          up = up.filter((id) => id !== noteId)
          down = down.filter((id) => id !== noteId)
          if (result.userVote === 'up') up.push(noteId)
          else if (result.userVote === 'down') down.push(noteId)
          window.localStorage.setItem(`votesIndex:${user.uid}`, JSON.stringify({ up, down }))
        }
      } catch {}
      
      // Notify parent component
      try {
        onScoreUpdate?.(result)
      } catch (callbackErr) {
        console.error(`Vote callback error - noteId: ${noteId}:`, callbackErr)
        // Don't revert the vote if only the callback fails
      }
    } catch (err) {
      console.error(`Vote failed - noteId: ${noteId}, error:`, err)
      
      // Revert optimistic update on error
      revertOptimisticUpdate(originalData)
      
      const message = err instanceof Error ? err.message : 'Failed to vote. Please try again.'
      setError(message)
    } finally {
      setPendingVote(null)
    }
  }, [user, isLoading, pendingVote, noteId, voteData.userVote, applyOptimisticUpdate, revertOptimisticUpdate, onScoreUpdate])

  const netVotes = voteData.upvotes - voteData.downvotes
  const isVoting = pendingVote !== null
  
  const upButtonClasses = `${BUTTON_BASE} ${sizeConfig.buttonPadding} ${
    voteData.userVote === 'up' ? ACTIVE_UP_CLASSES : INACTIVE_UP_CLASSES
  } ${isVoting ? 'opacity-70' : 'hover:-translate-y-0.5'} ${pendingVote === 'up' ? 'scale-95' : ''}`
  
  const downButtonClasses = `${BUTTON_BASE} ${sizeConfig.buttonPadding} ${
    voteData.userVote === 'down' ? ACTIVE_DOWN_CLASSES : INACTIVE_DOWN_CLASSES
  } ${isVoting ? 'opacity-70' : 'hover:translate-y-0.5'} ${pendingVote === 'down' ? 'scale-95' : ''}`
  
  const netCountClasses = `${COUNT_BASE} ${sizeConfig.countPadding} ${sizeConfig.countText} ${
    netVotes > 0
      ? 'text-[#2a5014] bg-[#f5faeb] border-[#90c639]/30'
      : netVotes < 0
        ? 'text-rose-500 bg-rose-50 border-rose-200/60'
        : 'text-slate-500'
  }`

  return (
    <div className={`relative inline-flex ${className}`}>
      <div className={`${CONTAINER_BASE} ${sizeConfig.containerPadding} ${sizeConfig.gap}`}>
        {/* Upvote Button */}
        <button
          type="button"
          onClick={(e) => handleVote('up', e)}
          disabled={isVoting}
          className={upButtonClasses}
          aria-label={`Upvote ${netVotes > 0 ? netVotes : ''}`}
        >
          <ArrowBigUp
            className={`${sizeConfig.icon} ${voteData.userVote === 'up' ? 'fill-current' : ''} transition-transform duration-150 ${!isVoting ? 'hover:scale-110' : ''}`}
          />
          {showLabel && (
            <span className={`ml-1 font-medium ${sizeConfig.countText}`}>
              {voteData.upvotes}
            </span>
          )}
        </button>

        {/* Net Vote Count */}
        <div className={`${netCountClasses} min-w-[1.9rem]`}>
          {netVotes > 0 && '+'}{netVotes}
        </div>

        {/* Downvote Button */}
        <button
          type="button"
          onClick={(e) => handleVote('down', e)}
          disabled={isVoting}
          className={downButtonClasses}
          aria-label={`Downvote ${netVotes < 0 ? Math.abs(netVotes) : ''}`}
        >
          <ArrowBigDown
            className={`${sizeConfig.icon} ${voteData.userVote === 'down' ? 'fill-current' : ''} transition-transform duration-150 ${!isVoting ? 'hover:scale-110' : ''}`}
          />
          {showLabel && (
            <span className={`ml-1 font-medium ${sizeConfig.countText}`}>
              {voteData.downvotes}
            </span>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-lg z-10"
        >
          {error}
        </div>
      )}
    </div>
  )
}
