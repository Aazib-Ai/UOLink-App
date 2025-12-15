import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeForStorage } from '@/lib/utils'
import { FieldValue } from 'firebase-admin/firestore'
import { shouldUseSignedUrls, getR2SignedUrl, buildR2PublicUrl, getR2BucketName, getR2Client } from '@/lib/r2'
import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { enforceRateLimitOr429, rateLimitKeyByIp, rateLimitKeyByUser, RATE_LIMITS } from '@/lib/security/rateLimit'
import { startRouteSpan, endRouteSpan, logAuditEvent, logSecurityEvent, getRequestContext } from '@/lib/security/logging'
import { apiErrorByKey, apiError } from '@/lib/api/errors'
import { enforceNoteSchemaOnWrite } from '@/lib/data/note-schema'
import { invalidateFilterOptionsCacheServer, refreshFilterOptionsCacheServer, ensureFilterOptionsCacheWarmingServer } from '@/lib/cache/filter-cache-server'
import { invalidateTags } from '@/lib/cache/query-cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const slugify = (value: string) =>
  normalizeForStorage(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc'

export async function POST(request: NextRequest) {
  try {
    const span = startRouteSpan('upload.complete', request)
    const rlIp = await enforceRateLimitOr429(request, 'upload', rateLimitKeyByIp(request, 'upload'))
    if (!rlIp.allowed) return rlIp.response

    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return apiErrorByKey(401, 'UNAUTHORIZED', 'Missing authentication token.')
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    const rlUser = await enforceRateLimitOr429(request, 'upload', rateLimitKeyByUser(decoded.uid, 'upload'), decoded.email || undefined)
    if (!rlUser.allowed) return rlUser.response

    let body: any
    try {
      body = await request.json()
    } catch {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid JSON body')
    }

    const storageKey = String(body.storageKey || '')
    const name = String(body.name || '')
    const subject = String(body.subject || '')
    const teacher = String(body.teacher || '')
    const semester = String(body.semester || '')
    const section = String(body.section || '')
    const materialType = String(body.materialType || '')
    const materialSequence = String(body.materialSequence || '')
    const contributorName = String(body.contributorName || '')
    const contributorMajor = String(body.contributorMajor || '')
    const contentType = String(body.contentType || '')
    const fileSize = Number(body.fileSize || 0)
    const originalFileName = String(body.originalFileName || '')

    if (!storageKey || !name || !subject || !teacher || !semester || !section || !materialType || !contributorName || !contentType || !fileSize || !originalFileName) {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing required fields')
    }

    const db = getAdminDb()
    const profileRef = db.collection('profiles').doc(decoded.uid)
    const profileSnapshot = await profileRef.get()
    const profileData = profileSnapshot.exists ? profileSnapshot.data() ?? {} : {}
    if (!profileSnapshot.exists || profileData.profileCompleted !== true) {
      return NextResponse.json({ error: 'Please complete your profile before uploading materials.', code: 'PROFILE_INCOMPLETE', redirectTo: '/complete-profile' }, { status: 403 })
    }

    // Validate storageKey conforms to expected prefix and object exists in R2
    const semesterSlug = slugify(semester)
    const subjectSlug = slugify(subject)
    const teacherSlug = slugify(teacher)
    const baseNameSource = originalFileName || name || `${subject}-${teacher}`
    const sanitizedOriginalName = slugify(baseNameSource.replace(/\.[^/.]+$/, '')) || slugify(name)
    const expectedPrefix = `${semesterSlug}/${subjectSlug}-${teacherSlug}--${sanitizedOriginalName}-`
    if (!storageKey.startsWith(expectedPrefix)) {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid storage key format')
    }

    try {
      const client = getR2Client()
      const bucket = getR2BucketName()
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }))
      const sizeMatches = typeof head.ContentLength === 'number' ? head.ContentLength === fileSize : true
      if (!sizeMatches) {
        return apiErrorByKey(400, 'VALIDATION_ERROR', 'Uploaded file size mismatch')
      }
    } catch (e) {
      return apiErrorByKey(404, 'NOT_FOUND', 'Uploaded file not found')
    }

    const fileUrl = shouldUseSignedUrls() ? await getR2SignedUrl(storageKey) : buildR2PublicUrl(storageKey)
    const normalizedWrite = enforceNoteSchemaOnWrite({ semester, section, materialType, materialSequence })

    const notesCollection = db.collection('notes')
    const uploaderUsername = typeof profileData.username === 'string' ? profileData.username.trim() : null
    const contributorDisplayName = contributorName || decoded.email?.split('@')[0] || 'Anonymous'
    const bucket = getR2BucketName()

    const docRef = await notesCollection.add({
      name,
      subject: normalizeForStorage(subject),
      teacher: normalizeForStorage(teacher),
      module: normalizeForStorage(teacher),
      semester: normalizedWrite.semester,
      section: normalizedWrite.section,
      materialType,
      materialSequence: normalizedWrite.materialSequence,
      contributorName: contributorDisplayName,
      contributorDisplayName,
      uploaderUsername,
      contributorMajor,
      fileUrl,
      storageProvider: 'cloudflare-r2',
      storageBucket: bucket,
      storageKey,
      fileSize,
      contentType,
      fileExtension: (originalFileName.split('.').pop() || '').toLowerCase(),
      originalFileName,
      uploadedBy: decoded.uid,
      uploadedAt: FieldValue.serverTimestamp(),
      metadata: {
        createdBy: decoded.email,
        createdAt: new Date().toISOString(),
        section: normalizedWrite.section,
        materialType,
        materialSequence: normalizedWrite.materialSequence,
        contributorProfileId: decoded.uid,
        contributorMajor,
        teacher: normalizeForStorage(teacher),
      },
    })

    const { ipAddress, userAgent } = getRequestContext(request)
    await logAuditEvent({ action: 'NOTE_CREATE', resource: docRef.id, userId: decoded.uid, ipAddress, userAgent, correlationId: span.correlationId, details: { storageKey, bucket, size: fileSize, contentType } })

    try {
      ensureFilterOptionsCacheWarmingServer()
      await invalidateFilterOptionsCacheServer()
      await refreshFilterOptionsCacheServer()
      const majorTag = `major:${normalizeForStorage(contributorMajor || '')}`
      const semesterTag = `semester:${slugify(semester)}`
      await invalidateTags(['notes', 'initial', majorTag, semesterTag, 'leaderboard'])
    } catch {}

    try {
      const uploadedNoteSnap = await db.collection('notes').doc(docRef.id).get()
      const noteData = uploadedNoteSnap.data() || {}
      const noteCredibility = Number(noteData.credibilityScore || 0)
      const pData = profileSnapshot.exists ? (profileSnapshot.data() as any) : {}
      const currentTotalNotes = Number(pData.totalNotes || pData.notesCount || 0)
      const currentAvg = Number(pData.averageCredibility || 0)
      const currentSum = currentAvg * currentTotalNotes
      const newSum = currentSum + noteCredibility
      const newAvg = (currentTotalNotes + 1) > 0 ? newSum / (currentTotalNotes + 1) : 0
      await profileRef.set({ noteCount: FieldValue.increment(1), notesCount: FieldValue.increment(1), totalNotes: FieldValue.increment(1), aura: FieldValue.increment(10), averageCredibility: newAvg, lastStatsUpdate: FieldValue.serverTimestamp() }, { merge: true })
      const recentSnap = await db.collection('notes').where('uploadedBy', '==', decoded.uid).orderBy('uploadedAt', 'desc').limit(5).get()
      const topNotes = recentSnap.docs.map((d) => {
        const nd = d.data() as any
        return { id: d.id, name: String(nd.name || ''), subject: typeof nd.subject === 'string' ? nd.subject : undefined, uploadedAt: nd.uploadedAt, fileUrl: typeof nd.fileUrl === 'string' ? nd.fileUrl : undefined }
      })
      await profileRef.set({ topNotes }, { merge: true })
    } catch {}

    await endRouteSpan(span, 201)
    const limitMax = String(RATE_LIMITS.upload.max)
    const remainingCombined = String(Math.min(parseInt(rlIp.headers['X-RateLimit-Remaining'] || '0', 10), parseInt(rlUser.headers['X-RateLimit-Remaining'] || '0', 10)))
    const resetCombined = String(Math.max(parseInt(rlIp.headers['X-RateLimit-Reset'] || '0', 10), parseInt(rlUser.headers['X-RateLimit-Reset'] || '0', 10)))
    const resp = NextResponse.json({ id: docRef.id, fileUrl }, { status: 201 })
    resp.headers.set('X-RateLimit-Limit', limitMax)
    resp.headers.set('X-RateLimit-Remaining', remainingCombined)
    resp.headers.set('X-RateLimit-Reset', resetCombined)
    return resp
  } catch (error) {
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({ type: 'ERROR', severity: 'LOW', ipAddress, userAgent, endpoint, correlationId: startRouteSpan('upload.complete.error', request).correlationId, details: { message: error instanceof Error ? error.message : String(error) } })
    const details = error instanceof Error ? error.message : 'Unable to complete upload.'
    return apiError(500, { error: 'Internal server error', code: 'SERVER_ERROR', details })
  }
}
