import { useState, useEffect, useCallback, useRef } from 'react'
import { orderBy, where } from 'firebase/firestore'
import {
    dedupedFetch,
    batchFetchProfiles,
    cachedFetch,
    dataCache
} from '@/lib/firebase/batch-operations'
import { mapNoteSnapshot } from '@/lib/firebase/notes'
import type { Note } from '@/lib/data/note-types'

interface UseOptimizedNotesOptions {
    pageSize?: number
    enableCaching?: boolean
    prefetchProfiles?: boolean
    filters?: Record<string, any>
}

interface OptimizedNotesResult {
    notes: Note[]
    loading: boolean
    error: string | null
    hasMore: boolean
    loadMore: () => Promise<void>
    refresh: () => Promise<void>
    profileData: Record<string, any>
}

export function useOptimizedNotes(
    options: UseOptimizedNotesOptions = {}
): OptimizedNotesResult {
    const {
        pageSize = 10,
        enableCaching = true,
        prefetchProfiles = true,
        filters = {}
    } = options

    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(true)
    const [profileData, setProfileData] = useState<Record<string, any>>({})

    const lastDocRef = useRef<any>(null)
    const loadingRef = useRef(false)

    // Generate cache key based on filters
    const getCacheKey = useCallback((page: number = 0) => {
        return `notes_${JSON.stringify(filters)}_page_${page}`
    }, [filters])

    // Build query constraints from filters
    const buildConstraints = useCallback(() => {
        const constraints: any[] = [orderBy('uploadedAt', 'desc')]

        Object.entries(filters).forEach(([key, value]) => {
            if (value && value !== '') {
                constraints.push(where(key, '==', value))
            }
        })

        return constraints
    }, [filters])

    // Fetch notes with optimization
    const fetchNotes = useCallback(async (isLoadMore: boolean = false) => {
        if (loadingRef.current) return

        loadingRef.current = true
        setLoading(true)
        setError(null)

        try {
            const cacheKey = getCacheKey(isLoadMore ? 1 : 0)

            const fetchFn = async () => {
                const result = await dedupedFetch(
                    {
                        collection: 'notes',
                        constraints: buildConstraints(),
                        batchSize: pageSize,
                        maxBatches: 1
                    },
                    mapNoteSnapshot
                )
                return result
            }

            const result = enableCaching
                ? await cachedFetch(cacheKey, fetchFn, 60000) // 1 minute cache
                : await fetchFn()

            const newNotes = result.data

            if (isLoadMore) {
                setNotes(prev => [...prev, ...newNotes])
            } else {
                setNotes(newNotes)
            }

            setHasMore(result.hasMore)
            lastDocRef.current = result.lastDoc

            // Prefetch profile data if enabled
            if (prefetchProfiles && newNotes.length > 0) {
                const contributorIds = newNotes
                    .map(note => (typeof note.uploadedBy === 'string' ? note.uploadedBy : ''))
                    .filter(Boolean)

                if (contributorIds.length > 0) {
                    try {
                        const profiles = await batchFetchProfiles(contributorIds)
                        setProfileData(prev => ({ ...prev, ...profiles }))
                    } catch (profileError) {
                        console.warn('Failed to fetch profiles:', profileError)
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch notes:', err)
            setError(err instanceof Error ? err.message : 'Failed to fetch notes')
        } finally {
            setLoading(false)
            loadingRef.current = false
        }
    }, [pageSize, enableCaching, prefetchProfiles, getCacheKey, buildConstraints])

    // Load more notes
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingRef.current) return
        await fetchNotes(true)
    }, [hasMore, fetchNotes])

    // Refresh notes
    const refresh = useCallback(async () => {
        // Clear cache for this query
        if (enableCaching) {
            dataCache.clear()
        }

        lastDocRef.current = null
        setNotes([])
        setHasMore(true)
        await fetchNotes(false)
    }, [enableCaching, fetchNotes])

    // Initial load and filter changes
    useEffect(() => {
        lastDocRef.current = null
        setNotes([])
        setHasMore(true)
        fetchNotes(false)
    }, [filters]) // Re-fetch when filters change

    return {
        notes,
        loading,
        error,
        hasMore,
        loadMore,
        refresh,
        profileData
    }
}
