'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  ClipboardCheck,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload
} from 'lucide-react'
import UploadModalLazy from './UploadModalLazy'
import { AuraDashboardContent } from './profile/edit/AuraDashboard'
import { useAuraStats } from '@/hooks/useAuraStats'
import { getAuraTier } from '@/lib/aura'

export default function ClientAura() {
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { auraStats, loading, error } = useAuraStats()

  const auraInfo = auraStats ? getAuraTier(auraStats.currentAura) : null

  const handleUploadClick = () => {
    setIsUploadModalOpen(true)
  }

  const handleShare = async () => {
    if (!auraStats) {
      return
    }

    const shareMessage = `My ${auraInfo?.tier.name ?? 'UOLink'} aura is at ${auraStats.currentAura} after sharing ${auraStats.totalNotes} notes.`
    const shareUrl = `${window.location.origin}/aura`

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out my UOLink aura',
          text: shareMessage,
          url: shareUrl
        })
        return
      } catch {
        // fall back to clipboard
      }
    }

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareMessage} ${shareUrl}`)
        window.alert('Link copied to clipboard')
        return
      } catch {
        // ignore clipboard failures
      }
    }

    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  const communityImpactScore = useMemo(() => {
    if (!auraStats) return 0
    const { totalUpvotes, totalSaves, totalNotes, totalDownvotes, reportImpact } = auraStats
    return (
      totalNotes * 10 +
      totalUpvotes * 2 +
      totalSaves * 5 -
      totalDownvotes * 3 -
      reportImpact.totalReports * 10
    )
  }, [auraStats])

  const approvalRate = useMemo(() => {
    if (!auraStats || auraStats.totalNotes === 0) return 0
    return Math.round((auraStats.totalUpvotes / auraStats.totalNotes) * 100)
  }, [auraStats])

  const saveRate = useMemo(() => {
    if (!auraStats || auraStats.totalNotes === 0) return 0
    return Math.round((auraStats.totalSaves / auraStats.totalNotes) * 100)
  }, [auraStats])

  return (
    <>
      <div className="space-y-6">
      
        <AuraDashboardContent
          auraStats={auraStats}
          loading={loading}
          error={error}
          onUploadClick={handleUploadClick}
          onBackClick={() => router.back()}
          showFullFeatures
        />

        {!loading && auraStats && auraStats.totalNotes > 0 && (
          <section className="space-y-4 rounded-3xl border border-lime-100 bg-white/95 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#1f2f10]">Impact snapshot</h3>
                <p className="text-sm text-[#4c5c3c] sm:text-base">
                  How the community is reacting to your uploads across saves, upvotes, and reports.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f7fbe9] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#334125] sm:px-4">
                <BarChart3 className="h-4 w-4 text-[#90c639]" />
                <span className="hidden sm:inline">Community impact score</span>
                <span className="sm:hidden">Impact score</span>
                <span className="text-[#90c639]">{communityImpactScore}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-lime-100 bg-[#f7fbe9]/70 p-4 sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-[#5f7050]">Approval rate</div>
                <div className="mt-3 text-2xl font-semibold text-[#1f2f10] sm:text-3xl">{approvalRate}%</div>
                <p className="mt-1 text-xs text-[#5f7050]">{auraStats.totalUpvotes} upvotes across {auraStats.totalNotes} notes</p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-900">Save rate</div>
                <div className="mt-3 text-2xl font-semibold text-blue-900 sm:text-3xl">{saveRate}%</div>
                <p className="mt-1 text-xs text-blue-900/70">{auraStats.totalSaves} saves so far</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">Credibility</div>
                <div className="mt-3 text-2xl font-semibold text-amber-900 sm:text-3xl">
                  {auraStats.averageCredibility > 0 ? `+${auraStats.averageCredibility}` : auraStats.averageCredibility}
                </div>
                <p className="mt-1 text-xs text-amber-900/70">Average per note score</p>
              </div>
            </div>

            <div className="rounded-2xl border border-lime-100 bg-[#f7fbe9]/80 px-5 py-4 text-sm text-[#334125]">
              <p className="font-semibold text-[#1f2f10]">What powers the score?</p>
              <p className="mt-1 text-xs text-[#5f7050]">
                Notes (+10) • Upvotes (+2) • Saves (+5) • Downvotes (-3) • Reports (-10)
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {auraStats.reportImpact.totalReports > 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-800 flex-shrink-0" />
                    <h4 className="text-base font-semibold text-red-800">Reports affecting aura</h4>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm text-red-800">
                    <div className="rounded-xl border border-red-200 bg-white px-3 py-4 text-center sm:px-4">
                      <p className="text-2xl font-bold text-red-600">{auraStats.reportImpact.totalReports}</p>
                      <p className="mt-1 text-xs">Total reports received</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-white px-3 py-4 text-center sm:px-4">
                      <p className="text-2xl font-bold text-red-600">
                        -{auraStats.reportImpact.auraLostToReports}
                      </p>
                      <p className="mt-1 text-xs">Aura lost to reports</p>
                    </div>
                  </div>
                  {auraStats.reportImpact.mostReportedNote && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-white px-3 py-3 text-sm text-red-800 sm:px-4">
                      <p className="font-semibold">Most reported note</p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="truncate text-sm">{auraStats.reportImpact.mostReportedNote.subject}</span>
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-600 whitespace-nowrap">
                          {auraStats.reportImpact.mostReportedNote.reportCount} reports
                        </span>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 flex items-start gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>Review flagged uploads, update any mistakes, and re-share to regain trust.</span>
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-800 flex-shrink-0" />
                    <h4 className="text-base font-semibold text-emerald-800">Clean reputation</h4>
                  </div>
                  <p className="mt-3 text-sm text-emerald-900">
                    Excellent work! None of your uploads have been reported. Keep shipping accurate, high-value notes to
                    maintain the streak.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm sm:px-4">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="truncate">Consistency keeps aura intact</span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-lime-100 bg-white/95 p-4 sm:p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                  <Sparkles className="h-5 w-5 text-[#90c639] flex-shrink-0" />
                  <h4 className="text-base font-semibold text-[#334125]">Share wins</h4>
                </div>
                <p className="mt-3 text-sm text-[#4c5c3c]">
                  Celebrate milestones with your study group. Spotlight the notes with the highest saves or credibility
                  to encourage more collaboration.
                </p>
                <button
                  onClick={handleShare}
                  className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-[#90c639] px-4 py-2 text-sm font-semibold text-[#1f2f10] transition hover:bg-[#f7fbe9]"
                >
                  <Share2 className="h-4 w-4" />
                  Share your progress
                </button>
              </div>
            </div>
          </section>
        )}

        {!loading && auraStats && auraStats.totalNotes === 0 && (
          <section className="rounded-3xl border border-lime-100 bg-white/95 p-6 sm:p-8 lg:p-10 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-[#f7fbe9] text-[#90c639]">
              <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" />
            </div>
            <h3 className="mt-4 sm:mt-6 text-2xl font-semibold text-[#1f2f10] sm:text-3xl">Ready to build your aura?</h3>
            <p className="mt-2 sm:mt-3 text-sm text-[#4c5c3c] sm:text-base px-2">
              Upload your first note to kick off your reputation. Quality uploads earn aura, help classmates, and unlock
              cosmetic badges across UOLink.
            </p>
            <div className="mt-6 sm:mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <button
                onClick={handleUploadClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#6da428] sm:px-6"
              >
                <Upload className="h-5 w-5" />
                Upload your first note
              </button>
              <button
                onClick={() => router.push('/about')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-lime-200 bg-white px-5 py-3 text-base font-semibold text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] sm:px-6"
              >
                Learn how aura works
              </button>
            </div>
          </section>
        )}

        {/* Floating action bar - appears when user has content */}
        {!loading && auraStats && auraStats.totalNotes > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-lime-100 bg-white/95 backdrop-blur-lg p-4 shadow-lg">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-center sm:gap-3">
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-lime-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                >
                  <Share2 className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Share</span>
                </button>
                <button
                  onClick={handleUploadClick}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6da428]"
                >
                  <Upload className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Upload</span>
                </button>
                <button
                  onClick={() => router.push('/leaderboard')}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-lime-200 bg-white px-3 py-2.5 text-xs font-semibold text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                >
                  <Trophy className="h-4 w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Leaderboard</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add padding to prevent content from being hidden behind floating bar */}
      {!loading && auraStats && auraStats.totalNotes > 0 && (
        <div className="h-20 sm:h-16" />
      )}

      <UploadModalLazy isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
    </>
  )
}
