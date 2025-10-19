'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  TrendingUp,
  Calendar,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { toTitleCase } from '@/lib/utils'

interface UserNote {
  id: string
  name: string
  subject: string
  teacher: string
  semester: string
  section?: string
  materialType?: string
  materialSequence?: string | null
  contributorName: string
  fileUrl: string
  storageKey?: string
  fileSize?: number
  originalFileName?: string
  uploadedAt: string
  updatedAt?: string
}

// Cache for contribution data to avoid repeated queries
const contributionCache = new Map<string, { data: UserNote[], timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function ContributionHub() {
  const { user } = useAuth()
  const router = useRouter()
  const [userNotes, setUserNotes] = useState<UserNote[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Function to invalidate cache when new content is added
  const invalidateCache = useCallback(() => {
    if (user?.uid) {
      contributionCache.delete(user.uid)
    }
  }, [user?.uid])

  const getTimestampString = (value: unknown) => {
    if (typeof value === 'string') {
      return value
    }

    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString()
      } catch {
        return new Date().toISOString()
      }
    }

    return new Date().toISOString()
  }

  const formatDisplayDate = (isoString: string) => {
    if (!isoString) return 'Unknown date'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'Unknown date'
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(date)
  }

  const loadUserNotes = useCallback(async () => {
    if (!user?.uid) return

    // Check cache first
    const cacheKey = user.uid
    const cached = contributionCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setUserNotes(cached.data)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const notesRef = collection(db, 'notes')

      // Simplified query - prioritize user.uid for fastest lookup
      // We only need the count and last contribution, not all data
      const q = query(
        notesRef,
        where('uploadedBy', '==', user.uid),
        orderBy('uploadedAt', 'desc'),
        limit(50) // Limit to 50 most recent for better performance
      )

      let snapshot
      try {
        snapshot = await getDocs(q)
      } catch (error) {
        if (error instanceof FirebaseError && error.code === 'failed-precondition') {
          // Fallback query without ordering if index is missing
          console.warn('[ContributionHub] Missing Firestore index. Using fallback query.')
          const fallbackQuery = query(
            notesRef,
            where('uploadedBy', '==', user.uid),
            limit(50)
          )
          snapshot = await getDocs(fallbackQuery)
        } else {
          throw error
        }
      }

      const notes: UserNote[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const uploadedAtRaw = data.uploadedAt
        const updatedAtRaw = data.updatedAt

        return {
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name : 'Untitled note',
          subject: typeof data.subject === 'string' ? data.subject : '',
          teacher: typeof data.teacher === 'string' ? data.teacher : typeof data.module === 'string' ? data.module : '',
          semester: typeof data.semester === 'string' ? data.semester : '',
          section: typeof data.section === 'string' ? data.section : undefined,
          materialType: typeof data.materialType === 'string' ? data.materialType : undefined,
          materialSequence: typeof data.materialSequence === 'string' || typeof data.materialSequence === 'number'
            ? data.materialSequence.toString()
            : undefined,
          contributorName: typeof data.contributorName === 'string' ? data.contributorName : '',
          fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : '',
          storageKey: typeof data.storageKey === 'string' ? data.storageKey : undefined,
          fileSize: typeof data.fileSize === 'number' ? data.fileSize : undefined,
          originalFileName: typeof data.originalFileName === 'string' ? data.originalFileName : undefined,
          uploadedAt: getTimestampString(uploadedAtRaw),
          updatedAt: updatedAtRaw ? getTimestampString(updatedAtRaw) : undefined,
        }
      })

      // Update cache
      contributionCache.set(cacheKey, {
        data: notes,
        timestamp: Date.now()
      })

      setUserNotes(notes)
    } catch (notesError) {
      console.error('Error loading notes:', notesError)
      setError(notesError instanceof Error ? notesError.message : 'Failed to load your contributions.')
    } finally {
      setIsLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (user?.uid) {
      loadUserNotes()
    }
  }, [user?.uid, loadUserNotes])

  // Memoize computed values to prevent unnecessary recalculations
  const contributionStats = useMemo(() => {
    const totalContributions = userNotes.length
    const lastContribution = totalContributions > 0 ? userNotes[0] : null
    const lastContributionDate = lastContribution ? formatDisplayDate(lastContribution.updatedAt ?? lastContribution.uploadedAt) : null

    return {
      totalContributions,
      lastContributionDate,
      showActivityBadge: totalContributions > 1
    }
  }, [userNotes])

  const handleViewContributions = () => {
    router.push('/contributions')
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm">
        <p className="text-rose-700">Unable to load contributions: {error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Contributions</h3>
            <p className="text-xs text-gray-600">
              {isLoading ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              ) : (
                `${contributionStats.totalContributions} ${contributionStats.totalContributions === 1 ? 'note' : 'notes'} shared`
              )}
            </p>
          </div>
        </div>

        <button
          onClick={handleViewContributions}
          disabled={contributionStats.totalContributions === 0 || isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:border-gray-300 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {contributionStats.totalContributions > 0 && !isLoading && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-gray-500">
              <Calendar className="h-3 w-3" />
              Last activity: {contributionStats.lastContributionDate}
            </div>
            {contributionStats.showActivityBadge && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="h-3 w-3" />
                Active contributor
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
