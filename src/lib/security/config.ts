export type RateLimiterEnv = {
  env: string
  redisUrl?: string
  redisToken?: string
  requireRedisInProd: boolean
  devBypassEnabled: boolean
  devWhitelistIps: string[]
  blockBypassHeaderInProd: boolean
}

function parseCsv(val?: string): string[] {
  if (!val) return []
  return val
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function getRateLimiterEnv(): RateLimiterEnv {
  const env = process.env.NODE_ENV || 'development'

  // Validate Redis URL - must be a valid https URL
  let redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || undefined
  if (redisUrl && !redisUrl.startsWith('https://')) {
    console.warn('[RateLimit] Invalid Redis URL format (must start with https://), disabling Redis')
    redisUrl = undefined
  }

  // Validate Redis token - must be a non-empty string
  let redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || undefined
  if (redisToken && redisToken.trim().length === 0) {
    console.warn('[RateLimit] Empty Redis token, disabling Redis')
    redisToken = undefined
  }

  // If one credential is missing, disable both to prevent partial configuration
  if (redisUrl && !redisToken) {
    console.warn('[RateLimit] Redis URL provided but token missing, disabling Redis')
    redisUrl = undefined
  } else if (!redisUrl && redisToken) {
    console.warn('[RateLimit] Redis token provided but URL missing, disabling Redis')
    redisToken = undefined
  }

  const requireRedisInProd = true
  const devBypassEnabled = process.env.RATE_LIMIT_DEV_BYPASS_ENABLED === 'true'
  const devWhitelistIps = parseCsv(process.env.RATE_LIMIT_DEV_WHITELIST_IPS)
  const blockBypassHeaderInProd = true
  return {
    env,
    redisUrl,
    redisToken,
    requireRedisInProd,
    devBypassEnabled,
    devWhitelistIps,
    blockBypassHeaderInProd,
  }
}

