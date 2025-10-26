import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
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
        const notesQuery = query(collection(db, 'notes'), where('uploadedBy', '==', user.uid))

        const [profileSnap, notesSnap] = await Promise.all([
          getDoc(profileRef),
          getDocs(notesQuery)
        ])

        if (!isMounted) {
          return
        }

        const currentAura = profileSnap.exists() ? (profileSnap.data().aura ?? 0) : 0
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const totals = notesSnap.docs.reduce(
          (acc, noteDoc) => {
            const data = noteDoc.data()

            const upvotes = Number(data.upvoteCount) || 0
            const downvotes = Number(data.downvoteCount) || 0
            const saves = Number(data.saveCount) || 0
            const reports = Number(data.reportCount) || 0
            const credibility = Number(data.credibilityScore) || 0
            const subject = typeof data.subject === 'string' ? data.subject : 'Unknown'
            const uploadedAtRaw = data.uploadedAt
            const uploadedAt =
              typeof uploadedAtRaw?.toDate === 'function'
                ? uploadedAtRaw.toDate()
                : uploadedAtRaw instanceof Date
                ? uploadedAtRaw
                : new Date(0)

            acc.totalUpvotes += upvotes
            acc.totalDownvotes += downvotes
            acc.totalSaves += saves
            acc.totalReports += reports
            acc.totalCredibility += credibility

            if (credibility > acc.maxCredibility) {
              acc.maxCredibility = credibility
              acc.topNote = { subject, credibilityScore: credibility }
            }

            if (reports > acc.maxReports) {
              acc.maxReports = reports
              acc.mostReportedNote = { subject, reportCount: reports }
            }

            if (uploadedAt > oneWeekAgo) {
              acc.notesThisWeek += 1
            }

            return acc
          },
          {
            totalUpvotes: 0,
            totalDownvotes: 0,
            totalSaves: 0,
            totalReports: 0,
            totalCredibility: 0,
            maxCredibility: -Infinity,
            maxReports: 0,
            notesThisWeek: 0,
            topNote: null as AuraStats['topNote'],
            mostReportedNote: null as AuraStats['reportImpact']['mostReportedNote']
          }
        )

        const totalNotes = notesSnap.size
        const averageCredibility = totalNotes > 0 ? totals.totalCredibility / totalNotes : 0
        const auraStatsPayload: AuraStats = {
          totalNotes,
          totalUpvotes: totals.totalUpvotes,
          totalSaves: totals.totalSaves,
          totalDownvotes: totals.totalDownvotes,
          totalReports: totals.totalReports,
          averageCredibility: Math.round(averageCredibility * 10) / 10,
          currentAura,
          recentActivity: {
            notesThisWeek: totals.notesThisWeek,
            auraGainedThisWeek: totals.notesThisWeek * 10
          },
          topNote: totals.topNote,
          reportImpact: {
            totalReports: totals.totalReports,
            auraLostToReports: totals.totalReports * 10,
            mostReportedNote: totals.maxReports > 0 ? totals.mostReportedNote : null
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
