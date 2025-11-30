import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeForStorage } from '@/lib/utils'
import { FieldValue } from 'firebase-admin/firestore'
import { getR2BucketName, getR2Client, buildR2PublicUrl, r2SendWithRetry, shouldUseSignedUrls, getR2SignedUrl } from '@/lib/r2'
import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import {
  resolveUploadDescriptorByExtension,
  resolveUploadDescriptorByMime,
  getSupportedFileTypeSummary,
} from '@/constants/uploadFileTypes'
import { validateFileUpload, parseAndValidateUploadFormData, detectUploadDescriptorFromBuffer } from '@/lib/security/validation'
import { apiErrorByKey, apiError } from '@/lib/api/errors'
import { enforceRateLimitOr429, rateLimitKeyByIp, rateLimitKeyByUser, RATE_LIMITS } from '@/lib/security/rateLimit'
import { logAuditEvent, logSecurityEvent, startRouteSpan, endRouteSpan, getRequestContext } from '@/lib/security/logging'
import { invalidateFilterOptionsCacheServer, refreshFilterOptionsCacheServer, ensureFilterOptionsCacheWarmingServer } from '@/lib/cache/filter-cache-server'
import { enforceNoteSchemaOnWrite } from '@/lib/data/note-schema'
import { invalidateTags } from '@/lib/cache/query-cache'
import { buildOptimizedObjectKey, getObjectKeyDepth } from '@/lib/r2-shared'

export const runtime = 'nodejs'

// Configure maximum request body size for large file uploads (25MB)
export const maxDuration = 60 // 60 seconds timeout for large uploads

// This is the key fix - Next.js 15 App Router needs this export
export const dynamic = 'force-dynamic'

const allowedEmailPattern = /^\d{8}@student\.uol\.edu\.pk$/i

// Control local debug logging; quiet in production unless explicitly enabled
const VERBOSE_LOGS =
  process.env.LOG_API_VERBOSE === 'true' ||
  process.env.LOG_API_VERBOSE === '1' ||
  process.env.NODE_ENV !== 'production'

const slugify = (value: string) =>
  normalizeForStorage(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc'

export async function POST(request: NextRequest) {
  try {
    const span = startRouteSpan('upload.post', request)
    // Rate limit per IP for uploads: 5/min
    const rlIp = await enforceRateLimitOr429(request, 'upload', rateLimitKeyByIp(request, 'upload'))
    if (!rlIp.allowed) return rlIp.response

    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return apiErrorByKey(401, 'UNAUTHORIZED', 'Missing authentication token.')
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    if (!decoded.email_verified) {
      return apiErrorByKey(403, 'FORBIDDEN', 'Verify your email before uploading materials.')
    }
    const rlUser = await enforceRateLimitOr429(request, 'upload', rateLimitKeyByUser(decoded.uid, 'upload'), decoded.email || undefined)
    if (!rlUser.allowed) return rlUser.response

    if (!decoded.email || !allowedEmailPattern.test(decoded.email)) {
      return apiErrorByKey(403, 'FORBIDDEN', 'Only university accounts can upload materials.')
    }

    // Handle large file uploads by processing formData with proper error handling
    let formData: FormData
    try {
      // Log request details for debugging
      if (VERBOSE_LOGS) {
        console.log('[api/upload] Processing upload request, Content-Length:', request.headers.get('content-length'))
      }

      formData = await request.formData()

      if (VERBOSE_LOGS) {
        console.log('[api/upload] Successfully parsed form data')
      }
    } catch (error) {
      console.error('[api/upload] Failed to parse form data:', error)

      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('size') || error.message.includes('limit') || error.message.includes('413')) {
          return apiErrorByKey(413, 'VALIDATION_ERROR', 'File is too large. Please upload a file smaller than 25MB.')
        }

        if (error.message.includes('timeout')) {
          return apiErrorByKey(408, 'VALIDATION_ERROR', 'Upload timeout. Please try again later.')
        }
      }

      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Failed to process upload. Please try again.')
    }
    const file = formData.get('file') as File | null
    if (!file) {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'No file received.')
    }

    const fileValidation = validateFileUpload(file)
    if (!fileValidation.isValid) {
      const msg = fileValidation.errors[0]?.message || 'Invalid file'
      return apiErrorByKey(400, 'VALIDATION_ERROR', msg)
    }
    const originalFileName = (file.name || '').trim()
    let resolvedExtension = fileValidation.sanitizedData!.extension
    let normalizedContentType = fileValidation.sanitizedData!.contentType

    const metaValidation = parseAndValidateUploadFormData(formData)
    if (!metaValidation.isValid) {
      const msg = metaValidation.errors[0]?.message || 'Invalid metadata'
      return apiErrorByKey(400, 'VALIDATION_ERROR', msg)
    }
    const { meta } = metaValidation.sanitizedData!

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const detected = await detectUploadDescriptorFromBuffer(originalFileName, fileBuffer)
    if (!detected) {
      return apiErrorByKey(400, 'VALIDATION_ERROR', 'Unsupported or invalid file content')
    }
    const clientExt = resolvedExtension
    const clientType = normalizedContentType
    const serverExt = detected.extension
    const serverType = detected.contentType
    if (clientExt !== serverExt || clientType.toLowerCase() !== serverType.toLowerCase()) {
      const { ipAddress, userAgent } = getRequestContext(request)
      await logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        endpoint: span.endpoint,
        correlationId: span.correlationId,
        userId: decoded.uid,
        ipAddress,
        userAgent,
        details: { reason: 'mismatch_client_vs_server_file_type', clientExt, clientType, serverExt, serverType }
      })
    }
    resolvedExtension = serverExt
    normalizedContentType = serverType
    const r2Client = getR2Client()
    const bucket = getR2BucketName()
    const db = getAdminDb()

    // contributorName validated above

    const semesterSlug = slugify(meta.semester)
    const subjectSlug = slugify(meta.subject)
    const teacherSlug = slugify(meta.teacher)

    const uniqueSuffix = `${Date.now()}-${randomUUID()}`
    const baseNameSource = originalFileName || meta.name || `${meta.subject}-${meta.teacher}`
    const sanitizedOriginalName = slugify(baseNameSource.replace(/\.[^/.]+$/, '')) || slugify(meta.name)
    const objectKey = buildOptimizedObjectKey({
      semesterSlug,
      subjectSlug,
      teacherSlug,
      baseName: sanitizedOriginalName,
      uniqueSuffix,
      extension: resolvedExtension,
    })

    const profileRef = db.collection('profiles').doc(decoded.uid)
    const profileSnapshot = await profileRef.get()
    const profileData = profileSnapshot.exists ? profileSnapshot.data() ?? {} : {}

    // Check if profile is completed
    if (!profileSnapshot.exists || profileData.profileCompleted !== true) {
      return NextResponse.json({
        error: 'Please complete your profile before uploading materials. You need to provide your full name, major, semester, and section.',
        code: 'PROFILE_INCOMPLETE',
        redirectTo: '/complete-profile'
      }, { status: 403 })
    }

    const profileFullName =
      typeof profileData.fullName === 'string' ? profileData.fullName.trim() : ''
    const profileUsername =
      typeof profileData.username === 'string' ? profileData.username.trim() : ''
    const contributorDisplayName =
      profileFullName || meta.contributorName || decoded.name || decoded.email?.split('@')[0] || 'Anonymous'
    const uploaderUsername = profileUsername || null

    try {
      await r2SendWithRetry(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: fileBuffer,
          ContentType: normalizedContentType,
          ContentLength: file.size,
          Metadata: {
            uploadedBy: decoded.uid,
            originalFileName: file.name,
          },
        }),
        { operation: 'put', objectKey }
      )
    } catch (err) {
      return apiError(502, { error: 'Unable to store file at the moment.', code: 'STORAGE_ERROR', details: (err as Error)?.message })
    }

    const fileUrl = shouldUseSignedUrls()
      ? await getR2SignedUrl(objectKey)
      : buildR2PublicUrl(objectKey)
    const normalizedWrite = enforceNoteSchemaOnWrite({
      semester: meta.semester,
      section: meta.section,
      materialType: meta.materialType,
      materialSequence: meta.materialSequence,
    })

    const notesCollection = db.collection('notes')
    const docRef = await notesCollection.add({
      name: meta.name,
      subject: normalizeForStorage(meta.subject),
      teacher: normalizeForStorage(meta.teacher),
      module: normalizeForStorage(meta.teacher), // Legacy module field for backward compatibility
      semester: normalizedWrite.semester,
      section: normalizedWrite.section,
      materialType: meta.materialType,
      materialSequence: normalizedWrite.materialSequence,
      contributorName: contributorDisplayName,
      contributorDisplayName,
      uploaderUsername,
      contributorMajor: meta.contributorMajor || '',
      fileUrl,
      storageProvider: 'cloudflare-r2',
      storageBucket: bucket,
      storageKey: objectKey,
      fileSize: file.size,
      contentType: normalizedContentType,
      fileExtension: resolvedExtension,
      originalFileName: file.name,
      uploadedBy: decoded.uid,
      uploadedAt: FieldValue.serverTimestamp(),
      metadata: {
        createdBy: decoded.email,
        createdAt: new Date().toISOString(),
        section: normalizedWrite.section,
        materialType: meta.materialType,
        materialSequence: normalizedWrite.materialSequence,
        contributorProfileId: decoded.uid,
        contributorMajor: meta.contributorMajor || '',
        teacher: normalizeForStorage(meta.teacher),
      },
    })

    const { ipAddress, userAgent } = getRequestContext(request)
    await logAuditEvent({
      action: 'NOTE_CREATE',
      resource: docRef.id,
      userId: decoded.uid,
      ipAddress,
      userAgent,
      correlationId: span.correlationId,
      details: { objectKey, bucket, size: file.size, contentType: normalizedContentType, keyDepth: getObjectKeyDepth(objectKey) },
    })
    await logSecurityEvent({
      type: 'DATA_ACCESS',
      userId: decoded.uid,
      ipAddress,
      userAgent,
      endpoint: span.endpoint,
      correlationId: span.correlationId,
      details: { action: 'create_note', noteId: docRef.id },
    })
    const resp = NextResponse.json(
      {
        id: docRef.id,
        fileUrl,
      },
      { status: 201 }
    )

    try {
      ensureFilterOptionsCacheWarmingServer()
      await invalidateFilterOptionsCacheServer()
      await refreshFilterOptionsCacheServer()
      const majorTag = `major:${normalizeForStorage(meta.contributorMajor || '')}`
      const semesterTag = `semester:${slugify(meta.semester)}`
      await invalidateTags(['notes', 'initial', majorTag, semesterTag, 'leaderboard'])
    } catch {}

    // Denormalize: increment contributor's notes counters on profile and set averageCredibility immediately
    try {
      const uploadedNoteRef = db.collection('notes').doc(docRef.id)
      const uploadedNoteSnap = await uploadedNoteRef.get()
      const noteData = uploadedNoteSnap.data() || {}
      const noteCredibility = Number(noteData.credibilityScore || 0)

      const profSnap = await profileRef.get()
      const pData = profSnap.exists ? (profSnap.data() as any) : {}
      const currentTotalNotes = Number(pData.totalNotes || pData.notesCount || 0)
      const currentAvg = Number(pData.averageCredibility || 0)
      const currentSum = currentAvg * currentTotalNotes
      const newSum = currentSum + noteCredibility
      const newAvg = (currentTotalNotes + 1) > 0 ? newSum / (currentTotalNotes + 1) : 0

      await profileRef.set({
        noteCount: FieldValue.increment(1),
        notesCount: FieldValue.increment(1),
        totalNotes: FieldValue.increment(1),
        aura: FieldValue.increment(10),
        averageCredibility: newAvg,
        lastStatsUpdate: FieldValue.serverTimestamp()
      }, { merge: true })

      const recentSnap = await db
        .collection('notes')
        .where('uploadedBy', '==', decoded.uid)
        .orderBy('uploadedAt', 'desc')
        .limit(5)
        .get()
      const topNotes = recentSnap.docs.map((d) => {
        const nd = d.data() as any
        return {
          id: d.id,
          name: String(nd.name || ''),
          subject: typeof nd.subject === 'string' ? nd.subject : undefined,
          uploadedAt: nd.uploadedAt,
          fileUrl: typeof nd.fileUrl === 'string' ? nd.fileUrl : undefined,
        }
      })
      await profileRef.set({ topNotes }, { merge: true })
    } catch (incErr) {
      if (VERBOSE_LOGS) {
        console.warn('[api/upload] Failed to increment notesCount for profile', incErr)
      }
    }

    await endRouteSpan(span, 201)
    const limitMax = String(RATE_LIMITS.upload.max)
    const remainingCombined = String(
      Math.min(
        parseInt(rlIp.headers['X-RateLimit-Remaining'] || '0', 10),
        parseInt(rlUser.headers['X-RateLimit-Remaining'] || '0', 10)
      )
    )
    const resetCombined = String(
      Math.max(
        parseInt(rlIp.headers['X-RateLimit-Reset'] || '0', 10),
        parseInt(rlUser.headers['X-RateLimit-Reset'] || '0', 10)
      )
    )
    resp.headers.set('X-RateLimit-Limit', limitMax)
    resp.headers.set('X-RateLimit-Remaining', remainingCombined)
    resp.headers.set('X-RateLimit-Reset', resetCombined)
    return resp
  } catch (error) {
    console.error('[api/upload] Error occurred', error)
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({
      type: 'ERROR',
      severity: 'LOW',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: startRouteSpan('upload.post.error', request).correlationId,
      details: { message: error instanceof Error ? error.message : String(error) },
    })
    const details = error instanceof Error ? error.message : 'Unable to upload the document right now.'
    return apiError(500, { error: 'Internal server error', code: 'SERVER_ERROR', details })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const span = startRouteSpan('upload.delete', request)
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    const url = new URL(request.url)
    const noteId = url.searchParams.get('noteId')?.trim()

    if (!noteId) {
      return NextResponse.json({ error: 'Note identifier is required.' }, { status: 400 })
    }

    const db = getAdminDb()
    const noteRef = db.collection('notes').doc(noteId)
    const snapshot = await noteRef.get()

    if (!snapshot.exists) {
      return NextResponse.json({ error: 'Note not found.' }, { status: 404 })
    }

    const data = snapshot.data() ?? {}
    const metadata = (data.metadata ?? {}) as Record<string, unknown>
    const metadataCreatedBy =
      typeof metadata['createdBy'] === 'string' ? (metadata['createdBy'] as string) : ''
    const dataCreatedBy = typeof data.createdBy === 'string' ? data.createdBy : ''

    const uploadedBy = typeof data.uploadedBy === 'string' ? data.uploadedBy : ''
    const createdByEmail = metadataCreatedBy
      ? metadataCreatedBy.toLowerCase()
      : dataCreatedBy
        ? dataCreatedBy.toLowerCase()
        : ''

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase() ?? ''
    const currentEmail = decoded.email?.toLowerCase() ?? ''

    const isOwner = decoded.uid === uploadedBy
    const isCreator = createdByEmail && createdByEmail === currentEmail
    const isAdmin = adminEmail && currentEmail === adminEmail

    if (!isOwner && !isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this note.' }, { status: 403 })
    }

    const storageProvider = typeof data.storageProvider === 'string' ? data.storageProvider : ''
    const storageKey = typeof data.storageKey === 'string' ? data.storageKey : ''
    const storedBucket = typeof data.storageBucket === 'string' ? data.storageBucket : ''

    if (storageProvider === 'cloudflare-r2' && storageKey) {
      try {
        const r2Client = getR2Client()
        const bucket = storedBucket || getR2BucketName()
        try {
          await r2SendWithRetry(
            new DeleteObjectCommand({
              Bucket: bucket,
              Key: storageKey,
            }),
            { operation: 'delete', objectKey: storageKey }
          )
        } catch (error) {
          console.error('[api/upload] Failed to delete R2 object', error)
          // Log R2-specific deletion error
          await logSecurityEvent({
            type: 'R2_ERROR',
            severity: 'MEDIUM',
            correlationId: startRouteSpan('upload.delete.r2.error', request).correlationId,
            details: { action: 'delete', storageKey, bucket, message: (error as Error)?.message },
          })
          return NextResponse.json({ error: 'Unable to delete the stored file right now.' }, { status: 502 })
        }
      } catch (error) {
        console.error('[api/upload] Failed to delete R2 object', error)
        return NextResponse.json({ error: 'Unable to delete the stored file right now.' }, { status: 502 })
      }
    }

    await noteRef.delete()

    // Denormalize: decrement contributor's notes counters on profile
    try {
      const uploaderId = uploadedBy
      if (uploaderId) {
        const dbAdmin = getAdminDb()
        const contributorProfileRef = dbAdmin.collection('profiles').doc(uploaderId)
        await contributorProfileRef.set({
          noteCount: FieldValue.increment(-1),
          notesCount: FieldValue.increment(-1),
          totalNotes: FieldValue.increment(-1),
          lastStatsUpdate: FieldValue.serverTimestamp()
        }, { merge: true })

        const recentSnap = await dbAdmin
          .collection('notes')
          .where('uploadedBy', '==', uploaderId)
          .orderBy('uploadedAt', 'desc')
          .limit(5)
          .get()
        const topNotes = recentSnap.docs.map((d) => {
          const nd = d.data() as any
          return {
            id: d.id,
            name: String(nd.name || ''),
            subject: typeof nd.subject === 'string' ? nd.subject : undefined,
            uploadedAt: nd.uploadedAt,
            fileUrl: typeof nd.fileUrl === 'string' ? nd.fileUrl : undefined,
          }
        })
        await contributorProfileRef.set({ topNotes }, { merge: true })
      }
    } catch (decErr) {
      console.warn('[api/upload] Failed to decrement notesCount for profile', decErr)
    }

    try {
      const majorTag = `major:${normalizeForStorage(typeof data.contributorMajor === 'string' ? data.contributorMajor : '')}`
      const semesterTag = `semester:${slugify(typeof data.semester === 'string' ? data.semester : String(data.semester || ''))}`
      await invalidateTags(['notes', 'initial', majorTag, semesterTag, 'leaderboard'])
    } catch {}
    const { ipAddress, userAgent } = getRequestContext(request)
    await logAuditEvent({
      action: 'NOTE_DELETE',
      resource: noteId,
      userId: decoded.uid,
      ipAddress,
      userAgent,
      correlationId: span.correlationId,
      details: { storageKey, bucket: storedBucket || getR2BucketName() },
    })
    await endRouteSpan(span, 200)
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[api/upload] DELETE error', error)
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({
      type: 'ERROR',
      severity: 'LOW',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: startRouteSpan('upload.delete.error', request).correlationId,
      details: { message: error instanceof Error ? error.message : String(error) },
    })
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to delete the note right now.',
      },
      { status: 500 }
    )
  }
}
