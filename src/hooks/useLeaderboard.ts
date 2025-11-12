import { useState, useEffect, useCallback } from 'react'
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { UserProfile } from '@/lib/data/types'

export interface LeaderboardUser extends UserProfile {
    totalNotes: number
    totalUpvotes: number
    totalSaves: number
    rank: number
}

export const useLeaderboard = (limitCount = 10) => {
    const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchEnhancedLeaderboard = async () => {
            try {
                setError(null)

                // Get top users by aura
                const profilesCollection = collection(db, 'profiles')
                const leaderboardQuery = query(
                    profilesCollection,
                    orderBy('aura', 'desc'),
                    limit(limitCount)
                )
                const profilesSnapshot = await getDocs(leaderboardQuery)

                // Enhance each profile using denormalized counts to avoid per-user note reads
                const enhancedProfiles = profilesSnapshot.docs.map((profileDoc, index) => {
                    const profileData = profileDoc.data() as UserProfile
                    const totalNotes = typeof profileData.notesCount === 'number' ? profileData.notesCount : 0
                    const totalUpvotes = 0
                    const totalSaves = 0

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

                setLeaderboard(enhancedProfiles)
            } catch (err) {
                console.error('Error fetching enhanced leaderboard:', err)
                setError('Failed to load leaderboard')
            } finally {
                setLoading(false)
            }
        }

        fetchEnhancedLeaderboard()
    }, [limitCount])

    const refetch = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            // Get top users by aura
            const profilesCollection = collection(db, 'profiles')
            const leaderboardQuery = query(
                profilesCollection,
                orderBy('aura', 'desc'),
                limit(limitCount)
            )
            const profilesSnapshot = await getDocs(leaderboardQuery)

            // Enhance each profile using denormalized counts
            const enhancedProfiles = profilesSnapshot.docs.map((profileDoc, index) => {
                const profileData = profileDoc.data() as UserProfile
                const totalNotes = typeof profileData.notesCount === 'number' ? profileData.notesCount : 0
                const totalUpvotes = 0
                const totalSaves = 0

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

            setLeaderboard(enhancedProfiles)
        } catch (err) {
            console.error('Error refetching leaderboard:', err)
            setError('Failed to refresh leaderboard')
        } finally {
            setLoading(false)
        }
    }, [limitCount])

    return {
        leaderboard,
        loading,
        error,
        refetch
    }
}
