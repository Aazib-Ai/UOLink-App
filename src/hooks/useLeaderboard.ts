import { useState, useEffect, useCallback, useRef } from 'react'
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { UserProfile } from '@/lib/data/types'

export interface LeaderboardUser extends UserProfile {
    totalNotes: number
    totalUpvotes: number
    totalSaves: number
    rank: number
}

type CacheEntry = { ts: number; data: LeaderboardUser[] }
const CACHE_KEY = 'leaderboard_top20_v1'
let memoryCache: CacheEntry | null = null

const readCache = (): CacheEntry | null => {
    if (memoryCache) return memoryCache
    try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as CacheEntry
        memoryCache = parsed
        return parsed
    } catch {
        return null
    }
}

const writeCache = (entry: CacheEntry) => {
    memoryCache = entry
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
    } catch { }
}

const isCacheValid = (entry: CacheEntry | null, ttlMs: number) => {
    if (!entry) return false
    return Date.now() - entry.ts < ttlMs
}

export const useLeaderboard = (limitCount = 10) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const refreshTimerRef = useRef<number | null>(null)
    const quickCheckTimerRef = useRef<number | null>(null)

    const refetch = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const profilesCollection = collection(db, 'profiles')
            const baseQuery = query(
                profilesCollection,
                orderBy('aura', 'desc'),
                limit(Math.max(20, limitCount))
            )
            const baseSnap = await getDocs(baseQuery)
            const baseProfiles = baseSnap.docs.map((profileDoc, index) => {
                const profileData = profileDoc.data() as UserProfile
                const totalNotes = typeof profileData.totalNotes === 'number' ? profileData.totalNotes : (typeof profileData.notesCount === 'number' ? profileData.notesCount : 0)
                const totalUpvotes = typeof profileData.totalUpvotes === 'number' ? profileData.totalUpvotes : 0
                const totalSaves = typeof profileData.totalSaves === 'number' ? profileData.totalSaves : 0
                return {
                    ...profileData,
                    id: profileDoc.id,
                    totalNotes,
                    totalUpvotes,
                    totalSaves,
                    rank: index + 1,
                    aura: profileData.aura || 0
                } as LeaderboardUser
            })

            const top20 = baseProfiles.slice(0, 20)
            writeCache({ ts: Date.now(), data: top20 })

            let combined = baseProfiles.slice(0, Math.min(limitCount, baseProfiles.length))
            if (limitCount > baseProfiles.length) {
                const minAura = baseProfiles.length > 0 ? baseProfiles[baseProfiles.length - 1].aura ?? 0 : 0
                const extraCount = limitCount - baseProfiles.length
                if (extraCount > 0) {
                    const extraQuery = query(
                        profilesCollection,
                        where('aura', '<=', minAura),
                        orderBy('aura', 'desc'),
                        limit(extraCount)
                    )
                    const extraSnap = await getDocs(extraQuery)
                    const extraProfiles = extraSnap.docs.map((profileDoc) => {
                        const profileData = profileDoc.data() as UserProfile
                        const totalNotes = typeof profileData.totalNotes === 'number' ? profileData.totalNotes : (typeof profileData.notesCount === 'number' ? profileData.notesCount : 0)
                        const totalUpvotes = typeof profileData.totalUpvotes === 'number' ? profileData.totalUpvotes : 0
                        const totalSaves = typeof profileData.totalSaves === 'number' ? profileData.totalSaves : 0
                        return {
                            ...profileData,
                            id: profileDoc.id,
                            totalNotes,
                            totalUpvotes,
                            totalSaves,
                            rank: 0,
                            aura: profileData.aura || 0
                        } as LeaderboardUser
                    })
                    const dedup = new Map<string, LeaderboardUser>()
                    for (const p of [...combined, ...extraProfiles]) dedup.set(p.id!, p)
                    combined = Array.from(dedup.values()).sort((a, b) => (b.aura || 0) - (a.aura || 0))
                }
            }

            combined = combined.map((p, i) => ({ ...p, rank: i + 1 }))
            setLeaderboard(combined)
        } catch (err) {
            console.error('Error refetching leaderboard:', err)
            setError('Failed to refresh leaderboard')
        } finally {
            setLoading(false)
        }
    }, [limitCount])

    useEffect(() => {
        const ttlMs = 15 * 60 * 1000
        const cache = readCache()
        if (isCacheValid(cache, ttlMs)) {
            const cached = cache!.data
            const base = cached.slice(0, Math.min(limitCount, cached.length))
            const ranked = base.map((p, i) => ({ ...p, rank: i + 1 }))
            setLeaderboard(ranked)
            setLoading(false)
            if (limitCount > cached.length) {
                const extraCount = limitCount - cached.length
                const minAura = cached.length > 0 ? cached[cached.length - 1].aura ?? 0 : 0
                const profilesCollection = collection(db, 'profiles')
                const extraQuery = query(
                    profilesCollection,
                    where('aura', '<=', minAura),
                    orderBy('aura', 'desc'),
                    limit(extraCount)
                )
                void getDocs(extraQuery).then(extraSnap => {
                    const extraProfiles = extraSnap.docs.map((profileDoc) => {
                        const profileData = profileDoc.data() as UserProfile
                        const totalNotes = typeof profileData.totalNotes === 'number' ? profileData.totalNotes : (typeof profileData.notesCount === 'number' ? profileData.notesCount : 0)
                        const totalUpvotes = typeof profileData.totalUpvotes === 'number' ? profileData.totalUpvotes : 0
                        const totalSaves = typeof profileData.totalSaves === 'number' ? profileData.totalSaves : 0
                        return {
                            ...profileData,
                            id: profileDoc.id,
                            totalNotes,
                            totalUpvotes,
                            totalSaves,
                            rank: 0,
                            aura: profileData.aura || 0
                        } as LeaderboardUser
                    })
                    const dedup = new Map<string, LeaderboardUser>()
                    for (const p of [...cached, ...extraProfiles]) dedup.set(p.id!, p)
                    const merged = Array.from(dedup.values()).sort((a, b) => (b.aura || 0) - (a.aura || 0))
                    setLeaderboard(merged.slice(0, limitCount).map((p, i) => ({ ...p, rank: i + 1 })))
                }).catch(() => { })
            }
        } else {
            setError(null)
            setLoading(true)
            void refetch()
        }

        const scheduleRefresh = () => {
            if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
            refreshTimerRef.current = window.setInterval(() => {
                void refetch()
            }, 10 * 60 * 1000)
        }

        const scheduleQuickCheck = () => {
            if (quickCheckTimerRef.current) window.clearInterval(quickCheckTimerRef.current)
            quickCheckTimerRef.current = window.setInterval(async () => {
                try {
                    const current = readCache()
                    const minAura = current && current.data.length > 0 ? current.data[current.data.length - 1].aura ?? 0 : 0
                    const profilesCollection = collection(db, 'profiles')
                    const qTop = query(
                        profilesCollection,
                        orderBy('aura', 'desc'),
                        limit(3)
                    )
                    const snap = await getDocs(qTop)
                    const changed = snap.docs.some(d => {
                        const pd = d.data() as UserProfile
                        return (pd.aura || 0) < minAura ? false : true
                    })
                    if (changed) {
                        await refetch()
                    }
                } catch { }
            }, 30 * 1000)
        }

        scheduleRefresh()
        scheduleQuickCheck()

        return () => {
            if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current)
            if (quickCheckTimerRef.current) window.clearInterval(quickCheckTimerRef.current)
        }
    }, [limitCount, refetch])

    return {
        leaderboard,
        loading,
        error,
        refetch
    }
}
