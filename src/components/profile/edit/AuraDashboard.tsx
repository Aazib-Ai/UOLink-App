'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  Flame,
  Heart,
  Info,
  Star,
  Target,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
  Users,
  Zap
} from 'lucide-react'
import { getAuraTier, formatAura, AURA_TIERS } from '@/lib/aura'
import { useAuraStats } from '@/hooks/useAuraStats'
import type { AuraStats } from '@/hooks/useAuraStats'

const PLAYBOOK_STEPS = [
  {
    step: 'Upload standout notes',
    description: 'Every polished upload adds base aura and brings classmates back for more.',
    icon: Upload
  },
  {
    step: 'Drive saves and upvotes',
    description: 'Share your profile link in study chats to multiply engagement.',
    icon: Users
  },
  {
    step: 'Stay accurate and consistent',
    description: 'Give each note a quick review before posting to avoid reports and aura drops.',
    icon: Target
  }
]

const buildGrowthHighlights = (auraStats: AuraStats) => [
  {
    title: 'Notes shared this week',
    value: auraStats.recentActivity.notesThisWeek,
    hint: auraStats.recentActivity.notesThisWeek > 0 ? 'Keep the streak alive' : 'Upload once this week to get rolling',
    icon: Upload
  },
  {
    title: 'Estimated aura earned',
    value: `+${auraStats.recentActivity.auraGainedThisWeek}`,
    hint: 'Fresh uploads create the biggest jumps',
    icon: TrendingUp
  },
  {
    title: auraStats.topNote ? auraStats.topNote.subject : 'Top note pending',
    value: auraStats.topNote ? `${auraStats.topNote.credibilityScore} credibility` : 'Share a standout upload',
    hint: auraStats.topNote ? 'Your highest rated note so far' : 'Your next great upload could take this spot',
    icon: Flame
  }
]

const buildCautions = (auraStats: AuraStats) => [
  {
    title: 'Inactive weeks slow growth',
    description:
      auraStats.recentActivity.notesThisWeek > 0
        ? 'You are on track - keep the cadence steady.'
        : 'Aim for at least one upload each week to keep your aura moving.',
    icon: Calendar
  },
  {
    title: 'Reports reduce aura',
    description: 'Double-check clarity, accuracy, and originality to avoid moderation flags.',
    icon: TrendingDown
  },
  {
    title: 'Community trust matters',
    description: 'Respond to feedback and update outdated material to keep your reputation high.',
    icon: Star
  }
]

interface BaseAuraDashboardProps {
  onUploadClick?: () => void
  showFullFeatures?: boolean
  onBackClick?: () => void
}

interface AuraDashboardContentProps extends BaseAuraDashboardProps {
  auraStats: AuraStats | null
  loading: boolean
  error?: string | null
}

export function AuraDashboardContent({
  auraStats,
  loading,
  error,
  onUploadClick,
  onBackClick,
  showFullFeatures = true
}: AuraDashboardContentProps) {
  // All hooks must be called before any early returns
  const [showAllTiers, setShowAllTiers] = useState(false)

  const auraInfo = auraStats ? getAuraTier(auraStats.currentAura) : null
  const growthHighlights = auraStats ? buildGrowthHighlights(auraStats) : []
  const playbook = PLAYBOOK_STEPS
  const cautions = auraStats ? buildCautions(auraStats) : []

  // Early returns after all hooks to maintain hook order
  if (loading) {
    return (
      <div className="rounded-3xl border border-lime-100 bg-white/95 p-6 shadow-sm">
        <div className="animate-pulse space-y-6">
          <div className="h-5 w-32 rounded-full bg-gray-200" />
          <div className="h-24 rounded-2xl bg-gray-200" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 rounded-2xl bg-gray-200" />
            ))}
          </div>
          <div className="h-32 rounded-2xl bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm text-red-800">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5" />
          <div>
            <h3 className="text-base font-semibold">We could not load your aura right now</h3>
            <p className="mt-1 text-sm text-red-700">
              Please refresh the page or try again in a moment. Your uploads are safe and will continue to count toward
              your aura.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!auraStats || !auraInfo) {
    return null
  }

  const progressWidth = auraInfo.isMaxTier ? 100 : auraInfo.progressPercent

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-lime-100 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              {onBackClick && (
                <button
                  onClick={onBackClick}
                  className="inline-flex items-center justify-center w-8 h-8 sm:w-auto sm:h-auto sm:inline-flex sm:items-center sm:gap-1.5 rounded-full border border-lime-100 bg-white/90 backdrop-blur-sm px-0 sm:px-2.5 py-0 sm:py-1.5 text-[#334125] shadow-sm transition hover:border-[#90c639] hover:bg-[#f7fbe9] hover:text-[#1f2f10] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-3 sm:w-3 flex-shrink-0" />
                  <span className="hidden sm:inline text-xs sm:text-xs font-medium">Back</span>
                </button>
              )}
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#5f7050]">
                <Zap className="h-4 w-4 text-[#90c639]" />
                Aura Overview
              </div>
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#1f2f10] sm:text-4xl">Your Aura</h2>
            <p className="mt-3 max-w-xl text-sm text-[#4c5c3c]">
              Aura reflects how the community values your notes. Publish clear, high-impact resources to unlock new
              tiers and stand out on the leaderboard.
            </p>
          </div>

          <div className="flex flex-col items-end gap-4">
            <div className="rounded-2xl border border-lime-100 bg-[#f7fbe9] px-5 py-4 text-right shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-[#5f7050]">Current score</div>
              <div className="mt-2 text-4xl font-bold text-[#90c639] sm:text-5xl">{formatAura(auraStats.currentAura)}</div>
              <span
                className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${auraInfo.tier.badgeClass}`}
              >
                {auraInfo.tier.name}
              </span>
            </div>

            {onUploadClick && (
              <button
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-full border border-[#90c639] px-4 py-2 text-sm font-semibold text-[#1f2f10] transition hover:bg-[#f7fbe9]"
              >
                <Upload className="h-4 w-4" />
                Add new notes
              </button>
            )}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm text-[#4c5c3c]">
            <span className="font-medium">
              {auraInfo.isMaxTier ? 'Max tier unlocked' : `Progress to ${auraInfo.nextTier?.name}`}
            </span>
            {!auraInfo.isMaxTier && <span>{auraInfo.auraToNext} aura needed</span>}
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#e7edd9]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                auraInfo.isMaxTier ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gradient-to-r from-[#90c639] to-[#6da428]'
              }`}
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#5f7050]">{auraInfo.tier.description}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-lime-100 bg-white px-3 py-4 shadow-sm sm:px-4">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[#5f7050]">
              <span>Notes</span>
              <BookOpen className="h-4 w-4 text-[#90c639]" />
            </div>
            <p className="mt-3 text-xl font-semibold text-[#1f2f10] sm:text-2xl">{auraStats.totalNotes}</p>
            <p className="mt-1 text-xs text-[#4c5c3c]">Published uploads</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-white px-3 py-4 shadow-sm sm:px-4">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-blue-800">
              <span>Upvotes</span>
              <ThumbsUp className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-3 text-xl font-semibold text-blue-900 sm:text-2xl">{auraStats.totalUpvotes}</p>
            <p className="mt-1 text-xs text-blue-800/70">Showing approval</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-white px-3 py-4 shadow-sm sm:px-4">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-rose-800">
              <span>Saves</span>
              <Heart className="h-4 w-4 text-rose-500" />
            </div>
            <p className="mt-3 text-xl font-semibold text-rose-900 sm:text-2xl">{auraStats.totalSaves}</p>
            <p className="mt-1 text-xs text-rose-700/70">Classmates saving</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white px-3 py-4 shadow-sm sm:px-4">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-amber-800">
              <span>Avg credibility</span>
              <Star className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-3 text-xl font-semibold text-amber-900 sm:text-2xl">
              {auraStats.averageCredibility > 0 ? `+${auraStats.averageCredibility}` : auraStats.averageCredibility}
            </p>
            <p className="mt-1 text-xs text-amber-700/70">Quality per note</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3">
          {growthHighlights.map(({ icon: Icon, title, value, hint }) => (
            <div key={title} className="flex items-start gap-3 rounded-2xl border border-lime-100 bg-[#f7fbe9]/60 px-3 py-4 sm:px-4">
              <Icon className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full bg-white p-2 text-[#90c639] shadow-sm sm:h-9 sm:w-9" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1f2f10] truncate">{title}</p>
                <p className="mt-1 text-base font-semibold text-[#334125] sm:text-lg truncate">{value}</p>
                <p className="mt-1 text-xs text-[#5f7050] line-clamp-2">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showFullFeatures && (
        <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-lime-100 bg-white/95 p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#1f2f10]">
              <Target className="h-5 w-5 text-[#90c639] flex-shrink-0" />
              Build your aura plan
            </div>
            <div className="space-y-3 sm:space-y-4">
              {playbook.map(({ icon: Icon, step, description }, index) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f7fbe9] text-sm font-semibold text-[#90c639]">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#1f2f10] text-sm">{step}</p>
                    <p className="text-sm text-[#4c5c3c] mt-1">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-blue-50/80 p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-blue-900">
              <Users className="h-5 w-5 text-blue-600 flex-shrink-0" />
              Engagement boosters
            </div>
            <div className="space-y-3 sm:space-y-4 text-sm text-blue-900/80">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-blue-900">Share with your circle</p>
                  <p className="text-blue-900/80">Drop links in study chats or discord servers to spark saves.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Upload className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-blue-900">Refresh older uploads</p>
                  <p className="text-blue-900/80">Updated notes rise back to the top and earn fresh reactions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Trophy className="mt-0.5 h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-blue-900">Show off your tier</p>
                  <p className="text-blue-900/80">Highlight your aura badge on your profile to build trust instantly.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-amber-900">
              <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0" />
              Avoid aura penalties
            </div>
            <div className="space-y-3 sm:space-y-4 text-sm text-amber-900/90">
              {cautions.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-amber-900">{title}</p>
                    <p className="text-amber-900/80">{description}</p>
                  </div>
                </div>
              ))}
              {auraStats.reportImpact.totalReports > 0 && (
                <div className="rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs text-amber-900 sm:px-4">
                  <strong>Heads up:</strong> {auraStats.reportImpact.totalReports} report
                  {auraStats.reportImpact.totalReports === 1 ? '' : 's'} have removed{' '}
                  {auraStats.reportImpact.auraLostToReports} aura so far.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {showFullFeatures && (
        <section className="rounded-3xl border border-lime-100 bg-white/95 p-4 sm:p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
              <Trophy className="h-5 w-5 text-[#90c639] flex-shrink-0" />
              Aura tiers
            </div>
            <button
              onClick={() => setShowAllTiers((value) => !value)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#90c639] transition hover:text-[#6da428]"
            >
              {showAllTiers ? 'Show less' : 'View all'}
              <ChevronRight className={`h-4 w-4 transition-transform ${showAllTiers ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            {(showAllTiers ? AURA_TIERS : AURA_TIERS.slice(0, 3)).map((tier) => {
              const isCurrentTier = tier.id === auraInfo.tier.id
              const unlocked = auraStats.currentAura >= tier.min

              return (
                <div
                  key={tier.id}
                  className={`rounded-2xl border px-3 py-4 transition sm:px-4 ${
                    isCurrentTier
                      ? 'border-[#90c639] bg-[#f7fdf0] ring-2 ring-[#90c639]/30'
                      : unlocked
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tier.badgeClass}`}>
                        {tier.name}
                      </span>
                      {isCurrentTier && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#90c639] px-3 py-1 text-xs font-semibold text-white">
                          <Award className="h-4 w-4" />
                          <span className="truncate">Current tier</span>
                        </span>
                      )}
                      {unlocked && !isCurrentTier && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <Flame className="h-4 w-4" />
                          <span className="truncate">Unlocked</span>
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#4c5c3c]">
                      {tier.min}
                      {tier.max ? ` – ${tier.max}` : '+'} aura
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-[#4c5c3c]">{tier.description}</p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {showFullFeatures && !auraInfo.isMaxTier && (
        <section className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-yellow-50 to-white p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700">
                <TrendingUp className="h-4 w-4 flex-shrink-0" />
                Level up challenge
              </div>
              <h3 className="mt-2 text-xl font-semibold text-orange-900 sm:text-2xl">
                Only {auraInfo.auraToNext} aura away from {auraInfo.nextTier?.name}
              </h3>
              <p className="mt-2 max-w-xl text-sm text-orange-800">
                Upload {Math.max(1, Math.ceil(auraInfo.auraToNext / 10))} high-quality{' '}
                {Math.ceil(auraInfo.auraToNext / 10) === 1 ? 'note' : 'notes'} or rally your classmates for saves and
                upvotes to hit the next tier.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {onUploadClick && (
                <button
                  onClick={onUploadClick}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 sm:px-6"
                >
                  <Upload className="h-4 w-4" />
                  Upload now
                </button>
              )}
              <div className="rounded-full border border-orange-200 bg-white px-4 py-3 text-center text-sm font-medium text-orange-800 shadow-sm sm:px-5">
                <span className="hidden sm:inline">{auraStats.totalNotes} notes shared • {auraStats.totalSaves} saves • {auraStats.totalUpvotes} upvotes</span>
                <span className="sm:hidden">{auraStats.totalNotes} notes • {auraStats.totalSaves} saves • {auraStats.totalUpvotes} upvotes</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default function AuraDashboard({ onUploadClick, showFullFeatures = true }: BaseAuraDashboardProps) {
  const { auraStats, loading, error } = useAuraStats()

  return (
    <AuraDashboardContent
      auraStats={auraStats}
      loading={loading}
      error={error}
      onUploadClick={onUploadClick}
      showFullFeatures={showFullFeatures}
    />
  )
}
