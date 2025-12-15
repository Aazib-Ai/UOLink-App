import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth } from '@/lib/firebaseAdmin'
import { normalizeForStorage } from '@/lib/utils'
import { randomUUID } from 'crypto'
import { getR2PresignedPutUrl, getR2BucketName } from '@/lib/r2'
import { enforceRateLimitOr429, rateLimitKeyByIp, rateLimitKeyByUser } from '@/lib/security/rateLimit'
import { startRouteSpan, endRouteSpan, logSecurityEvent, getRequestContext } from '@/lib/security/logging'
import { apiErrorByKey } from '@/lib/api/errors'
import { buildOptimizedObjectKey } from '@/lib/r2-shared'
import { resolveUploadDescriptorByExtension, resolveUploadDescriptorByMime } from '@/constants/uploadFileTypes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const slugify = (value: string) =>
  normalizeForStorage(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'misc'

export async function POST(request: NextRequest) {
  const span = startRouteSpan('upload.presign', request)
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

  const fileName = String(body.fileName || '')
  const contentType = String(body.contentType || '').toLowerCase()
  const fileSize = Number(body.fileSize || 0)
  const name = String(body.name || '')
  const subject = String(body.subject || '')
  const teacher = String(body.teacher || '')
  const semester = String(body.semester || '')

  if (!fileName || !contentType || !fileSize || !name || !subject || !teacher || !semester) {
    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Missing required fields')
  }

  const ext = fileName.includes('.') ? (fileName.split('.').pop() || '').toLowerCase() : ''
  const mimeMatch = resolveUploadDescriptorByMime(contentType)
  const extMatch = ext ? resolveUploadDescriptorByExtension(ext) : undefined
  if (!mimeMatch && !extMatch) {
    return apiErrorByKey(400, 'VALIDATION_ERROR', 'Unsupported file type')
  }

  const semesterSlug = slugify(semester)
  const subjectSlug = slugify(subject)
  const teacherSlug = slugify(teacher)
  const baseNameSource = fileName || name || `${subject}-${teacher}`
  const sanitizedOriginalName = slugify(baseNameSource.replace(/\.[^/.]+$/, '')) || slugify(name)

  const objectKey = buildOptimizedObjectKey({
    semesterSlug,
    subjectSlug,
    teacherSlug,
    baseName: sanitizedOriginalName,
    uniqueSuffix: `${Date.now()}-${randomUUID()}-${decoded.uid}`,
    extension: (extMatch?.extension || mimeMatch?.extension || 'bin'),
  })

  try {
    const ct = mimeMatch ? contentType : (extMatch?.mimeTypes?.[0] || contentType)
    const uploadUrl = await getR2PresignedPutUrl(objectKey, ct, fileSize)
    const bucket = getR2BucketName()
    await endRouteSpan(span, 200)
    return NextResponse.json({ uploadUrl, storageKey: objectKey, bucket }, { status: 200 })
  } catch (err: any) {
    const { ipAddress, userAgent } = getRequestContext(request)
    await logSecurityEvent({ type: 'R2_ERROR', severity: 'MEDIUM', ipAddress, userAgent, endpoint: span.endpoint, correlationId: span.correlationId, details: { message: err?.message } })
    await endRouteSpan(span, 502, err)
    return apiErrorByKey(502, 'STORAGE_ERROR', 'Unable to prepare upload')
  }
}
