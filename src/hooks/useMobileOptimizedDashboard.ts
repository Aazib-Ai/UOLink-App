import { useState, useEffect, useCallback, useMemo } from 'react'
import { optimizedDataService } from '@/lib/firebase/optimized-data-service'
import { performanceMonitor } from '@/lib/performance/mobile-performance-monitor'
import type { Note } from '@/lib/data/note-types'

interface DashboardFilters {
    subject?: string
    teacher?: string
    semester?: string
    section?: string
    materialType?: string
    materialSequence?: string
    searchTerm?: string
}

interface UseMobileOptimizedDashboardOptions {
    pageSize?: number
    enableCaching?: boolean
    enablePrefetch?: boolean
    enablePerformanceMonitoring?: boolean
}

interface MobileOptimizedDashboardState {
    notes: Note[]
    profileData: Record<string, any>
    loading: boolean
    error: string | null
    hasMore: boolean
    filters: DashboardFilters
    performanceMetrics?: Record<string, any>
}

interface MobileOptimizedDashboardActions {
    setFilters: (filters: Partial<DashboardFilters>) => void
    loadMore: () => Promise<void>
    refresh: () => Promise<void>
    search: (term: string) => Promise<void>
    clearCache: () => void
    getPerformanceReport: () => Record<string, any>
}

export function useMobileOptimizedDashboard(
    options: UseMobileOptimizedDashboardOptions = {}
): [MobileOptimizedDashboardState, MobileOptimizedDashboardActions] {
    const {
        pageSize = 10,
        enableCaching = true,
        enablePrefetch = true,
        enablePerformanceMonitoring = true
    } = options

    // State
    const [notes, setNotes] = useState<Note[]>([])
    const [profileData, setProfileData] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hasMore, setHasMore] = useState(true)
    const [filters, setFiltersState] = useState<DashboardFilters>({})
    const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, any>>({})

    // Initialize performance monitoring
    useEffect(() => {
        if (enablePerformanceMonitoring) {
            performanceMonitor.init()
        }
    }, [enablePerformanceMonitoring])

    // Memoized filter object for API calls
    const apiFilters = useMemo(() => {
        const { searchTerm, ...restFilters } = filters
        return Object.fromEntries(
            Object.entries(restFilters).filter(([_, value]) => value && value !== '')
        )
    }, [filters])

    // Load notes with performance monitoring
    const loadNotes = useCallback(async (isLoadMore: boolean = false, searchTerm?: string) => {
        if (loading && isLoadMore) return // Prevent concurrent loads

        setLoading(true)
        setError(null)

        try {
            const operation = async () => {
                if (searchTerm) {
                    return await optimizedDataService.searchNotes(searchTerm, {
                        pageSize,
                        enableCaching,
                        filters: apiFilters
                    })
                } else {
                    return await optimizedDataService.fetchNotes({
                        pageSize,
                        enableCaching,
                        filters: apiFilters
                    })
                }
            }

            const result = enablePerformanceMonitoring
                ? await performanceMonitor.measureOperation('fetchNotes', operation)
                : await operation()

            const newNotes = result.data

            if (isLoadMore) {
                setNotes(prev => [...prev, ...newNotes])
            } else {
                setNotes(newNotes)
            }

            setHasMore(result.hasMore)

            // Fetch profiles for new notes
            if (newNotes.length > 0) {
                const profileOperation = async () => {
                    return await optimizedDataService.fetchProfilesForNotes(newNotes)
                }

                const profiles = enablePerformanceMonitoring
                    ? await performanceMonitor.measureOperation('fetchProfiles', profileOperation)
                    : await profileOperation()

                setProfileData(prev => ({ ...prev, ...profiles }))

                // Prefetch next batch if enabled
                if (enablePrefetch && result.hasMore) {
                    optimizedDataService.prefetchData(newNotes).catch(console.warn)
                }
            }

            // Update performance metrics
            if (enablePerformanceMonitoring) {
                setPerformanceMetrics(performanceMonitor.getPerformanceSummary())
            }

        } catch (err) {
            console.error('Failed to load notes:', err)
            setError(err instanceof Error ? err.message : 'Failed to load notes')
        } finally {
            setLoading(false)
        }
    }, [loading, pageSize, enableCaching, apiFilters, enablePerformanceMonitoring, enablePrefetch])

    // Set filters and reload
    const setFilters = useCallback((newFilters: Partial<DashboardFilters>) => {
        setFiltersState(prev => ({ ...prev, ...newFilters }))
    }, [])

    // Load more notes
    const loadMore = useCallback(async () => {
        if (!hasMore || loading) return
        await loadNotes(true, filters.searchTerm)
    }, [hasMore, loading, loadNotes, filters.searchTerm])

    // Refresh notes
    const refresh = useCallback(async () => {
        setNotes([])
        setHasMore(true)
        await loadNotes(false, filters.searchTerm)
    }, [loadNotes, filters.searchTerm])

    // Search notes
    const search = useCallback(async (term: string) => {
        setFiltersState(prev => ({ ...prev, searchTerm: term }))
        setNotes([])
        setHasMore(true)
        await loadNotes(false, term)
    }, [loadNotes])

    // Clear cache
    const clearCache = useCallback(() => {
        optimizedDataService.clearCache()
    }, [])

    // Get performance report
    const getPerformanceReport = useCallback(() => {
        return {
            ...performanceMonitor.getPerformanceSummary(),
            cacheStats: optimizedDataService.getCacheStats(),
            notesCount: notes.length,
            profilesCount: Object.keys(profileData).length
        }
    }, [notes.length, profileData])

    // Load initial data when filters change
    useEffect(() => {
        if (!filters.searchTerm) {
            loadNotes(false)
        }
    }, [apiFilters]) // Only reload when non-search filters change

    // State object
    const state: MobileOptimizedDashboardState = {
        notes,
        profileData,
        loading,
        error,
        hasMore,
        filters,
        performanceMetrics: enablePerformanceMonitoring ? performanceMetrics : undefined
    }

    // Actions object
    const actions: MobileOptimizedDashboardActions = {
        setFilters,
        loadMore,
        refresh,
        search,
        clearCache,
        getPerformanceReport
    }

    return [state, actions]
}