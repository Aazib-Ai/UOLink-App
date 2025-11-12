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
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL || undefined
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || undefined
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

