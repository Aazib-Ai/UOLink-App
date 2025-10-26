'use client'

import { ArrowLeft, BookOpen, FileText, Sparkles, TrendingUp, Clock3 } from 'lucide-react'

interface ActivityStats {
  totalContributions: number
  uniqueSubjects: number
  totalViews: number
  lastActiveDate: string
}

interface ContributionStatsPanelProps {
  stats: ActivityStats
  contributorDisplayName: string
  onUploadClick: () => void
  onBackClick: () => void
}

export default function ContributionStatsPanel({
  stats,
  contributorDisplayName,
  onUploadClick,
  onBackClick
}: ContributionStatsPanelProps) {
  const formatDisplayDate = (isoString?: string) => {
    if (!isoString) return 'No uploads yet'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const lastActiveLabel = stats.totalContributions ? formatDisplayDate(stats.lastActiveDate) : 'No uploads yet'
  const nextMilestone = stats.totalContributions < 5 ? 5 : stats.totalContributions + 5

  return (
    <>
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#90c639] via-[#7ab332] to-[#6a9c2d] shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/10" />
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="relative z-10 flex flex-col gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/90">
              <Sparkles className="h-4 w-4" />
              Contribution hub
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-snug text-white sm:text-4xl">
              Hey {contributorDisplayName || 'Contributor'}, your notes inspire classmates every day.
            </h1>
            <p className="mt-4 text-sm text-white/90 sm:text-base">
              Curate, refine, and manage every file you have shared with your community in one calm workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onUploadClick}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#90c639] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white/95"
              >
                <BookOpen className="h-4 w-4" />
                Upload new note
              </button>
              <button
                type="button"
                onClick={onBackClick}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 hover:border-white/30"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to profile
              </button>
            </div>
          </div>

          <div className="grid w-full max-w-xs grid-cols-2 gap-4 sm:max-w-sm">
            <div className="rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Total files</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.totalContributions}</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Subjects covered</p>
              <p className="mt-2 text-3xl font-bold text-white">{stats.uniqueSubjects}</p>
            </div>
            <div className="col-span-2 rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Last active</p>
              <p className="mt-2 text-lg font-semibold text-white">{lastActiveLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-emerald-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{stats.totalContributions} uploads</p>
              <p className="text-xs text-gray-500">Shared with your classmates</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {stats.uniqueSubjects} subject{stats.uniqueSubjects === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-gray-500">Breadth of your coverage</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-lime-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-100 text-lime-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Next milestone: {nextMilestone}</p>
              <p className="text-xs text-gray-500">Keep the streak going</p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-sky-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">{lastActiveLabel}</p>
              <p className="text-xs text-gray-500">Most recent activity</p>
            </div>
          </div>
        </article>
      </section>
    </>
  )
}