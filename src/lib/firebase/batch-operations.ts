import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot,
    QueryConstraint
} from 'firebase/firestore'
import { db } from './app'

interface BatchRequestConfig {
    collection: string
    constraints?: QueryConstraint[]
    batchSize?: number
    maxBatches?: number
}

interface BatchResult<T> {
    data: T[]
    hasMore: boolean
    lastDoc?: DocumentSnapshot
    totalFetched: number
}

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>()
const CACHE_TTL = 5000 // 5 seconds

// Generate cache key for requests
function generateCacheKey(config: BatchRequestConfig): string {
    return JSON.stringify({
        collection: config.collection,
        constraints: config.constraints?.map(c => c.toString()) || [],
        batchSize: config.batchSize || 10
    })
}

// Deduplicated fetch function
export async function dedupedFetch<T>(
    config: BatchRequestConfig,
    mapper: (doc: any) => T
): Promise<BatchResult<T>> {
    const cacheKey = generateCacheKey(config)

    // Check if request is already in progress
    if (requestCache.has(cacheKey)) {
        return requestCache.get(cacheKey)!
    }

    // Create new request
    const requestPromise = performBatchFetch(config, mapper)

    // Cache the promise
    requestCache.set(cacheKey, requestPromise)

    // Clear cache after TTL
    setTimeout(() => {
        requestCache.delete(cacheKey)
    }, CACHE_TTL)

    return requestPromise
}

// Core batch fetching logic
async function performBatchFetch<T>(
    config: BatchRequestConfig,
    mapper: (doc: any) => T
): Promise<BatchResult<T>> {
    const {
        collection: collectionName,
        constraints = [],
        batchSize = 10,
        maxBatches = 5
    } = config

    const collectionRef = collection(db, collectionName)
    let allData: T[] = []
    let lastDoc: DocumentSnapshot | undefined
    let batchCount = 0
    let hasMore = true

    try {
        while (hasMore && batchCount < maxBatches) {
            const queryConstraints = [...constraints]

            if (lastDoc) {
                queryConstraints.push(startAfter(lastDoc))
            }

            queryConstraints.push(limit(batchSize))

            const q = query(collectionRef, ...queryConstraints)
            const snapshot = await getDocs(q)

            if (snapshot.empty) {
                hasMore = false
                break
            }

            // Map documents to desired format
            const batchData = snapshot.docs.map(mapper)
            allData = [...allData, ...batchData]

            // Update pagination
            lastDoc = snapshot.docs[snapshot.docs.length - 1]
            hasMore = snapshot.docs.length === batchSize
            batchCount++
        }

        return {
            data: allData,
            hasMore: hasMore && batchCount >= maxBatches,
            lastDoc,
            totalFetched: allData.length
        }
    } catch (error) {
        console.error('Batch fetch error:', error)
        throw error
    }
}

// Batch multiple different requests
export async function batchMultipleRequests<T>(
    requests: Array<{
        config: BatchRequestConfig
        mapper: (doc: any) => T
        key: string
    }>
): Promise<Record<string, BatchResult<T>>> {
    try {
        const promises = requests.map(async ({ config, mapper, key }) => {
            const result = await dedupedFetch(config, mapper)
            return { key, result }
        })

        const results = await Promise.allSettled(promises)
        const batchResults: Record<string, BatchResult<T>> = {}

        results.forEach((result, index) => {
            const request = requests[index]
            if (result.status === 'fulfilled') {
                batchResults[result.value.key] = result.value.result
            } else {
                console.error(`Batch request failed for ${request.key}:`, result.reason)
                // Provide empty result for failed requests
                batchResults[request.key] = {
                    data: [],
                    hasMore: false,
                    totalFetched: 0
                }
            }
        })

        return batchResults
    } catch (error) {
        console.error('Batch multiple requests error:', error)
        throw error
    }
}

// Optimized profile data fetching
export async function batchFetchProfiles(
    contributorIds: string[]
): Promise<Record<string, any>> {
    if (contributorIds.length === 0) {
        return {}
    }

    const uniqueIds = [...new Set(contributorIds.filter(Boolean))]
    if (uniqueIds.length === 0) {
        return {}
    }

    try {
        const profiles: Record<string, any> = {}

        const sorted = [...uniqueIds].sort()
        const cacheKey = `profiles:batch:${sorted.join(',')}`

        if ((requestCache as Map<string, Promise<any>>).has(cacheKey)) {
            return await (requestCache as Map<string, Promise<any>>).get(cacheKey)!
        }

        const fetchFn = async () => {
        const CHUNK_SIZE = 5
        for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
            const chunk = uniqueIds.slice(i, i + CHUNK_SIZE)
            const docs = await Promise.all(
                chunk.map(async (userId) => {
                    const profileRef = doc(db, 'profiles', userId)
                    const snapshot = await getDoc(profileRef)
                    if (!snapshot.exists()) {
                        return null
                    }
                    return {
                        id: userId,
                        data: snapshot.data()
                    }
                })
            )

            docs.forEach(entry => {
                if (entry) {
                    profiles[entry.id] = {
                        id: entry.id,
                        ...entry.data
                    }
                }
            })
        }
        return profiles
        }

        const promise = cachedFetch(cacheKey, fetchFn, 300000)
        ;(requestCache as Map<string, Promise<any>>).set(cacheKey, promise)
        setTimeout(() => {
            (requestCache as Map<string, Promise<any>>).delete(cacheKey)
        }, CACHE_TTL)
        return await promise
    } catch (error) {
        console.error('Batch fetch profiles error:', error)
        return {}
    }
}

// Cache for frequently accessed data
class DataCache {
    private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()

    set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        })
    }

    get(key: string): any | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key)
            return null
        }

        return entry.data
    }

    clear(): void {
        this.cache.clear()
    }

    size(): number {
        return this.cache.size
    }
}

export const dataCache = new DataCache()

// Cached fetch wrapper
export async function cachedFetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300000
): Promise<T> {
    // Check cache first
    const cached = dataCache.get(cacheKey)
    if (cached !== null) {
        return cached
    }

    // Fetch and cache
    const data = await fetchFn()
    dataCache.set(cacheKey, data, ttl)
    return data
}
