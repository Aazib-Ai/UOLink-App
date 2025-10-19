'use client'

import { useState, useEffect } from 'react'
import { ArrowBigUp, ArrowBigDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { db, voteOnNote } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

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
  vibeScore: number
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

export default function VoteButton({
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

  const sizeConfig = SIZE_CONFIGS[size]

  // Fetch vote data when component mounts
  useEffect(() => {
    const fetchVoteData = async () => {
      if (!noteId) return

      try {
        // Get note vote document
        const noteVoteRef = doc(db, 'noteVotes', noteId)
        const noteVoteSnap = await getDoc(noteVoteRef)

        let upvotes = 0
        let downvotes = 0

        if (noteVoteSnap.exists()) {
          const data = noteVoteSnap.data()
          upvotes = data.upvotes || 0
          downvotes = data.downvotes || 0
        }

        // Check if user has voted
        let userVote: 'up' | 'down' | null = null
        if (user) {
          const userVoteRef = doc(db, 'userVotes', user.uid, 'votes', noteId)
          const userVoteSnap = await getDoc(userVoteRef)

          if (userVoteSnap.exists()) {
            const userData = userVoteSnap.data()
            userVote = userData.voteType as 'up' | 'down'
          }
        }

        setVoteData({
          upvotes,
          downvotes,
          userVote
        })
      } catch (err) {
        console.error('Error fetching vote data:', err)
        setError('Failed to load vote data')
      }
    }

    fetchVoteData()
  }, [noteId, user])

  useEffect(() => {
    if (!error) {
      return
    }

    const timeoutId = window.setTimeout(() => setError(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [error])

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user) {
      setError('Please sign in to vote')
      return
    }

    if (isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await voteOnNote(noteId, voteType)
      setVoteData({
        upvotes: result.upvotes,
        downvotes: result.downvotes,
        userVote: result.userVote
      })
      onScoreUpdate?.(result)
    } catch (err) {
      console.error('Error voting:', err)
      const message = err instanceof Error && err.message ? err.message : 'Failed to vote. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const netVotes = voteData.upvotes - voteData.downvotes
  const upButtonClasses = `${BUTTON_BASE} ${sizeConfig.buttonPadding} ${
    voteData.userVote === 'up' ? ACTIVE_UP_CLASSES : INACTIVE_UP_CLASSES
  } ${isLoading ? 'opacity-60' : 'hover:-translate-y-0.5'}`
  const downButtonClasses = `${BUTTON_BASE} ${sizeConfig.buttonPadding} ${
    voteData.userVote === 'down' ? ACTIVE_DOWN_CLASSES : INACTIVE_DOWN_CLASSES
  } ${isLoading ? 'opacity-60' : 'hover:translate-y-0.5'} focus-visible:ring-rose-200`
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
          onClick={() => handleVote('up')}
          disabled={isLoading}
          className={upButtonClasses}
          aria-label={`Upvote ${netVotes > 0 ? netVotes : ''}`}
        >
          <ArrowBigUp
            className={`${sizeConfig.icon} ${voteData.userVote === 'up' ? 'fill-current' : ''} transition-transform duration-150 ${isLoading ? '' : 'hover:scale-110'}`}
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
          onClick={() => handleVote('down')}
          disabled={isLoading}
          className={downButtonClasses}
          aria-label={`Downvote ${netVotes < 0 ? Math.abs(netVotes) : ''}`}
        >
          <ArrowBigDown
            className={`${sizeConfig.icon} ${voteData.userVote === 'down' ? 'fill-current' : ''} transition-transform duration-150 ${isLoading ? '' : 'hover:scale-110'}`}
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
          className="absolute bottom-full left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-lg"
        >
          {error}
        </div>
      )}
    </div>
  )
}
