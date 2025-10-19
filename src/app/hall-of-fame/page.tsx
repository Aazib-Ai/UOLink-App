'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { getAuraLeaderboard } from '@/lib/firebase'
import { getAuraTier, formatAura } from '@/lib/aura'
import { ArrowLeft, Trophy, Sparkles } from 'lucide-react'

interface LeaderboardProfile {
  id: string
  fullName?: string
  profileSlug?: string
  profilePicture?: string | null
  aura?: number
}

const rankAccentClasses: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  2: { bg: 'bg-slate-100', text: 'text-slate-700' },
  3: { bg: 'bg-amber-100', text: 'text-amber-700' },
}

export default function HallOfFamePage() {
  const [leaders, setLeaders] = useState<LeaderboardProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true)
        const data = await getAuraLeaderboard(20)
        setLeaders(data as LeaderboardProfile[])
      } catch (err) {
        console.error('Failed to load leaderboard', err)
        setError('Unable to load the Hall of Fame right now. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const rankedLeaders = useMemo(() => {
    return leaders.map((profile, index) => ({
      rank: index + 1,
      profile,
      auraInfo: getAuraTier(profile.aura ?? 0),
    }))
  }, [leaders])

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 md:mt-24 mt-20 pb-12">
        <div className="flex flex-col gap-6">
          <button
            onClick={() => history.back()}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#90c639] hover:text-[#7ab332] transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="rounded-3xl border border-purple-200 bg-white/95 shadow-xl backdrop-blur-sm p-6 sm:p-10">
            <div className="flex flex-col items-center text-center gap-4 sm:gap-5 mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-purple-600" />
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900">Hall of Fame</h1>
              </div>
              <p className="max-w-2xl text-gray-600 text-sm sm:text-base">
                The top Aura earners across UoLink. These legends consistently drop the cleanest notes, earn the most
                saves, and keep the community vibing. Want your glow-up? Share heat and let the community lift you up.
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex items-center gap-3 text-gray-500">
                  <Sparkles className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Loading the vibes...</span>
                </div>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 text-center text-red-600">
                {error}
              </div>
            ) : rankedLeaders.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-700">
                No legends yet. Share your best notes to claim the top spot!
              </div>
            ) : (
              <div className="space-y-4">
                {rankedLeaders.map(({ rank, profile, auraInfo }) => {
                  const accent = rankAccentClasses[rank] ?? { bg: 'bg-white', text: 'text-gray-700' }
                  const profileLink = profile.profileSlug ? `/profile/${profile.profileSlug}` : null

                  return (
                    <div
                      key={profile.id}
                      className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-purple-100 ${accent.bg} px-4 py-4 sm:px-6 sm:py-5 shadow-sm`}
                    >
                      <div className="flex items-center gap-4 sm:w-1/3">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-white font-bold text-lg ${accent.text}`}>
                          #{rank}
                        </span>
                        <span
                          className={`inline-flex items-center justify-center rounded-full p-[4px] ${auraInfo.tier.borderClass}`}
                        >
                          {profile.profilePicture ? (
                            <img
                              src={profile.profilePicture}
                              alt={profile.fullName ?? 'Top scorer'}
                              className="h-12 w-12 rounded-full object-cover border-2 border-white"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-emerald-50 via-white to-amber-50 text-gray-400 font-semibold">
                              {profile.fullName?.[0] ?? '?'}
                            </div>
                          )}
                        </span>
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div>
                            {profileLink ? (
                              <Link
                                href={profileLink}
                                className="text-lg font-semibold text-gray-900 hover:text-[#90c639] transition-colors"
                              >
                                {profile.fullName ?? 'Anonymous Scholar'}
                              </Link>
                            ) : (
                              <p className="text-lg font-semibold text-gray-900">
                                {profile.fullName ?? 'Anonymous Scholar'}
                              </p>
                            )}
                            <span
                              className={`mt-1 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${auraInfo.tier.badgeClass}`}
                            >
                              <Sparkles className="h-3 w-3" aria-hidden="true" />
                              {auraInfo.tier.name}
                            </span>
                          </div>

                          <div className="text-right">
                            <p className="text-sm uppercase tracking-[0.25em] text-purple-500">Aura</p>
                            <p className="text-2xl font-black text-purple-700">{formatAura(auraInfo.aura)}</p>
                            {!auraInfo.isMaxTier && (
                              <p className="text-xs text-purple-500 mt-1">
                                {formatAura(auraInfo.auraToNext)} to {auraInfo.nextTier?.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

