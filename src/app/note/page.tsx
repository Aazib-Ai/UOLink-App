'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import PDFViewerLazy from '@/components/PDFViewerLazy'
import ReportButton from '@/components/ReportButton'
import { buildR2PublicUrlFromBase, deriveR2ObjectKey, isR2LikeHost } from '@/lib/r2-shared'
import { useAuth } from '@/contexts/AuthContext'
import { getAuraTier, formatAura } from '@/lib/aura'
import { slugify } from '@/lib/utils'
import { generateProfileUrl } from '@/lib/firebase/profile-resolver'
import {
  resolveUploadDescriptorByUrl,
  resolveUploadDescriptorByMime,
  resolveUploadDescriptorByExtension,
} from '@/constants/uploadFileTypes'
import {
  LogIn,
  Shield,
  Flame,
  Skull,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  GraduationCap,
  User,
  FileText,
} from 'lucide-react'
import PWADownloadButton from '@/components/PWADownloadButton'

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
  if (!url) {
    return false
  }

  const descriptor = resolveUploadDescriptorByUrl(url)
  if (descriptor) {
    return descriptor.extension === 'pdf'
  }

  if (r2Hostname) {
    try {
      const parsed = new URL(url)
      if (parsed.hostname.toLowerCase() === r2Hostname) {
        return true
      }
    } catch {
      if (url.toLowerCase().includes(r2Hostname)) {
        return true
      }
    }
  }

  return url.toLowerCase().includes('.pdf')
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

const getCredibilityBadge = (score: number): { icon: JSX.Element | null; classes: string } => {
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

function NotePageFallback() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f6f9ee]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-sm font-medium text-[#4c5c3c]">Loading note...</div>
        </div>
      </main>
    </>
  )
}

export default function NotePage() {
  return (
    <Suspense fallback={<NotePageFallback />}>
      <NotePageContent />
    </Suspense>
  )
}

function NotePageContent() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [noteData, setNoteData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const url = searchParams.get('url')
    const id = searchParams.get('id')
    const subject = searchParams.get('subject')
    const teacher = searchParams.get('teacher') ?? searchParams.get('module')
    const contributorLegacy = searchParams.get('contributor')
    const contributorDisplayNameParam = searchParams.get('contributorDisplayName')
    const contributorUsername = searchParams.get('contributorUsername')
    const storageProvider = searchParams.get('storageProvider')
    const storageKey = searchParams.get('storageKey')
    const storageBucket = searchParams.get('storageBucket')
    const credibilityScoreParam = Number.parseFloat(searchParams.get('credibilityScore') ?? '0')
    const safeCredibilityScore = Number.isFinite(credibilityScoreParam) ? credibilityScoreParam : 0
    const auraParam = Number.parseFloat(searchParams.get('aura') ?? '0')
    const safeAura = Number.isFinite(auraParam) ? auraParam : 0

    const decodedUrl = url ?? undefined
    const finalUrl = resolveNoteUrl({
      rawUrl: decodedUrl,
      storageProvider,
      storageKey,
      storageBucket,
    })

    const contributorDisplayName =
      contributorDisplayNameParam ?? contributorLegacy ?? 'Unknown'

    if (decodedUrl || storageKey) {
      setNoteData({
        url: finalUrl,
        rawUrl: decodedUrl,
        id,
        subject: subject ?? 'Unknown',
        teacher: teacher ?? 'Unknown',
        contributor: contributorDisplayName,
        contributorDisplayName,
        contributorUsername: contributorUsername ?? contributorLegacy ?? null,
        storageProvider,
        storageKey,
        storageBucket,
        aura: safeAura,
        credibilityScore: safeCredibilityScore,
      })
    } else {
      setNoteData(null)
    }

    setLoading(false)
  }, [searchParams])

  const noteUrl = useMemo(() => (noteData?.url ? noteData.url : ''), [noteData])
  const noteDescriptor = useMemo(() => {
    if (!noteData) {
      return noteUrl ? resolveUploadDescriptorByUrl(noteUrl) : undefined
    }

    const contentType =
      typeof noteData.contentType === 'string' ? noteData.contentType.trim() : ''
    if (contentType) {
      const descriptorByMime = resolveUploadDescriptorByMime(contentType)
      if (descriptorByMime) {
        return descriptorByMime
      }
    }

    const extension =
      typeof noteData.fileExtension === 'string' ? noteData.fileExtension.trim() : ''
    if (extension) {
      const descriptorByExtension = resolveUploadDescriptorByExtension(extension)
      if (descriptorByExtension) {
        return descriptorByExtension
      }
    }

    return noteUrl ? resolveUploadDescriptorByUrl(noteUrl) : undefined
  }, [noteData, noteUrl])
  const noteDescriptorSingular = useMemo(() => {
    if (!noteDescriptor?.label) {
      return 'document'
    }

    const label = noteDescriptor.label.trim()
    if (label.toLowerCase().endsWith('s')) {
      return label.slice(0, -1)
    }
    return label
  }, [noteDescriptor])
  const noteDescriptorLower = noteDescriptorSingular.toLowerCase()
  const credibilityScoreValue = useMemo(() => {
    const rawScore =
      typeof noteData?.credibilityScore === 'number'
        ? noteData.credibilityScore
        : Number.parseFloat(noteData?.credibilityScore ?? '0')
    return Number.isFinite(rawScore) ? Math.round(rawScore) : 0
  }, [noteData])
  const credibilityBadge = getCredibilityBadge(credibilityScoreValue)
  const credibilityDisplayValue = credibilityScoreValue > 0 ? `+${credibilityScoreValue}` : `${credibilityScoreValue}`
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
    if (!noteData) {
      return null
    }

    const username =
      typeof noteData.contributorUsername === 'string'
        ? noteData.contributorUsername.trim()
        : ''

    if (username) {
      return `/profile/${encodeURIComponent(username)}`
    }

    const legacyIdentifier =
      typeof noteData.contributor === 'string' ? noteData.contributor.trim() : ''

    if (legacyIdentifier) {
      return `/profile/${encodeURIComponent(legacyIdentifier)}`
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
                        title={`View ${(noteData.contributorDisplayName || noteData.contributor || 'Contributor')}'s profile`}
                      >
                        {noteData.contributorDisplayName || noteData.contributor}
                      </Link>
                    ) : (
                      <span className="text-[#1f2f10]">
                        {noteData.contributorDisplayName || noteData.contributor}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="rounded-xl xs:rounded-2xl bg-gradient-to-br from-lime-50 to-green-50 px-3 xs:px-4 py-2.5 xs:py-3 ring-1 ring-lime-100 w-full">
                  <dt className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-[11px] font-semibold uppercase tracking-wide text-lime-700 sm:text-xs">
                    <Sparkles className="h-3 w-3 xs:h-3.5 xs:w-3.5 text-lime-600" />
                    Credibility
                  </dt>
                  <dd className="mt-1.5 xs:mt-2 text-xs xs:text-sm font-medium text-lime-800 w-full">{credibilityDisplayValue}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-4 xs:mt-5 sm:mt-6 overflow-hidden rounded-2xl xs:rounded-3xl border border-lime-100 bg-white shadow-sm sm:mt-8 w-full">
            {isPDFUrl(noteUrl) ? (
              <PDFViewerLazy url={noteUrl} title={`${noteData.subject} - ${noteData.teacher}`} />
            ) : (
              <div className="space-y-3 xs:space-y-4 w-full">
                <div className="flex flex-col gap-2 xs:gap-3 border-b border-lime-100 bg-[#f7fbe9] px-3 xs:px-4 py-3 xs:py-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-left w-full">
                  <h2 className="text-sm xs:text-base font-semibold text-[#1f2f10] sm:text-lg">Document viewer</h2>
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <ReportButton
                      noteId={noteData.id || ''}
                      size="sm"
                      variant="button"
                      className="text-[10px] xs:text-xs px-2 xs:px-2.5 py-1.5 xs:py-1.5"
                    />
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f7050]">
                      <FileText className="h-3 w-3" />
                      {noteDescriptorSingular}
                    </div>
                  </div>
                </div>
                <div className="px-3 xs:px-4 pb-4 xs:pb-6 sm:px-8 sm:pb-8 w-full">
                  <div className="rounded-xl xs:rounded-2xl border border-dashed border-lime-200 bg-[#f3f8e7] p-4 xs:p-5 sm:p-6 text-center sm:text-left w-full">
                    <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#5f7050] sm:mx-0">
                      <FileText className="h-3 w-3" />
                      Preview coming soon
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-[#1f2f10] sm:text-base">
                      We&apos;re still polishing in-app previews for {noteDescriptorLower}.
                    </h3>
                    <p className="mt-2 text-xs xs:text-sm text-[#4c5c3c] sm:text-base">
                      Open it in your browser to flip through the slides or download a copy to keep studying without the internet.
                    </p>
                    <ul className="mt-3 space-y-1.5 text-[11px] text-[#5f7050] sm:text-sm">
                      <li>• Browser viewers keep the original layout for quick reading.</li>
                      <li>• Downloads give you an offline copy for highlighting and sharing.</li>
                    </ul>
                    <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-start">
                      <a
                        href={noteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#90c639] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#7ab332] touch-manipulation active:scale-95 sm:w-auto sm:text-sm"
                      >
                        <ExternalLink className="h-3.5 w-3.5 xs:h-4 xs:w-4" />
                        Open {noteDescriptorSingular}
                      </a>
                      <PWADownloadButton
                        url={noteUrl}
                        title={`${noteData.subject ?? 'note'}-${noteData.teacher ?? ''}`}
                        className="w-full justify-center rounded-full border border-lime-200 text-xs font-semibold text-[#334125] hover:border-[#90c639] sm:w-auto sm:text-sm"
                      >
                        Download {noteDescriptorSingular}
                      </PWADownloadButton>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {!isPDFUrl(noteUrl) && !user && (
            <div className="mt-3 xs:mt-4 flex flex-col gap-2 xs:gap-3 rounded-xl xs:rounded-2xl border border-amber-200 bg-amber-50 px-3 xs:px-4 py-2.5 xs:py-3 sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm text-amber-700">
                <Shield className="h-3.5 w-3.5 xs:h-4 xs:w-4 flex-shrink-0" />
                <span className="hidden xs:inline">Join UoLink to unlock downloads and save this {noteDescriptorLower} for later.</span>
                <span className="inline xs:hidden">Join to unlock downloads</span>
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
