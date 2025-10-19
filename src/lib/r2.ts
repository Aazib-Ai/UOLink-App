import { S3Client } from '@aws-sdk/client-s3'
import { buildR2PublicUrlFromBase } from '@/lib/r2-shared'

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
