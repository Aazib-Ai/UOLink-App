import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { buildR2PublicUrlFromBase } from '@/lib/r2-shared'
import { logSecurityEvent, logR2Operation, generateCorrelationId } from '@/lib/security/logging'

let cachedClient: S3Client | null = null

const DEFAULT_REGION = 'auto'

const requiredEnv = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`${name} is not configured. Update your environment variables.`)
  }
  return value
}

export const getR2Client = () => {
  if (cachedClient) {
    return cachedClient
  }

  const accessKeyId = requiredEnv(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, 'CLOUDFLARE_R2_ACCESS_KEY_ID')
  const secretAccessKey = requiredEnv(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY, 'CLOUDFLARE_R2_SECRET_ACCESS_KEY')

  const endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ??
    (() => {
      const accountId = requiredEnv(process.env.CLOUDFLARE_R2_ACCOUNT_ID, 'CLOUDFLARE_R2_ACCOUNT_ID')
      return `https://${accountId}.r2.cloudflarestorage.com`
    })()

  cachedClient = new S3Client({
    region: DEFAULT_REGION,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return cachedClient
}

export const getR2BucketName = () =>
  requiredEnv(process.env.CLOUDFLARE_R2_BUCKET_NAME, 'CLOUDFLARE_R2_BUCKET_NAME')

export const buildR2PublicUrl = (objectKey: string) => {
  const baseUrl = requiredEnv(
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL,
    'CLOUDFLARE_R2_PUBLIC_BASE_URL'
  )

  return buildR2PublicUrlFromBase({
    baseUrl,
    objectKey,
  })
}

/**
 * Generate a signed URL for accessing an object in R2.
 * Defaults to 300 seconds (5 minutes) expiration if not configured.
 */
export const getR2SignedUrl = async (
  objectKey: string,
  expiresSeconds?: number
): Promise<string> => {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const ttl = typeof expiresSeconds === 'number'
    ? Math.max(60, expiresSeconds)
    : Math.max(60, parseInt(process.env.R2_SIGNED_URL_TTL_SECONDS || '300', 10))

  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  return await getSignedUrl(client, command, { expiresIn: ttl })
}

export const getR2PresignedPutUrl = async (
  objectKey: string,
  contentType: string,
  contentLength?: number,
  expiresSeconds?: number
): Promise<string> => {
  const client = getR2Client()
  const bucket = getR2BucketName()
  const ttl = typeof expiresSeconds === 'number'
    ? Math.max(60, expiresSeconds)
    : Math.max(60, parseInt(process.env.R2_SIGNED_URL_TTL_SECONDS || '300', 10))

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return await getSignedUrl(client, command, { expiresIn: ttl })
}

/**
 * Helper to decide whether signed URLs should be used for sensitive resources.
 * Controlled by `R2_SIGNED_URLS_ENABLED` environment flag.
 */
export const shouldUseSignedUrls = (): boolean => {
  const flag = (process.env.R2_SIGNED_URLS_ENABLED || 'true').toLowerCase()
  return flag === 'true' || flag === '1'
}

/**
 * Execute an R2 operation with exponential backoff retry and logging.
 */
export async function r2SendWithRetry<T = any>(
  command: any,
  options?: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    operation?: 'put' | 'get' | 'delete' | 'head' | 'copy'
    objectKey?: string
  }
): Promise<T> {
  const client = getR2Client()
  const correlationId = generateCorrelationId()
  const op = options?.operation || 'head'
  const key = options?.objectKey

  const maxRetries = Math.max(1, options?.maxRetries ?? 3)
  const baseDelay = Math.max(50, options?.baseDelayMs ?? 100)
  const maxDelay = Math.max(baseDelay, options?.maxDelayMs ?? 2000)

  let attempt = 0
  let lastError: any = null

  while (attempt <= maxRetries) {
    try {
      const result = await client.send(command)
      await logR2Operation(op, true, { objectKey: key, attempt })
      return result as T
    } catch (error) {
      lastError = error
      const isLast = attempt >= maxRetries
      await logR2Operation(op, false, {
        objectKey: key,
        attempt,
        message: (error as Error)?.message,
      })

      if (isLast) break
      const delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt))
      await new Promise((res) => setTimeout(res, delay))
      attempt++
    }
  }

  // Log R2-specific error event
  await logSecurityEvent({
    type: 'R2_ERROR',
    severity: 'MEDIUM',
    details: {
      operation: op,
      objectKey: key,
      message: (lastError as Error)?.message || String(lastError),
    },
    correlationId,
    timestamp: new Date(),
  })

  throw lastError
}
