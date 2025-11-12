import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import { getR2BucketName, getR2Client, buildR2PublicUrl } from '@/lib/r2'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { logAuditEvent, startRouteSpan, endRouteSpan, getRequestContext, logSecurityEvent } from '@/lib/security/logging'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const span = startRouteSpan('profile-picture.post', request)
    // Per-IP upload rate limit: 5/min
    const { enforceRateLimitOr429, rateLimitKeyByIp } = await import('@/lib/security/rateLimit')
    const rl = await enforceRateLimitOr429(request, 'upload', rateLimitKeyByIp(request, 'upload'))
    if (!rl.allowed) return rl.response

    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file received.' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 })
    }

    // Validate file size (5MB limit)
    const MAX_FILE_BYTES = 5 * 1024 * 1024
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 5 MB limit.' }, { status: 400 })
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const r2Client = getR2Client()
    const bucket = getR2BucketName()

    // Create unique filename for profile picture
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const uniqueFilename = `${decoded.uid}-${Date.now()}-${randomUUID()}.${fileExtension}`
    const objectKey = `profile-pictures/${uniqueFilename}`

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: file.type,
        ContentLength: file.size,
        Metadata: {
          uploadedBy: decoded.uid,
          originalFileName: file.name,
          type: 'profile-picture'
        },
      })
    )

    const fileUrl = buildR2PublicUrl(objectKey)

    const { ipAddress, userAgent } = getRequestContext(request)
    await logAuditEvent({
      action: 'PROFILE_PICTURE_UPLOAD',
      resource: decoded.uid,
      userId: decoded.uid,
      ipAddress,
      userAgent,
      correlationId: span.correlationId,
      details: { storageKey: objectKey, contentType: file.type, size: file.size },
    })
    const resp = NextResponse.json({
      fileUrl,
      storageKey: objectKey
    }, { status: 201 })
    resp.headers.set('X-RateLimit-Limit', rl.headers['X-RateLimit-Limit'])
    resp.headers.set('X-RateLimit-Remaining', rl.headers['X-RateLimit-Remaining'])
    resp.headers.set('X-RateLimit-Reset', rl.headers['X-RateLimit-Reset'])
    await endRouteSpan(span, 201)
    return resp

  } catch (error) {
    console.error('[api/profile-picture] Error occurred', error)
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({
      type: 'ERROR',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: startRouteSpan('profile-picture.post.error', request).correlationId,
      details: { message: error instanceof Error ? error.message : String(error) },
    })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to upload profile picture.'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const span = startRouteSpan('profile-picture.delete', request)
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authentication token.' }, { status: 401 })
    }

    const token = authorization.replace('Bearer ', '')
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    const { searchParams } = new URL(request.url)
    const storageKey = searchParams.get('key')

    if (!storageKey) {
      return NextResponse.json({ error: 'Missing storage key.' }, { status: 400 })
    }

    // Verify the storage key belongs to the user
    if (!storageKey.startsWith(`profile-pictures/${decoded.uid}-`)) {
      return NextResponse.json({ error: 'Unauthorized to delete this file.' }, { status: 403 })
    }

    const r2Client = getR2Client()
    const bucket = getR2BucketName()

    // Delete from R2
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    )
    const { ipAddress, userAgent } = getRequestContext(request)
    await logAuditEvent({
      action: 'PROFILE_PICTURE_DELETE',
      resource: decoded.uid,
      userId: decoded.uid,
      ipAddress,
      userAgent,
      correlationId: span.correlationId,
      details: { storageKey, bucket },
    })
    await endRouteSpan(span, 200)
    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    console.error('[api/profile-picture] Delete error occurred', error)
    const { ipAddress, userAgent, endpoint } = getRequestContext(request)
    await logSecurityEvent({
      type: 'ERROR',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: startRouteSpan('profile-picture.delete.error', request).correlationId,
      details: { message: error instanceof Error ? error.message : String(error) },
    })
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to delete profile picture.'
    }, { status: 500 })
  }
}
