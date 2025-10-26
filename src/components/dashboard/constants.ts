import { toTitleCase } from "@/lib/utils"
import { resolveUploadDescriptorByUrl } from "@/constants/uploadFileTypes"

export const DONATORS: Array<{ name: string; amount: number }> = []

export const R2_PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL || ''
).trim()

export const R2_HOSTNAME = (() => {
  if (!R2_PUBLIC_BASE_URL) {
    return ''
  }

  try {
    return new URL(R2_PUBLIC_BASE_URL).hostname.toLowerCase()
  } catch {
    return ''
  }
})()

export const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'top', label: 'Top Rated' },
  { value: 'latest', label: 'Latest' },
] as const

export type SortMode = typeof SORT_OPTIONS[number]['value']

export const isPDFUrl = (url: string): boolean => {
  if (!url) {
    return false
  }

  const descriptor = resolveUploadDescriptorByUrl(url)
  if (descriptor) {
    return descriptor.extension === 'pdf'
  }

  if (R2_HOSTNAME) {
    try {
      const parsed = new URL(url)
      return parsed.hostname.toLowerCase() === R2_HOSTNAME
    } catch {
      return url.toLowerCase().includes(R2_HOSTNAME)
    }
  }

  return false
}

export const getCredibilityBadge = (score: number): { icon: 'flame' | 'skull' | null; classes: string } => {
  if (score > 10) {
    return {
      icon: 'flame',
      classes: 'border-orange-200 bg-orange-50 text-orange-700',
    }
  }

  if (score < -10) {
    return {
      icon: 'skull',
      classes: 'border-slate-700 bg-slate-900 text-gray-100',
    }
  }

  return {
    icon: null,
    classes: 'border-slate-200 bg-slate-100 text-slate-600',
  }
}

export const formatMaterialType = (value: string): string => {
  if (!value) {
    return 'Not specified'
  }
  return toTitleCase(value.replace(/-/g, ' '))
}

export const resolvePreviewImage = (note: any): string | null => {
  if (!note) {
    return "/placeholder.svg"
  }

  if (note.previewImageUrl) {
    return note.previewImageUrl
  }

  const url = typeof note.fileUrl === "string" ? note.fileUrl : ""

  // Handle Google Drive URLs
  if (url.includes("drive.google.com")) {
    const fileIdMatch = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/)
    if (fileIdMatch?.[1]) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1200`
    }
  }

  // For Cloudflare R2 PDF URLs, return null to handle with PDFThumbnail component
  if (isPDFUrl(url)) {
    return null
  }

  return "/placeholder.svg"
}

export const getTimestampAsDate = (value: any): Date | null => {
  if (!value) {
    return null
  }

  if (typeof value.toDate === 'function') {
    try {
      const converted = value.toDate()
      return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null
    } catch {
      return null
    }
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    const fromNumber = new Date(value)
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber
  }

  if (typeof value === 'string') {
    const fromString = new Date(value)
    return Number.isNaN(fromString.getTime()) ? null : fromString
  }

  return null
}

export const computeTrendingScore = (note: any): number => {
  const credibility = typeof note?.credibilityScore === 'number' ? note.credibilityScore : 0
  const referenceDate =
    getTimestampAsDate(note?.lastInteractionAt) ||
    getTimestampAsDate(note?.credibilityUpdatedAt) ||
    getTimestampAsDate(note?.uploadedAt) ||
    new Date()
  const ageHours = Math.max((Date.now() - referenceDate.getTime()) / (1000 * 60 * 60), 0)
  const freshnessBoost = Math.max(0, 72 - ageHours) / 4 // up to +18 for brand new notes
  return credibility + freshnessBoost
}
