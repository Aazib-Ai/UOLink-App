'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Share2, Download, Trophy } from 'lucide-react'
import AuraDashboard from './profile/edit/AuraDashboard'
import { useAuraStats } from '@/hooks/useAuraStats'
import { getAuraTier } from '@/lib/aura'
import { useState } from 'react'
import UploadModalLazy from './UploadModalLazy'

// Client component for interactive aura functionality
export default function ClientAura() {
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { auraStats, loading } = useAuraStats()

  const auraInfo = auraStats ? getAuraTier(auraStats.currentAura) : null

  const handleUploadClick = () => {
    setIsUploadModalOpen(true)
  }

  const handleShare = async () => {
    if (navigator.share && auraStats) {
      try {
        await navigator.share({
          title: `Check out my ${auraInfo?.tier.name} aura!`,
          text: `I've got ${auraStats.currentAura} aura points from sharing ${auraStats.totalNotes} helpful notes! 🔥`,
          url: window.location.origin + '/aura'
        })
      } catch (err) {
        // Fallback to clipboard
        navigator.clipboard.writeText(
          `Check out my ${auraInfo?.tier.name} aura! I've got ${auraStats.currentAura} aura points from sharing ${auraStats.totalNotes} helpful notes! 🔥 ${window.location.origin}`
        )
      }
    }
  }

  return (
    <>
      {/* Interactive Header Controls */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {!loading && auraStats && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-6 py-3 text-sm font-semibold text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
          >
            <Share2 className="h-4 w-4" />
            Share My Aura
          </button>
          
          <button
            onClick={handleUploadClick}
            className="inline-flex items-center gap-2 rounded-full bg-[#90c639] text-white px-6 py-3 text-sm font-semibold shadow-sm transition hover:bg-[#7ab332]"
          >
            <Download className="h-4 w-4 rotate-180" />
            Upload Notes
          </button>
          
          <button
            onClick={() => router.push('/leaderboard')}
            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-6 py-3 text-sm font-semibold text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
          >
            <Trophy className="h-4 w-4" />
            View Leaderboard
          </button>
        </div>
      )}

      {/* Main Dashboard */}
      <div className="mt-6">
        <AuraDashboard onUploadClick={handleUploadClick} showFullFeatures={true} />
      </div>

      {/* Additional Insights */}
      {!loading && auraStats && auraStats.totalNotes > 0 && (
        <div className="mt-6 rounded-3xl border border-lime-100 bg-white/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1f2f10] mb-4">
            Your Impact Summary
          </h3>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-[#f7fbe9] rounded-xl border border-lime-100">
              <div className="text-2xl font-bold text-[#90c639]">
                {Math.round((auraStats.totalUpvotes / Math.max(auraStats.totalNotes, 1)) * 100)}%
              </div>
              <div className="text-sm text-[#1f2f10]">Approval Rate</div>
              <div className="text-xs text-[#5f7050] mt-1">
                {auraStats.totalUpvotes} upvotes on {auraStats.totalNotes} notes
              </div>
            </div>

            <div className="text-center p-4 bg-[#f7fbe9] rounded-xl border border-lime-100">
              <div className="text-2xl font-bold text-[#90c639]">
                {Math.round((auraStats.totalSaves / Math.max(auraStats.totalNotes, 1)) * 100)}%
              </div>
              <div className="text-sm text-[#1f2f10]">Save Rate</div>
              <div className="text-xs text-[#5f7050] mt-1">
                {auraStats.totalSaves} saves on {auraStats.totalNotes} notes
              </div>
            </div>

            <div className="text-center p-4 bg-[#f7fbe9] rounded-xl border border-lime-100">
              <div className="text-2xl font-bold text-[#90c639]">
                {auraStats.averageCredibility > 0 ? '+' : ''}{auraStats.averageCredibility}
              </div>
              <div className="text-sm text-[#1f2f10]">Avg Credibility</div>
              <div className="text-xs text-[#5f7050] mt-1">
                Per note quality score
              </div>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="text-2xl font-bold text-red-600">
                {auraStats.reportImpact.totalReports}
              </div>
              <div className="text-sm text-red-800">Total Reports</div>
              <div className="text-xs text-red-600 mt-1">
                -{auraStats.reportImpact.auraLostToReports} aura lost
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#f7fbe9] rounded-xl border border-lime-100">
            <div className="text-center">
              <div className="text-sm text-[#5f7050] font-medium mb-1">
                Community Impact Score
              </div>
              <div className="text-3xl font-bold text-[#90c639]">
                {Math.round(
                  (auraStats.totalUpvotes * 2) + 
                  (auraStats.totalSaves * 5) + 
                  (auraStats.totalNotes * 10) - 
                  (auraStats.totalDownvotes * 3) -
                  (auraStats.reportImpact.totalReports * 10)
                )}
              </div>
              <div className="text-xs text-[#5f7050] mt-1">
                Total positive impact on the community
              </div>
              <div className="text-xs text-[#7a8f5d] mt-2 max-w-md mx-auto">
                Notes: +10 • Upvotes: +2 • Saves: +5 • Downvotes: -3 • Reports: -10
              </div>
            </div>
          </div>

          {/* Report Impact Section */}
          {auraStats.reportImpact.totalReports > 0 ? (
            <div className="mt-6 p-6 bg-red-50 rounded-xl border border-red-100">
              <h4 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
                <span className="text-red-600">⚠️</span>
                Report Impact Analysis
              </h4>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      {auraStats.reportImpact.totalReports}
                    </div>
                    <div className="text-sm text-red-800 font-medium">Total Reports Received</div>
                    <div className="text-xs text-red-600 mt-1">
                      Across all your notes
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-red-200">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 mb-1">
                      -{auraStats.reportImpact.auraLostToReports}
                    </div>
                    <div className="text-sm text-red-800 font-medium">Aura Lost to Reports</div>
                    <div className="text-xs text-red-600 mt-1">
                      10 aura per report
                    </div>
                  </div>
                </div>
              </div>

              {auraStats.reportImpact.mostReportedNote && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-red-200">
                  <div className="text-sm text-red-800 font-medium mb-2">Most Reported Note:</div>
                  <div className="flex justify-between items-center">
                    <span className="text-red-700 font-medium">
                      {auraStats.reportImpact.mostReportedNote.subject}
                    </span>
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">
                      {auraStats.reportImpact.mostReportedNote.reportCount} reports
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-xs text-amber-800">
                  <strong>💡 Tip:</strong> Reports can impact your aura negatively. Focus on uploading high-quality, 
                  relevant content to maintain a positive reputation. Each report costs 10 aura points.
                </div>
              </div>
            </div>
          ) : auraStats.totalNotes > 0 && (
            <div className="mt-6 p-6 bg-green-50 rounded-xl border border-green-100">
              <h4 className="text-lg font-semibold text-green-800 mb-2 flex items-center gap-2">
                <span className="text-green-600">✅</span>
                Clean Record
              </h4>
              <p className="text-green-700 text-sm">
                Great job! Your notes haven't received any reports. Keep up the excellent work by 
                sharing high-quality, relevant content that helps your classmates succeed.
              </p>
              <div className="mt-3 text-xs text-green-600 bg-green-100 p-2 rounded-lg">
                <strong>Bonus:</strong> Maintaining a clean record helps preserve your aura and builds trust in the community.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Call to Action for New Users */}
      {!loading && auraStats && auraStats.totalNotes === 0 && (
        <div className="mt-6 rounded-3xl border border-lime-100 bg-white/90 p-8 shadow-sm text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h3 className="text-2xl font-semibold text-[#1f2f10] mb-2">
            Ready to Build Your Aura?
          </h3>
          <p className="text-[#4c5c3c] mb-6 max-w-md mx-auto">
            You haven't uploaded any notes yet! Start sharing your knowledge 
            and watch your aura grow as classmates find your content helpful.
          </p>
          <button
            onClick={handleUploadClick}
            className="inline-flex items-center gap-2 rounded-full bg-[#90c639] text-white px-8 py-4 text-lg font-semibold shadow-sm transition hover:bg-[#7ab332]"
          >
            Upload Your First Note
          </button>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </>
  )
}