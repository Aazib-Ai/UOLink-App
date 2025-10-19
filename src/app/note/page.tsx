'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import PDFViewer from '@/components/PDFViewer'
import CommentSection from '@/components/CommentSection'
import ReportButton from '@/components/ReportButton'
import { buildR2PublicUrlFromBase, deriveR2ObjectKey, isR2LikeHost } from '@/lib/r2-shared'
import { useAuth } from '@/contexts/AuthContext'
import { getAuraTier, formatAura } from '@/lib/aura'
import { slugify } from '@/lib/utils'
import { LogIn, Shield, Flame, Skull, Sparkles, ArrowLeft, ExternalLink, BookOpen, GraduationCap, User } from 'lucide-react'

const r2PublicBaseUrl =
  (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || '').trim()

const r2Hostname = (() => {
  if (!r2PublicBaseUrl) {
    return ''
  }

  try {
    return new URL(r2PublicBaseUrl).hostname.toLowerCase()
  } catch {
    return ''
  }
})()

const isPDFUrl = (url: string) => {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('.pdf')) {
    return true
  }

  return r2Hostname ? lowerUrl.includes(r2Hostname) : false
}

const resolveNoteUrl = ({
  rawUrl,
  storageProvider,
  storageKey,
  storageBucket,
}: {
  rawUrl?: string | null
  storageProvider?: string | null
  storageKey?: string | null
  storageBucket?: string | null
}) => {
  const trimmedKey = storageKey?.trim()

  if (storageProvider === 'cloudflare-r2') {
    const key = trimmedKey || (rawUrl ? deriveR2ObjectKey(rawUrl, storageBucket ?? undefined) ?? undefined : undefined)
    if (key && r2PublicBaseUrl) {
      try {
        return buildR2PublicUrlFromBase({
          baseUrl: r2PublicBaseUrl,
          objectKey: key,
        })
      } catch {
        // fall back to raw URL below
      }
    }
  }

  if (rawUrl && r2PublicBaseUrl) {
    try {
      const parsed = new URL(rawUrl)
      if (isR2LikeHost(parsed.hostname.toLowerCase())) {
        const key = deriveR2ObjectKey(rawUrl, storageBucket ?? undefined)
        if (key) {
          return buildR2PublicUrlFromBase({
            baseUrl: r2PublicBaseUrl,
            objectKey: key,
          })
        }
      }
    } catch {
      // ignore parsing errors
    }
  }

  return rawUrl ?? ''
}

const getVibeBadge = (score: number): { icon: JSX.Element | null; classes: string } => {
  if (score > 10) {
    return {
      icon: <Flame className="h-3 w-3" aria-hidden="true" />,
      classes: 'border-orange-200 bg-orange-50 text-orange-700',
    }
  }

  if (score < -10) {
    return {
      icon: <Skull className="h-3 w-3" aria-hidden="true" />,
      classes: 'border-slate-700 bg-slate-900 text-gray-100',
    }
  }

  return {
    icon: null,
    classes: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

export default function NotePage() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [noteData, setNoteData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = searchParams.get('url')
    const id = searchParams.get('id')
    const subject = searchParams.get('subject')
    const teacher = searchParams.get('teacher') ?? searchParams.get('module')
    const contributor = searchParams.get('contributor')
    const storageProvider = searchParams.get('storageProvider')
    const storageKey = searchParams.get('storageKey')
    const storageBucket = searchParams.get('storageBucket')
    const vibeScoreParam = Number.parseFloat(searchParams.get('vibeScore') ?? '0')
    const safeVibeScore = Number.isFinite(vibeScoreParam) ? vibeScoreParam : 0
    const auraParam = Number.parseFloat(searchParams.get('aura') ?? '0')
    const safeAura = Number.isFinite(auraParam) ? auraParam : 0

    const decodedUrl = url ?? undefined
    const finalUrl = resolveNoteUrl({
      rawUrl: decodedUrl,
      storageProvider,
      storageKey,
      storageBucket,
    })

    if (decodedUrl || storageKey) {
      setNoteData({
        url: finalUrl,
        rawUrl: decodedUrl,
        id,
        subject: subject ?? 'Unknown',
        teacher: teacher ?? 'Unknown',
        contributor: contributor ?? 'Unknown',
        storageProvider,
        storageKey,
        storageBucket,
        aura: safeAura,
        vibeScore: safeVibeScore,
      })
    } else {
      setNoteData(null)
    }

    setLoading(false)
  }, [searchParams])

  const noteUrl = useMemo(() => (noteData?.url ? noteData.url : ''), [noteData])
  const vibeScoreValue = useMemo(() => {
    const rawScore =
      typeof noteData?.vibeScore === 'number'
        ? noteData.vibeScore
        : Number.parseFloat(noteData?.vibeScore ?? '0')
    return Number.isFinite(rawScore) ? Math.round(rawScore) : 0
  }, [noteData])
  const vibeBadge = getVibeBadge(vibeScoreValue)
  const vibeDisplayValue = vibeScoreValue > 0 ? `+${vibeScoreValue}` : `${vibeScoreValue}`
  const auraInfo = useMemo(
    () =>
      getAuraTier(
        typeof noteData?.aura === 'number'
          ? noteData.aura
          : Number.parseFloat(noteData?.aura ?? '0')
      ),
    [noteData]
  )
  const auraDisplayValue = formatAura(auraInfo.aura)
  const contributorProfileUrl = useMemo(() => {
    if (noteData?.contributor) {
      return `/profile/${encodeURIComponent(slugify(noteData.contributor))}`
    }
    return null
  }, [noteData])

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#f6f9ee]">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="space-y-6 rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-3">
                  <div className="h-5 w-24 animate-pulse rounded-full bg-[#f3f8e7]" />
                  <div className="h-8 w-48 animate-pulse rounded-lg bg-[#e8f3d2]" />
                  <div className="h-4 w-40 animate-pulse rounded bg-[#f3f8e7]" />
                </div>
                <div className="h-10 w-full max-w-[140px] animate-pulse rounded-full bg-[#e8f3d2]" />
              </div>
              <div className="h-64 w-full animate-pulse rounded-2xl bg-[#f3f8e7]" />
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!noteData || !noteUrl) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-[#f6f9ee]">
          <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 text-center sm:px-6">
            <div className="w-full rounded-3xl border border-lime-100 bg-white p-8 shadow-sm sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3d2] text-[#90c639]">
                <Shield className="h-7 w-7" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold text-[#1f2f10]">We couldn&apos;t open that note</h1>
              <p className="mt-3 text-sm text-[#4c5c3c]">
                The note you&apos;re looking for might have been removed or the link could be out of date. Try browsing the latest materials instead.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
                >
                  Browse Materials
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-5 py-2.5 text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f6f9ee] w-full overflow-x-hidden">
        <div className="w-full max-w-full mx-auto px-3 pb-8 xs:pb-10 sm:pb-12 pt-3 xs:pt-4 sm:px-5 lg:px-8 xl:max-w-screen-2xl 2xl:max-w-screen-xl">
          <div className="flex justify-center sm:justify-start w-full">
            <Link
              href="/"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-lime-100 bg-white px-3 py-2 xs:px-4 text-xs sm:text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] touch-manipulation active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#90c639]" />
              <span className="hidden xs:inline">Back to materials</span>
              <span className="inline xs:hidden">Back</span>
            </Link>
          </div>

          <section className="mt-3 xs:mt-4 overflow-hidden rounded-2xl xs:rounded-3xl border border-lime-100 bg-white shadow-sm sm:mt-6 w-full">
            <div className="bg-gradient-to-br from-[#f7fbe9] via-white to-white px-3 xs:px-4 py-4 xs:py-5 sm:px-8 sm:py-8 w-full">
              <div className="flex flex-col gap-4 xs:gap-5 md:flex-row md:items-start md:justify-between w-full">
                <div className="space-y-3 xs:space-y-4 text-center md:text-left w-full">
                  <span className="inline-flex items-center gap-1.5 xs:gap-2 rounded-full border border-lime-100 bg-white/80 px-2 xs:px-3 py-1 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-[#5f7050] sm:text-xs">
                    <BookOpen className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-[#90c639]" />
                    <span className="hidden xs:inline">Study material</span>
                    <span className="inline xs:hidden">Material</span>
                  </span>
                  <div className="w-full">
                    <h1 className="text-lg xs:text-xl sm:text-2xl lg:text-3xl font-semibold text-[#1f2f10] leading-tight break-words">{noteData.subject}</h1>
                    <p className="mt-1.5 xs:mt-2 text-xs sm:text-sm text-[#4c5c3c] sm:text-base">Instructor {noteData.teacher}</p>
                    <p className="mt-1 text-xs sm:text-sm text-[#5f7050]">Shared by {noteData.contributor}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-[#5f7050] md:justify-start sm:text-xs w-full">
                    <span
                      className={`inline-flex items-center gap-0.5 xs:gap-1 rounded-full border px-2 xs:px-3 py-1 ${auraInfo.tier.badgeClass}`}
                      title={`Aura ${auraDisplayValue}`}
                    >
                      <Sparkles className="h-2.5 w-2.5 xs:h-3 xs:w-3" />
                      <span className="hidden xs:inline">{auraInfo.tier.name}</span>
                      <span className="inline xs:hidden">{auraInfo.tier.name.split(' ')[0]}</span>
                    </span>
                                        {!auraInfo.isMaxTier && (
                      <span className="inline-flex items-center gap-0.5 xs:gap-1 rounded-full bg-white/80 px-2 xs:px-3 py-1 text-[10px] xs:text-[11px] text-[#4c5c3c]">
                        <span className="hidden xs:inline">{formatAura(auraInfo.auraToNext)} to reach {auraInfo.nextTier?.name}</span>
                        <span className="inline xs:hidden">+{formatAura(auraInfo.auraToNext)}</span>
                      </span>
                    )}
                  </div>
                </div>

                              </div>
            </div>

            <div className="border-t border-lime-100 px-3 xs:px-4 py-4 xs:py-5 sm:px-8 w-full">
              <dl className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 xs:gap-3 w-full">
                <div className="rounded-xl xs:rounded-2xl bg-[#f7fbe9] px-3 xs:px-4 py-2.5 xs:py-3 w-full">
                  <dt className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-[#5f7050] sm:text-xs">
                    <BookOpen className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-[#90c639]" />
                    Subject
                  </dt>
                  <dd className="mt-1.5 xs:mt-2 text-xs xs:text-sm font-medium text-[#1f2f10] truncate w-full">{noteData.subject}</dd>
                </div>
                <div className="rounded-xl xs:rounded-2xl bg-[#f7fbe9] px-3 xs:px-4 py-2.5 xs:py-3 w-full">
                  <dt className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-[#5f7050] sm:text-xs">
                    <GraduationCap className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-[#90c639]" />
                    Instructor
                  </dt>
                  <dd className="mt-1.5 xs:mt-2 text-xs xs:text-sm font-medium text-[#1f2f10] truncate w-full">{noteData.teacher}</dd>
                </div>
                <div className="rounded-xl xs:rounded-2xl bg-white px-3 xs:px-4 py-2.5 xs:py-3 ring-1 ring-lime-100 w-full">
                  <dt className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-[#5f7050] sm:text-xs">
                    <User className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-[#90c639]" />
                    Contributor
                  </dt>
                  <dd className="mt-1.5 xs:mt-2 text-xs xs:text-sm font-medium truncate w-full">
                    {contributorProfileUrl ? (
                      <Link
                        href={contributorProfileUrl}
                        className="text-[#1f2f10] hover:text-[#90c639] transition-colors duration-200 hover:underline"
                        title={`View ${noteData.contributor}'s profile`}
                      >
                        {noteData.contributor}
                      </Link>
                    ) : (
                      <span className="text-[#1f2f10]">{noteData.contributor}</span>
                    )}
                  </dd>
                </div>
                <div className="rounded-xl xs:rounded-2xl bg-gradient-to-br from-lime-50 to-green-50 px-3 xs:px-4 py-2.5 xs:py-3 ring-1 ring-lime-100 w-full">
                  <dt className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-lime-700 sm:text-xs">
                    <Sparkles className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-lime-600" />
                    Credibility
                  </dt>
                  <dd className="mt-1.5 xs:mt-2 text-xs xs:text-sm font-medium text-lime-800 w-full">{vibeDisplayValue}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-4 xs:mt-5 sm:mt-6 overflow-hidden rounded-2xl xs:rounded-3xl border border-lime-100 bg-white shadow-sm sm:mt-8 w-full">
            {isPDFUrl(noteUrl) ? (
              <PDFViewer url={noteUrl} title={`${noteData.subject} - ${noteData.teacher}`} />
            ) : (
              <div className="space-y-3 xs:space-y-4 w-full">
                <div className="flex flex-col gap-2 xs:gap-3 border-b border-lime-100 bg-[#f7fbe9] px-3 xs:px-4 py-3 xs:py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-left w-full">
                  <h2 className="text-sm xs:text-base font-semibold text-[#1f2f10] sm:text-lg">Note viewer</h2>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <ReportButton
                      noteId={noteData.id || ''}
                      size="sm"
                      variant="button"
                      className="text-[10px] xs:text-xs px-2 xs:px-2.5 py-1.5 xs:py-1.5"
                    />
                    <a
                      href={noteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 xs:gap-2 rounded-full bg-[#90c639] px-3 xs:px-4 py-2 text-xs xs:text-sm font-semibold text-white transition hover:bg-[#7ab332] touch-manipulation active:scale-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      <span className="hidden xs:inline">Open in new tab</span>
                      <span className="inline xs:hidden">Open</span>
                    </a>
                  </div>
                </div>
                <div className="px-3 xs:px-4 pb-4 xs:pb-6 sm:px-8 sm:pb-8 w-full">
                  <div className="rounded-xl xs:rounded-2xl border border-dashed border-lime-200 bg-[#f3f8e7] p-4 xs:p-5 text-center sm:p-6 w-full">
                    <p className="text-xs xs:text-sm text-[#4c5c3c] sm:text-base">
                      This note works best in a dedicated tab. Tap below to open it with your browser&apos;s viewer.
                    </p>
                    <a
                      href={noteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 xs:mt-4 inline-flex items-center gap-1.5 xs:gap-2 rounded-full bg-[#90c639] px-4 xs:px-5 py-2 text-xs xs:text-sm font-semibold text-white transition hover:bg-[#7ab332] touch-manipulation active:scale-95"
                    >
                      <ExternalLink className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                      <span className="hidden xs:inline">View full note</span>
                      <span className="inline xs:hidden">View</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </section>

          {!isPDFUrl(noteUrl) && !user && (
            <div className="mt-3 xs:mt-4 flex flex-col gap-2 xs:gap-3 rounded-xl xs:rounded-2xl border border-amber-200 bg-amber-50 px-3 xs:px-4 py-2.5 xs:py-3 sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm text-amber-700">
                <Shield className="h-3.5 w-3.5 xs:h-4 xs:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Join UoLink to unlock downloads and save notes for later.</span>
                <span className="inline xs:hidden">Join to unlock downloads & save notes</span>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center gap-1.5 xs:gap-2 rounded-full bg-amber-500 px-3 xs:px-4 py-2 text-xs xs:text-sm font-semibold text-white transition hover:bg-amber-600 touch-manipulation active:scale-95"
              >
                <LogIn className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                <span className="hidden xs:inline">Login / Sign up</span>
                <span className="inline xs:hidden">Sign up</span>
              </Link>
            </div>
          )}

          
          <section className="mt-5 xs:mt-6 rounded-2xl xs:rounded-3xl border border-lime-100 bg-white p-4 xs:p-5 shadow-sm sm:mt-8 sm:p-8 w-full">
            <CommentSection noteId={noteData.id || ''} />
          </section>

          <div className="mt-5 xs:mt-6 flex flex-col xs:flex-row flex-wrap justify-center gap-2 xs:gap-3 sm:mt-8 w-full">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 xs:gap-2 rounded-full bg-[#90c639] px-4 xs:px-5 py-2 text-xs xs:text-sm font-semibold text-white transition hover:bg-[#7ab332] touch-manipulation active:scale-95 w-full xs:w-auto"
            >
              <span className="hidden xs:inline">Browse more notes</span>
              <span className="inline xs:hidden">Browse notes</span>
            </Link>
            <Link
              href="/donate"
              className="inline-flex items-center justify-center gap-1.5 xs:gap-2 rounded-full border border-lime-100 bg-white px-4 xs:px-5 py-2 text-xs xs:text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10] touch-manipulation active:scale-95 w-full xs:w-auto"
            >
              <span className="hidden xs:inline">Support UoLink</span>
              <span className="inline xs:hidden">Support</span>
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
