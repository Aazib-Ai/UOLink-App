interface BuildR2PublicUrlParams {
  baseUrl: string
  objectKey: string
}

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '')

export const buildR2PublicUrlFromBase = ({
  baseUrl,
  objectKey,
}: BuildR2PublicUrlParams): string => {
  const sanitizedKey = objectKey.replace(/^\/+/, '')

  try {
    const url = new URL(baseUrl)
    const basePath = trimSlashes(url.pathname)
    url.pathname = [basePath, sanitizedKey].filter(Boolean).join('/')
    return url.toString()
  } catch {
    const trimmedBase = baseUrl.replace(/\/+$/, '')
    return `${trimmedBase}/${sanitizedKey}`
  }
}

export const isR2LikeHost = (hostname: string) =>
  hostname.endsWith('.r2.dev') || hostname.endsWith('.r2.cloudflarestorage.com')

export const deriveR2ObjectKey = (urlString: string, bucketName?: string) => {
  try {
    const parsed = new URL(urlString)
    const host = parsed.hostname.toLowerCase()
    const segments = parsed.pathname.split('/').filter(Boolean)

    if (!segments.length) {
      return null
    }

    if (bucketName && segments[0] === bucketName) {
      return segments.slice(1).join('/') || null
    }

    if (isR2LikeHost(host)) {
      return segments.join('/')
    }

    return segments.join('/')
  } catch {
    return null
  }
}
