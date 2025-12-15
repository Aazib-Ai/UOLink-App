import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { db } from '@/lib/firebase'

export interface AuraStats {
    totalNotes: number
    totalUpvotes: number
    totalSaves: number
    totalDownvotes: number
    totalReports: number
    averageCredibility: number
    currentAura: number
    recentActivity: {
        notesThisWeek: number
        auraGainedThisWeek: number
    }
    topNote: {
        subject: string
        credibilityScore: number
    } | null
    reportImpact: {
        totalReports: number
        auraLostToReports: number
        mostReportedNote: {
            subject: string
            reportCount: number
        } | null
    }
}

export const useAuraStats = () => {
  const { user } = useAuth()
  const [auraStats, setAuraStats] = useState<AuraStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchAuraStats = async () => {
      if (!user?.uid) {
        if (isMounted) {
          setLoading(false)
          setAuraStats(null)
        }
        return
      }

      try {
        setError(null)

        const profileRef = doc(db, 'profiles', user.uid)
        const notesQuery = query(
          collection(db, 'notes'),
          where('uploadedBy', '==', user.uid)
        )
        const [profileSnap] = await Promise.all([
          getDoc(profileRef)
        ])

        if (!isMounted) {
          return
        }

        const profileData = profileSnap.exists() ? profileSnap.data() || {} : {}
        const currentAura = Number(profileData.aura || 0)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        // Read denormalized stats from profile document if available
        const hasDenorm = Object.prototype.hasOwnProperty.call(profileData, 'totalNotes')
        let denorm = {
          totalNotes: Number((profileData as any).totalNotes ?? (profileData as any).notesCount ?? 0),
          totalUpvotes: Number((profileData as any).totalUpvotes ?? 0),
          totalSaves: Number((profileData as any).totalSaves ?? 0),
          totalDownvotes: Number((profileData as any).totalDownvotes ?? 0),
          totalReports: Number((profileData as any).totalReports ?? 0),
          averageCredibility: Number((profileData as any).averageCredibility ?? 0),
        }

        // Fetch only last 10 notes for top-note and recent activity
        let recentSnap
        try {
          const recentQuery = query(
            collection(db, 'notes'),
            where('uploadedBy', '==', user.uid),
            orderBy('uploadedAt', 'desc'),
            limit(10)
          )
          recentSnap = await getDocs(recentQuery)
        } catch (recentErr) {
          if (recentErr instanceof FirebaseError && recentErr.code === 'failed-precondition') {
            const fallbackQuery = query(
              collection(db, 'notes'),
              where('uploadedBy', '==', user.uid),
              limit(10)
            )
            recentSnap = await getDocs(fallbackQuery)
          } else {
            throw recentErr
          }
        }
        const lastTenDocs = recentSnap.docs

        const recentAgg = lastTenDocs.reduce(
          (acc, noteDoc) => {
            const data = noteDoc.data()
            const credibility = Number(data.credibilityScore) || 0
            const subject = typeof data.subject === 'string' ? data.subject : 'Unknown'
            const uploadedAtRaw = data.uploadedAt
            const uploadedAt =
              typeof uploadedAtRaw?.toDate === 'function'
                ? uploadedAtRaw.toDate()
                : uploadedAtRaw instanceof Date
                ? uploadedAtRaw
                : new Date(0)

            if (credibility > acc.maxCredibility) {
              acc.maxCredibility = credibility
              acc.topNote = { subject, credibilityScore: credibility }
            }

            if (uploadedAt > oneWeekAgo) {
              acc.notesThisWeek += 1
            }

            return acc
          },
          {
            maxCredibility: -Infinity,
            notesThisWeek: 0,
            topNote: null as AuraStats['topNote'],
          }
        )
        let auraStatsPayload: AuraStats = {
          totalNotes: denorm.totalNotes,
          totalUpvotes: denorm.totalUpvotes,
          totalSaves: denorm.totalSaves,
          totalDownvotes: denorm.totalDownvotes,
          totalReports: denorm.totalReports,
          averageCredibility: Math.round(denorm.averageCredibility * 10) / 10,
          currentAura,
          recentActivity: {
            notesThisWeek: recentAgg.notesThisWeek,
            auraGainedThisWeek: recentAgg.notesThisWeek * 10
          },
          topNote: recentAgg.topNote,
          reportImpact: {
            totalReports: denorm.totalReports,
            auraLostToReports: denorm.totalReports * 10,
            mostReportedNote: null
          }
        }

        if (!hasDenorm) {
          const allNotesSnap = await getDocs(notesQuery)
          const totals = allNotesSnap.docs.reduce(
            (acc, noteDoc) => {
              const data = noteDoc.data()
              const upvotes = Number(data.upvoteCount) || 0
              const downvotes = Number(data.downvoteCount) || 0
              const saves = Number(data.saveCount) || 0
              const reports = Number(data.reportCount) || 0
              const credibility = Number(data.credibilityScore) || 0
              return {
                totalUpvotes: acc.totalUpvotes + upvotes,
                totalDownvotes: acc.totalDownvotes + downvotes,
                totalSaves: acc.totalSaves + saves,
                totalReports: acc.totalReports + reports,
                totalCredibility: acc.totalCredibility + credibility,
              }
            },
            { totalUpvotes: 0, totalDownvotes: 0, totalSaves: 0, totalReports: 0, totalCredibility: 0 }
          )
          const totalNotes = allNotesSnap.size
          const averageCredibility = totalNotes > 0 ? totals.totalCredibility / totalNotes : 0
          auraStatsPayload = {
            ...auraStatsPayload,
            totalNotes,
            totalUpvotes: totals.totalUpvotes,
            totalSaves: totals.totalSaves,
            totalDownvotes: totals.totalDownvotes,
            totalReports: totals.totalReports,
            averageCredibility: Math.round(averageCredibility * 10) / 10,
          }
        }

        setAuraStats(auraStatsPayload)
      } catch (err) {
        console.error('Error fetching aura stats:', err)
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load aura stats')
          setAuraStats({
            totalNotes: 0,
            totalUpvotes: 0,
            totalSaves: 0,
            totalDownvotes: 0,
            totalReports: 0,
            averageCredibility: 0,
            currentAura: 0,
            recentActivity: {
              notesThisWeek: 0,
              auraGainedThisWeek: 0
            },
            topNote: null,
            reportImpact: {
              totalReports: 0,
              auraLostToReports: 0,
              mostReportedNote: null
            }
          })
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    setLoading(true)
    fetchAuraStats()

    return () => {
      isMounted = false
    }
  }, [user?.uid])

  const refetch = () => {
    setLoading(true)
    // Trigger the effect again by toggling the dependency through state
  }

  return {
    auraStats,
    loading,
    error,
    refetch
  }
}
