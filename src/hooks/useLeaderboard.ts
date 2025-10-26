import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
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

                // Enhance each profile with note statistics
                const enhancedProfiles = await Promise.all(
                    profilesSnapshot.docs.map(async (profileDoc, index) => {
                        const profileData = profileDoc.data() as UserProfile

                        // Get user's notes to calculate stats
                        const notesQuery = query(
                            collection(db, 'notes'),
                            where('uploadedBy', '==', profileDoc.id)
                        )
                        const notesSnapshot = await getDocs(notesQuery)

                        let totalUpvotes = 0
                        let totalSaves = 0

                        notesSnapshot.forEach((noteDoc) => {
                            const noteData = noteDoc.data()
                            totalUpvotes += noteData.upvoteCount || 0
                            totalSaves += noteData.saveCount || 0
                        })

                        return {
                            ...profileData,
                            id: profileDoc.id,
                            totalNotes: notesSnapshot.size,
                            totalUpvotes,
                            totalSaves,
                            rank: index + 1,
                            aura: profileData.aura || 0
                        } as LeaderboardUser
                    })
                )

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

            // Enhance each profile with note statistics
            const enhancedProfiles = await Promise.all(
                profilesSnapshot.docs.map(async (profileDoc, index) => {
                    const profileData = profileDoc.data() as UserProfile

                    // Get user's notes to calculate stats
                    const notesQuery = query(
                        collection(db, 'notes'),
                        where('uploadedBy', '==', profileDoc.id)
                    )
                    const notesSnapshot = await getDocs(notesQuery)

                    let totalUpvotes = 0
                    let totalSaves = 0

                    notesSnapshot.forEach((noteDoc) => {
                        const noteData = noteDoc.data()
                        totalUpvotes += noteData.upvoteCount || 0
                        totalSaves += noteData.saveCount || 0
                    })

                    return {
                        ...profileData,
                        id: profileDoc.id,
                        totalNotes: notesSnapshot.size,
                        totalUpvotes,
                        totalSaves,
                        rank: index + 1,
                        aura: profileData.aura || 0
                    } as LeaderboardUser
                })
            )

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