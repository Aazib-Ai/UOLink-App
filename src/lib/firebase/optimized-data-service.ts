import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot
} from 'firebase/firestore'
import { db } from './app'
import {
    dedupedFetch,
    batchFetchProfiles,
    cachedFetch,
    dataCache
} from './batch-operations'
import { mapNoteSnapshot } from './notes'
import type { Note } from '@/lib/data/note-types'

interface OptimizedQueryOptions {
    pageSize?: number
    enableCaching?: boolean
    cacheTTL?: number
    filters?: Record<string, any>
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

interface OptimizedQueryResult<T> {
    data: T[]
    hasMore: boolean
    lastDoc?: DocumentSnapshot
    totalFetched: number
    fromCache: boolean
}

class OptimizedDataService {
    private static instance: OptimizedDataService
    private requestQueue: Map<string, Promise<any>> = new Map()

    static getInstance(): OptimizedDataService {
        if (!OptimizedDataService.instance) {
            OptimizedDataService.instance = new OptimizedDataService()
        }
        return OptimizedDataService.instance
    }

    // Optimized notes fetching with intelligent caching
    async fetchNotes(options: OptimizedQueryOptions = {}): Promise<OptimizedQueryResult<Note>> {
        const {
            pageSize = 10,
            enableCaching = true,
            cacheTTL = 60000, // 1 minute
            filters = {},
            sortBy = 'uploadedAt',
            sortOrder = 'desc'
        } = options

        const cacheKey = this.generateCacheKey('notes', { filters, sortBy, sortOrder, pageSize })

        try {
            const fetchFn = async () => {
                const constraints: any[] = [orderBy(sortBy, sortOrder)]

                // Add filter constraints
                Object.entries(filters).forEach(([key, value]) => {
                    if (value && value !== '') {
                        constraints.push(where(key, '==', value))
                    }
                })

                const result = await dedupedFetch(
                    {
                        collection: 'notes',
                        constraints,
                        batchSize: pageSize,
                        maxBatches: 1
                    },
                    mapNoteSnapshot
                )

                return {
                    ...result,
                    fromCache: false
                }
            }

            const result = enableCaching
                ? await cachedFetch(cacheKey, fetchFn, cacheTTL)
                : await fetchFn()

            return result
        } catch (error) {
            console.error('Failed to fetch notes:', error)
            throw error
        }
    }

    // Batch fetch profiles for multiple contributors
    async fetchProfilesForNotes(notes: Note[]): Promise<Record<string, any>> {
        const contributorIds = notes
            .map(note => (typeof note.uploadedBy === 'string' ? note.uploadedBy : ''))
            .filter(Boolean)
            .filter((id, index, arr) => arr.indexOf(id) === index) // Remove duplicates

        if (contributorIds.length === 0) {
            return {}
        }

        const cacheKey = this.generateCacheKey('profiles', { contributors: contributorIds.sort() })

        try {
            const fetchFn = async () => {
                return await batchFetchProfiles(contributorIds)
            }

            return await cachedFetch(cacheKey, fetchFn, 300000) // 5 minutes cache for profiles
        } catch (error) {
            console.error('Failed to fetch profiles:', error)
            return {}
        }
    }

    // Optimized search with debouncing and caching
    async searchNotes(
        searchTerm: string,
        options: OptimizedQueryOptions = {}
    ): Promise<OptimizedQueryResult<Note>> {
        if (!searchTerm.trim()) {
            return this.fetchNotes(options)
        }

        const {
            pageSize = 20,
            enableCaching = true,
            cacheTTL = 30000, // 30 seconds for search results
            filters = {}
        } = options

        const cacheKey = this.generateCacheKey('search', {
            term: searchTerm.toLowerCase().trim(),
            filters,
            pageSize
        })

        try {
            const fetchFn = async () => {
                // Fetch a larger batch for client-side filtering
                const result = await this.fetchNotes({
                    ...options,
                    pageSize: pageSize * 3,
                    enableCaching: false // Don't double-cache
                })

                // Client-side search filtering
                const searchLower = searchTerm.toLowerCase()
                const filteredNotes = result.data.filter(note =>
                    (note.subject?.toLowerCase() || '').includes(searchLower) ||
                    (note.teacher?.toLowerCase() || '').includes(searchLower) ||
                    (note.contributorName?.toLowerCase() || '').includes(searchLower) ||
                    (note.materialType?.toLowerCase() || '').includes(searchLower) ||
                    (note.section?.toLowerCase() || '').includes(searchLower) ||
                    (note.name?.toLowerCase() || '').includes(searchLower)
                )

                return {
                    data: filteredNotes.slice(0, pageSize),
                    hasMore: filteredNotes.length > pageSize,
                    totalFetched: filteredNotes.length,
                    fromCache: false
                }
            }

            return enableCaching
                ? await cachedFetch(cacheKey, fetchFn, cacheTTL)
                : await fetchFn()
        } catch (error) {
            console.error('Failed to search notes:', error)
            throw error
        }
    }

    // Prefetch data for improved performance
    async prefetchData(notes: Note[]): Promise<void> {
        try {
            // Prefetch profiles in background
            this.fetchProfilesForNotes(notes).catch(error => {
                console.warn('Background profile prefetch failed:', error)
            })

            // Prefetch next page of notes if applicable
            // This could be implemented based on current filters
        } catch (error) {
            console.warn('Prefetch failed:', error)
        }
    }

    // Clear cache for specific patterns
    clearCache(pattern?: string): void {
        if (pattern) {
            // Clear specific cache entries matching pattern
            const keys = Array.from(dataCache['cache']?.keys() || [])
            keys.forEach(key => {
                if (key.includes(pattern)) {
                    dataCache['cache']?.delete(key)
                }
            })
        } else {
            dataCache.clear()
        }
    }

    // Generate consistent cache keys
    private generateCacheKey(type: string, params: Record<string, any>): string {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key]
                return result
            }, {} as Record<string, any>)

        return `${type}_${JSON.stringify(sortedParams)}`
    }

    // Get cache statistics
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: dataCache.size(),
            keys: Array.from(dataCache['cache']?.keys() || [])
        }
    }
}

export const optimizedDataService = OptimizedDataService.getInstance()
