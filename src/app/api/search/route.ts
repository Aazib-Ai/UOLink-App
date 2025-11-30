import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { ok } from '@/lib/api/response'
import { apiErrorByKey } from '@/lib/api/errors'
import { secureRoute } from '@/lib/security/middleware'
import { generateCorrelationId, startRouteSpan, endRouteSpan } from '@/lib/security/logging'
import { generateCacheKey, getCache, setCache } from '@/lib/cache/query-cache'
import { Timestamp } from 'firebase-admin/firestore'
import { normalizeForStorage } from '@/lib/utils'
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import { ensureFilterOptionsCacheWarmingServer } from '@/lib/cache/filter-cache-server'

type SearchResult = {
  results: any[]
  nextCursor?: string | null
  hasMore: boolean
}

function encodeCursor(uploadedAt: number, id: string): string {
  return Buffer.from(JSON.stringify({ t: uploadedAt, id }), 'utf8').toString('base64')
}

function decodeCursor(cursor: string | null): { uploadedAtMs: number } | null {
  if (!cursor) return null
  try {
    const obj = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'))
    if (typeof obj?.t === 'number') {
      return { uploadedAtMs: obj.t }
    }
    return null
  } catch {
    return null
  }
}

function sanitizeTerm(raw: string | null): string {
  const val = (raw || '').trim()
  if (!val) return ''
  return val.slice(0, 64)
}

export async function GET(request: NextRequest) {
  ensureFilterOptionsCacheWarmingServer()
  return secureRoute<never>(
    { routeName: 'search.get', requireAuth: false, rateLimitPreset: 'generic' },
    async ({ request }) => {
      const span = startRouteSpan('search.get', request)
      try {
        const url = request.nextUrl
        const term = sanitizeTerm(url.searchParams.get('term'))
        const subject = normalizeForStorage(url.searchParams.get('subject') || '')
        const teacher = normalizeForStorage(url.searchParams.get('teacher') || '')
        const materialType = normalizeForStorage(url.searchParams.get('materialType') || '')
        const semester = normalizeForStorage(url.searchParams.get('semester') || '')
        const section = normalizeForStorage(url.searchParams.get('section') || '')
        const limitParam = Number(url.searchParams.get('limit') || '20')
        const pageSize = Math.max(1, Math.min(50, Number.isFinite(limitParam) ? limitParam : 20))
        const cursorParam = url.searchParams.get('cursor') || null

        const params = {
          term: term.toLowerCase(),
          subject,
          teacher,
          materialType,
          semester,
          section,
          pageSize,
          cursor: cursorParam || ''
        }

        const cacheKey = generateCacheKey('search', params)
        const cached = await getCache<SearchResult>(cacheKey)
        if (cached) {
          await endRouteSpan(span, 200)
          return ok(cached)
        }

        const db = getAdminDb()
        let queryRef: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection('notes')

        // Apply equality filters server-side when provided
        if (subject) queryRef = queryRef.where('subject', '==', subject)
        if (teacher) queryRef = queryRef.where('teacher', '==', teacher)
        if (materialType) queryRef = queryRef.where('materialType', '==', materialType)
        if (semester) queryRef = queryRef.where('semester', '==', semester)
        if (section) queryRef = queryRef.where('section', '==', section)

        // If term matches canonical sets, prefer server-side filter
        const normalizedTerm = normalizeForStorage(term)
        const subjectSet = new Set(SUBJECT_NAMES.map((s) => normalizeForStorage(s)))
        const teacherSet = new Set(TEACHER_NAMES.map((t) => normalizeForStorage(t)))
        if (normalizedTerm) {
          if (!subject && subjectSet.has(normalizedTerm)) {
            queryRef = queryRef.where('subject', '==', normalizedTerm)
          } else if (!teacher && teacherSet.has(normalizedTerm)) {
            queryRef = queryRef.where('teacher', '==', normalizedTerm)
          } else if (!materialType && /^[a-z-]{3,}$/.test(normalizedTerm)) {
            queryRef = queryRef.where('materialType', '==', normalizedTerm)
          }
        }

        queryRef = queryRef.orderBy('uploadedAt', 'desc')

        const cursor = decodeCursor(cursorParam)
        if (cursor?.uploadedAtMs) {
          queryRef = queryRef.startAfter(Timestamp.fromMillis(cursor.uploadedAtMs))
        }

        // Fetch a larger batch to allow server-side term filtering; return up to pageSize
        const internalLimit = Math.min(pageSize * 3, 150)
        queryRef = queryRef.limit(internalLimit)
        const snapshot = await queryRef.get()

        const searchLower = term.toLowerCase()
        const results: any[] = []

        for (const doc of snapshot.docs) {
          const data = doc.data() || {}
          const uploadedAt = (data.uploadedAt instanceof Timestamp)
            ? data.uploadedAt.toMillis()
            : (typeof data.uploadedAt === 'number' ? data.uploadedAt : Date.now())

          // Basic mapping with normalized fields used by clients
          const note = {
            id: doc.id,
            subject: typeof data.subject === 'string' ? data.subject : '',
            module: typeof data.module === 'string' ? data.module : '',
            teacher: typeof data.teacher === 'string' ? data.teacher : (typeof data.module === 'string' ? data.module : ''),
            semester: typeof data.semester === 'string' ? data.semester : (data.semester != null ? String(data.semester) : ''),
            section: typeof data.section === 'string' ? data.section : (data.section != null ? String(data.section) : ''),
            materialType: typeof data.materialType === 'string' ? data.materialType : '',
            materialSequence: typeof data.materialSequence === 'string' ? (data.materialSequence.trim() || null) : (data.materialSequence != null ? (String(data.materialSequence).trim() || null) : null),
            contributorName: typeof data.contributorName === 'string' ? data.contributorName : '',
            contributorDisplayName: typeof data.contributorDisplayName === 'string' ? data.contributorDisplayName : undefined,
            uploaderUsername: typeof data.uploaderUsername === 'string' ? data.uploaderUsername : undefined,
            contributorMajor: typeof data.contributorMajor === 'string' ? data.contributorMajor : '',
            name: typeof data.name === 'string' ? data.name : '',
            uploadedBy: typeof data.uploadedBy === 'string' ? data.uploadedBy : '',
            uploadedAt: uploadedAt,
            upvoteCount: Number.isFinite(data.upvoteCount) ? Number(data.upvoteCount) : 0,
            downvoteCount: Number.isFinite(data.downvoteCount) ? Number(data.downvoteCount) : 0,
            saveCount: Number.isFinite(data.saveCount) ? Number(data.saveCount) : 0,
            reportCount: Number.isFinite(data.reportCount) ? Number(data.reportCount) : 0,
            credibilityScore: Number.isFinite(data.credibilityScore) ? Number(data.credibilityScore) : 0,
            fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : '',
          }

          // Apply term-based filtering server-side over fetched batch
          if (searchLower) {
            const matches =
              (note.subject?.toLowerCase() || '').includes(searchLower) ||
              (note.teacher?.toLowerCase() || '').includes(searchLower) ||
              (note.contributorName?.toLowerCase() || '').includes(searchLower) ||
              (note.materialType?.toLowerCase() || '').includes(searchLower) ||
              (note.section?.toLowerCase() || '').includes(searchLower) ||
              (note.name?.toLowerCase() || '').includes(searchLower)
            if (!matches) continue
          }

          results.push(note)
          if (results.length >= pageSize) break
        }

        const hasMore = snapshot.size === internalLimit && results.length === pageSize
        const lastIncluded = results[results.length - 1] || null
        const nextCursor = lastIncluded ? encodeCursor(Number(lastIncluded.uploadedAt) || Date.now(), lastIncluded.id) : null

        const payload: SearchResult = { results, nextCursor, hasMore }
        // Cache for 5 minutes
        await setCache(cacheKey, payload, 5 * 60 * 1000)

        await endRouteSpan(span, 200)
        return ok(payload)
      } catch (err: any) {
        await endRouteSpan(span, 500, err)
        return apiErrorByKey(500, 'INTERNAL_ERROR', err?.message || 'Failed to process search request')
      }
    }
  )(request)
}
