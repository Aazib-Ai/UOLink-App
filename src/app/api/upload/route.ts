import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeForStorage } from '@/lib/utils'
import { FieldValue } from 'firebase-admin/firestore'
import { getR2BucketName, getR2Client, buildR2PublicUrl } from '@/lib/r2'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import {
  resolveUploadDescriptorByExtension,
  resolveUploadDescriptorByMime,
  getSupportedFileTypeSummary,
} from '@/constants/uploadFileTypes'

export const runtime = 'nodejs'

// Configure maximum request body size for large file uploads (25MB)
export const maxDuration = 60 // 60 seconds timeout for large uploads

// This is the key fix - Next.js 15 App Router needs this export
export const dynamic = 'force-dynamic'

const allowedEmailPattern = /^\d{8}@student\.uol\.edu\.pk$/i

const slugify = (value: string) =>
  normalizeForStorage(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc'

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    if (!decoded.email || !allowedEmailPattern.test(decoded.email)) {
      return NextResponse.json({ error: 'Only university accounts can upload materials.' }, { status: 403 })
    }

    // Handle large file uploads by processing formData with proper error handling
    let formData: FormData
    try {
      // Log request details for debugging
      console.log('[api/upload] Processing upload request, Content-Length:', request.headers.get('content-length'))

      formData = await request.formData()

      console.log('[api/upload] Successfully parsed form data')
    } catch (error) {
      console.error('[api/upload] Failed to parse form data:', error)

      // Check for specific error types
      if (error instanceof Error) {
        if (error.message.includes('size') || error.message.includes('limit') || error.message.includes('413')) {
          return NextResponse.json({
            error: 'File is too large. Please upload a file smaller than 25MB.',
            details: 'The server rejected the request due to file size limits.'
          }, { status: 413 })
        }

        if (error.message.includes('timeout')) {
          return NextResponse.json({
            error: 'Upload timeout. Please try uploading a smaller file or check your connection.',
            details: 'The upload took too long to complete.'
          }, { status: 408 })
        }
      }

      return NextResponse.json({
        error: 'Failed to process upload. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      }, { status: 400 })
    }
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 })
    }

    const originalFileName = (file.name || '').trim()
    const providedExtension =
      originalFileName && originalFileName.includes('.')
        ? (originalFileName.split('.').pop() ?? '').toLowerCase()
        : ''
    const mimeMatch = file.type ? resolveUploadDescriptorByMime(file.type) : undefined
    const extensionMatch = providedExtension ? resolveUploadDescriptorByExtension(providedExtension) : undefined

    if (!mimeMatch && !extensionMatch) {
      const summary = getSupportedFileTypeSummary()
      return NextResponse.json(
        {
          error: summary ? `Only ${summary} are supported.` : 'Unsupported file type.',
        },
        { status: 400 }
      )
    }

    const resolvedExtension = extensionMatch?.extension ?? mimeMatch?.extension ?? 'pdf'
    const normalizedContentType =
      file.type || mimeMatch?.mimeTypes[0] || extensionMatch?.mimeTypes[0] || 'application/octet-stream'

    const MAX_FILE_BYTES = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25') * 1024 * 1024)
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 25 MB limit.' }, { status: 400 })
    }

    const name = (formData.get('name') as string | null)?.trim()
    const subject = (formData.get('subject') as string | null)?.trim()
    const teacher = (formData.get('teacher') as string | null)?.trim()
    const semester = (formData.get('semester') as string | null)?.trim()
    const sectionRaw = (formData.get('section') as string | null)?.trim()?.toUpperCase()
    const materialTypeRaw = (formData.get('materialType') as string | null)?.trim()?.toLowerCase()
    const materialSequenceRaw = (formData.get('materialSequence') as string | null)?.trim()
    const contributorName = (formData.get('contributorName') as string | null)?.trim()
    const contributorMajor = (formData.get('contributorMajor') as string | null)?.trim()

    if (!name || !subject || !teacher || !semester || !sectionRaw || !materialTypeRaw) {
      return NextResponse.json({ error: 'Missing required metadata fields.' }, { status: 400 })
    }

    const allowedSemesters = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])
    if (!allowedSemesters.has(semester)) {
      return NextResponse.json({ error: 'Select a valid semester (1-8).' }, { status: 400 })
    }

    const allowedSections = new Set(['A', 'B', 'C'])
    if (!allowedSections.has(sectionRaw)) {
      return NextResponse.json({ error: 'Select a valid section (A, B, or C).' }, { status: 400 })
    }

    const allowedMaterialTypes = new Set([
      'assignment',
      'quiz',
      'lecture',
      'slides',
      'midterm-notes',
      'final-term-notes',
      'books',
    ])

    if (!allowedMaterialTypes.has(materialTypeRaw)) {
      return NextResponse.json({ error: 'Select a valid material type.' }, { status: 400 })
    }

    const requiresSequence = materialTypeRaw === 'assignment' || materialTypeRaw === 'quiz'
    if (requiresSequence) {
      const allowedSequence = new Set(['1', '2', '3', '4'])
      if (!materialSequenceRaw || !allowedSequence.has(materialSequenceRaw)) {
        return NextResponse.json({ error: 'Select a valid assignment or quiz number (1-4).' }, { status: 400 })
      }
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const r2Client = getR2Client()
    const bucket = getR2BucketName()
    const db = getAdminDb()

    // Validate contributor name from form data
    if (!contributorName || contributorName.trim() === '') {
      return NextResponse.json({ error: 'Contributor name is required.' }, { status: 400 })
    }

    const semesterSlug = slugify(semester)
    const subjectSlug = slugify(subject)
    const teacherSlug = slugify(teacher)

    const uniqueSuffix = `${Date.now()}-${randomUUID()}`
    const baseNameSource = originalFileName || name || `${subject}-${teacher}`
    const sanitizedOriginalName = slugify(baseNameSource.replace(/\.[^/.]+$/, '')) || slugify(name)
    const objectKey = `${semesterSlug}/${subjectSlug}/${teacherSlug}/${sanitizedOriginalName}-${uniqueSuffix}.${resolvedExtension}`

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
      profileFullName || contributorName || decoded.name || decoded.email?.split('@')[0] || 'Anonymous'
    const uploaderUsername = profileUsername || null

    await r2Client.send(
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
      })
    )

    const fileUrl = buildR2PublicUrl(objectKey)
    const notesCollection = db.collection('notes')
    const docRef = await notesCollection.add({
      name,
      subject: normalizeForStorage(subject),
      teacher: normalizeForStorage(teacher),
      module: normalizeForStorage(teacher), // Legacy module field for backward compatibility
      semester,
      section: sectionRaw,
      materialType: materialTypeRaw,
      materialSequence: requiresSequence ? materialSequenceRaw : null,
      contributorName: contributorDisplayName,
      contributorDisplayName,
      uploaderUsername,
      contributorMajor: contributorMajor || '',
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
        section: sectionRaw,
        materialType: materialTypeRaw,
        materialSequence: requiresSequence ? materialSequenceRaw : null,
        contributorProfileId: decoded.uid,
        contributorMajor: contributorMajor || '',
        teacher: normalizeForStorage(teacher),
      },
    })

    return NextResponse.json(
      {
        id: docRef.id,
        fileUrl,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[api/upload] Error occurred', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to upload the document right now.',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
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
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: storageKey,
          })
        )
      } catch (error) {
        console.error('[api/upload] Failed to delete R2 object', error)
        return NextResponse.json({ error: 'Unable to delete the stored file right now.' }, { status: 502 })
      }
    }

    await noteRef.delete()

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[api/upload] DELETE error', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to delete the note right now.',
      },
      { status: 500 }
    )
  }
}
