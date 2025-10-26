'use client'

import { useRouter } from 'next/navigation'
import { Trophy, Medal, Award, Users, ThumbsUp, Bookmark, RefreshCw } from 'lucide-react'
import { getAuraTier } from '@/lib/aura'
import { useAuth } from '@/contexts/AuthContext'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import '@/styles/skeletons.css'
import { useState } from 'react'
import UploadModalLazy from './UploadModalLazy'

// Client component for interactive leaderboard functionality
export default function ClientLeaderboard() {
  const router = useRouter()
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { user } = useAuth()
  const { leaderboard, loading, error, refetch } = useLeaderboard(25)

  const handleUploadClick = () => {
    setIsUploadModalOpen(true)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return (
          <div className="h-6 w-6 rounded-full bg-[#90c639] text-white text-sm font-bold flex items-center justify-center">
            {rank}
          </div>
        )
    }
  }

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500'
      case 3:
        return 'bg-gradient-to-r from-amber-400 to-amber-600'
      default:
        return 'bg-gradient-to-r from-[#90c639] to-[#7ab332]'
    }
  }

  if (loading) {
    return (
      <div className="mt-6 animate-pulse">
        <div className="h-32 bg-white rounded-3xl mb-6"></div>
        <div className="space-y-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="content-fade-in">
      {/* Interactive Controls */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        <div className="inline-flex items-center gap-2 text-sm text-[#5f7050]">
          <Users className="h-4 w-4" />
          {leaderboard.length} active contributors
        </div>
        <button
          onClick={refetch}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-3 py-1.5 text-xs font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={handleUploadClick}
          className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-4 py-2 md:px-6 md:py-3 text-sm font-semibold transition-all duration-300"
        >
          Start Contributing
        </button>
        {user ? (
          <button
            onClick={() => router.push('/aura')}
            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 hover:bg-lime-100 px-4 py-2 md:px-6 md:py-3 text-sm font-semibold text-[#90c639] transition-colors"
          >
            View My Aura
          </button>
        ) : (
          <button
            onClick={() => router.push('/auth?mode=register')}
            className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-4 py-2 md:px-6 md:py-3 text-sm font-semibold transition-all duration-300"
          >
            Register to Build Aura
          </button>
        )}
      </div>

      {/* Logged-out User CTA */}
      {!user && !loading && !error && (
        <div className="mt-6 rounded-3xl border border-lime-100 bg-white/90 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 py-6 sm:px-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#90c639] text-white mb-4">
                <Trophy className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-[#1f2f10] sm:text-3xl mb-2">
                Ready to Build Your Aura?
              </h3>
              <p className="text-[#4c5c3c] mb-6 max-w-2xl mx-auto">
                Join the community to start earning aura points! Share quality notes, help fellow students, and climb the ranks.
                Your contributions matter and will help you build your reputation as a top contributor.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => router.push('/auth?mode=register')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-6 py-3 text-sm font-semibold transition-all duration-300"
                >
                  Register Now
                </button>
                <span className="text-[#5f7050] text-sm">and start building your aura today!</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Leaderboard */}
      {!error && (
        <div className="mt-6 space-y-3">
          {leaderboard.map((profile) => {
            const auraTier = getAuraTier(profile.aura || 0)
            const isCurrentUser = user?.uid === profile.id
            
            return (
              <div
                key={profile.id}
                className={`rounded-2xl border bg-white/90 shadow-sm transition-all hover:shadow-md ${
                  isCurrentUser 
                    ? 'border-[#90c639] ring-2 ring-[#90c639]/20' 
                    : 'border-lime-100'
                } ${
                  profile.rank <= 3 ? 'bg-gradient-to-r from-white to-[#f7fbe9]' : ''
                }`}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0">
                      {getRankIcon(profile.rank)}
                    </div>

                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        {profile.profilePicture ? (
                          <img
                            src={profile.profilePicture}
                            alt={profile.fullName || 'User'}
                            className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.fullName || 'User')}&background=90c639&color=fff&size=48`
                            }}
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-[#90c639] text-white flex items-center justify-center text-lg font-semibold border-2 border-white shadow-sm">
                            {(profile.fullName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {profile.rank <= 3 && (
                          <div className={`absolute -top-1 -right-1 h-6 w-6 rounded-full ${getRankBadgeColor(profile.rank)} flex items-center justify-center`}>
                            <span className="text-xs font-bold text-white">
                              {profile.rank}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-[#1f2f10] truncate">
                          {profile.fullName || 'Anonymous User'}
                        </h3>
                        {isCurrentUser && (
                          <span className="inline-flex items-center rounded-full bg-[#90c639] px-2 py-1 text-xs font-medium text-white">
                            You
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-[#5f7050]">
                        <span>{profile.major || 'Student'}</span>
                        {profile.semester && (
                          <span>Semester {profile.semester}</span>
                        )}
                      </div>

                      {/* Aura Tier Badge */}
                      <div className="mt-2 inline-flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${auraTier.tier.badgeClass}`}>
                          {auraTier.tier.name}
                        </span>
                      </div>
                    </div>

                    {/* Aura Score */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl font-bold text-[#90c639]">
                        {profile.aura || 0}
                      </div>
                      <div className="text-xs text-[#5f7050]">
                        aura points
                      </div>
                    </div>
                  </div>

                  {/* Additional Stats Row */}
                  <div className="mt-4 pt-4 border-t border-lime-100">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-semibold text-[#90c639]">
                          {profile.totalNotes}
                        </div>
                        <div className="text-xs text-[#5f7050]">Notes</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <ThumbsUp className="h-3 w-3 text-[#90c639]" />
                          <span className="text-lg font-semibold text-[#90c639]">
                            {profile.totalUpvotes}
                          </span>
                        </div>
                        <div className="text-xs text-[#5f7050]">Upvotes</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-1">
                          <Bookmark className="h-3 w-3 text-[#90c639]" />
                          <span className="text-lg font-semibold text-[#90c639]">
                            {profile.totalSaves}
                          </span>
                        </div>
                        <div className="text-xs text-[#5f7050]">Saves</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && leaderboard.length === 0 && (
        <div className="mt-6 rounded-3xl border border-lime-100 bg-white/90 p-8 shadow-sm text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-2xl font-semibold text-[#1f2f10] mb-2">
            No Rankings Yet
          </h3>
          <p className="text-[#4c5c3c] mb-6 max-w-md mx-auto">
            {user
              ? "Be the first to earn aura points by sharing helpful notes with your classmates!"
              : "Register and be the first to earn aura points by sharing helpful notes with the community!"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleUploadClick}
              className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-6 py-3 text-sm font-semibold transition-all duration-300"
            >
              {user ? "Start Contributing" : "Share Your First Note"}
            </button>
            {user ? (
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 hover:bg-lime-100 px-6 py-3 text-sm font-semibold text-[#90c639] transition-colors"
              >
                Browse Notes
              </button>
            ) : (
              <button
                onClick={() => router.push('/auth?mode=register')}
                className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-6 py-3 text-sm font-semibold transition-all duration-300"
              >
                Register to Build Aura
              </button>
            )}
          </div>
        </div>
      )}

      {/* Call to Action */}
      {!loading && !error && leaderboard.length > 0 && (
        <div className="mt-8 rounded-2xl border border-lime-100 bg-white/90 p-6 shadow-sm text-center">
          <h3 className="text-lg font-semibold text-[#1f2f10] mb-2">
            {user ? "Want to climb the ranks?" : "Ready to build your aura?"}
          </h3>
          <p className="text-[#4c5c3c] mb-4">
            {user
              ? "Share quality notes and engage with the community to boost your aura!"
              : "Register now to start building your aura and join the community leaderboard!"
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleUploadClick}
              className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-6 py-3 text-sm font-semibold transition-all duration-300"
            >
              {user ? "Upload Notes" : "Share Notes"}
            </button>
            {user ? (
              <button
                onClick={() => router.push('/aura')}
                className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 hover:bg-lime-100 px-6 py-3 text-sm font-semibold text-[#90c639] transition-colors"
              >
                View My Aura
              </button>
            ) : (
              <button
                onClick={() => router.push('/auth?mode=register')}
                className="inline-flex items-center gap-2 rounded-full bg-[#90c639] hover:bg-[#7ab332] text-white px-6 py-3 text-sm font-semibold transition-all duration-300"
              >
                Register to Build Aura
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <UploadModalLazy
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}