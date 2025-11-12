import { NextRequest, NextResponse } from 'next/server'
import { logSecurityEvent, generateCorrelationId, getRequestContext } from '@/lib/security/logging'
import { Redis } from '@upstash/redis'
import { getRateLimiterEnv } from '@/lib/security/config'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator: (req: NextRequest) => string
  skipSuccessfulRequests?: boolean
  bypassEnabled?: boolean // explicit bypass control (dev only)
  whitelistedIPs?: string[] // IP whitelist for dev bypass
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number // epoch seconds when window resets
  source?: 'redis' | 'memory'
}

type LimitPreset = 'upload' | 'comment' | 'like' | 'profile' | 'generic' | 'username_check' | 'username_change'

const RATE_LIMITS: Record<LimitPreset, { windowMs: number; max: number }> = {
  upload: { windowMs: 60_000, max: 5 },
  comment: { windowMs: 60_000, max: 10 },
  like: { windowMs: 60_000, max: 20 },
  profile: { windowMs: 60_000, max: 10 },
  generic: { windowMs: 60_000, max: 60 },
  username_check: { windowMs: 60_000, max: 50 },
  username_change: { windowMs: 60 * 60 * 1000, max: 5 },
}

const RL_ENV = getRateLimiterEnv()
const isProduction = RL_ENV.env === 'production'
const isRedisAvailable = Boolean(RL_ENV.redisUrl && RL_ENV.redisToken)
const redis = isRedisAvailable ? new Redis({
  url: RL_ENV.redisUrl!,
  token: RL_ENV.redisToken!,
}) : null

// Simple in-memory fallback for local testing when Redis is not configured
const memoryCooldown = new Map<string, number>() // key -> expiresAtMs
const memoryWindows = new Map<string, number[]>() // key -> timestamps

function getClientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for') || ''
  const ip = xf.split(',')[0].trim() || (req as any).ip || 'unknown'
  return ip
}

export function rateLimitKeyByIp(req: NextRequest, preset: LimitPreset): string {
  return `rl:${preset}:ip:${getClientIp(req)}`
}

export function rateLimitKeyByUser(userId: string, preset: LimitPreset): string {
  const uid = userId || 'anon'
  return `rl:${preset}:user:${uid}`
}

export async function checkCooldown(keyBase: string, cooldownMs: number): Promise<{ blocked: boolean; resetTime: number }>
{
  const key = `cooldown:${keyBase}`
  if (redis) {
    // If key exists, cooldown is active
    const exists = await redis.exists(key)
    if (exists === 1) {
      const pttl = await redis.pttl(key)
      const msLeft = typeof pttl === 'number' && pttl > 0 ? pttl : cooldownMs
      const resetSeconds = Math.ceil((Date.now() + msLeft) / 1000)
      return { blocked: true, resetTime: resetSeconds }
    }
    await redis.set(key, '1', { px: cooldownMs })
    return { blocked: false, resetTime: Math.ceil((Date.now() + cooldownMs) / 1000) }
  }
  // Fail-closed in production when Redis unavailable
  if (isProduction && RL_ENV.requireRedisInProd) {
    return { blocked: true, resetTime: Math.ceil((Date.now() + cooldownMs) / 1000) }
  }
  // Memory fallback
  const now = Date.now()
  const exp = memoryCooldown.get(key) || 0
  if (exp && exp > now) {
    return { blocked: true, resetTime: Math.ceil(exp / 1000) }
  }
  memoryCooldown.set(key, now + cooldownMs)
  return { blocked: false, resetTime: Math.ceil((now + cooldownMs) / 1000) }
}

export async function checkRateLimitSlidingWindow(key: string, windowMs: number, max: number): Promise<RateLimitResult> {
  const nowMs = Date.now()
  const windowStartMs = nowMs - windowMs
  const zkey = `sw:${key}`

  if (redis) {
    const member = `${nowMs}-${Math.random().toString(36).slice(2, 8)}`
    await redis.zremrangebyscore(zkey, 0, windowStartMs)
    await redis.zadd(zkey, { score: nowMs, member })
    await redis.pexpire(zkey, windowMs + 5_000)

    const count = (await redis.zcard(zkey)) as number
    const allowed = count <= max

    let remaining = Math.max(0, max - count)
    let resetTime = Math.ceil((nowMs + windowMs) / 1000)
    if (!allowed) {
      const earliest = await redis.zrange(zkey, 0, 0, { withScores: true })
      const earliestScore = Array.isArray(earliest) && earliest.length >= 2 ? Number(earliest[1] as any) : nowMs
      const msUntilReset = Math.max(0, earliestScore + windowMs - nowMs)
      resetTime = Math.ceil((nowMs + msUntilReset) / 1000)
      remaining = 0
    }

    return { allowed, remaining, resetTime, source: 'redis' }
  }

  // Fail-closed in production when Redis unavailable
  if (isProduction && RL_ENV.requireRedisInProd) {
    return { allowed: false, remaining: 0, resetTime: Math.ceil((nowMs + windowMs) / 1000), source: 'memory' }
  }
  // Memory fallback
  const bucket = memoryWindows.get(zkey) || []
  const recent = bucket.filter(ts => ts > windowStartMs)
  recent.push(nowMs)
  memoryWindows.set(zkey, recent)
  const count = recent.length
  const allowed = count <= max
  let remaining = Math.max(0, max - count)
  let resetTime = Math.ceil((nowMs + windowMs) / 1000)
  if (!allowed) {
    const earliestScore = recent[0] || nowMs
    const msUntilReset = Math.max(0, earliestScore + windowMs - nowMs)
    resetTime = Math.ceil((nowMs + msUntilReset) / 1000)
    remaining = 0
  }
  return { allowed, remaining, resetTime, source: 'memory' }
}

export function applyRateLimitHeaders(resp: NextResponse, preset: LimitPreset, result: RateLimitResult) {
  const limit = RATE_LIMITS[preset]
  resp.headers.set('X-RateLimit-Limit', String(limit.max))
  resp.headers.set('X-RateLimit-Remaining', String(result.remaining))
  resp.headers.set('X-RateLimit-Reset', String(result.resetTime))
  return resp
}

function isBypassAllowed(req: NextRequest): boolean {
  const bypassHeader = req.headers.get('x-rate-limit-bypass') || ''
  if (isProduction) {
    return false
  }
  // Development-only bypass via IP whitelist
  if (bypassHeader && RL_ENV.devBypassEnabled) {
    const ip = getClientIp(req)
    return RL_ENV.devWhitelistIps.includes(ip)
  }
  return false
}

export async function enforceRateLimitOr429(
  req: NextRequest,
  preset: LimitPreset,
  key: string,
  userEmail?: string
): Promise<{ allowed: true; headers: Record<string, string> } | { allowed: false; response: NextResponse }>
{
  // Block bypass header usage in production explicitly
  const bypassHeader = req.headers.get('x-rate-limit-bypass')
  if (isProduction && bypassHeader && RL_ENV.blockBypassHeaderInProd) {
    const resp = NextResponse.json({ error: 'Rate limit bypass header blocked' }, { status: 429 })
    const { ipAddress, userAgent, endpoint } = getRequestContext(req)
    await logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      ipAddress,
      userAgent,
      endpoint,
      correlationId: generateCorrelationId(),
      details: { reason: 'bypass_header_in_production' },
    })
    return { allowed: false, response: resp }
  }

  if (isBypassAllowed(req)) {
    const reset = Math.ceil((Date.now() + RATE_LIMITS[preset].windowMs) / 1000)
    return { allowed: true, headers: {
      'X-RateLimit-Limit': String(RATE_LIMITS[preset].max),
      'X-RateLimit-Remaining': String(RATE_LIMITS[preset].max),
      'X-RateLimit-Reset': String(reset),
    } }
  }

  const { windowMs, max } = RATE_LIMITS[preset]
  const perfStart = Date.now()
  const result = await checkRateLimitSlidingWindow(key, windowMs, max)
  const rlLatencyMs = Date.now() - perfStart
  try {
    const { recordPerfMetric } = await import('@/lib/performance/bench')
    await recordPerfMetric('rate_limiter_latency_ms', rlLatencyMs, { preset, key, source: result.source || 'unknown' })
  } catch {}
  if (result.allowed) {
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetTime),
      },
    }
  }

  const resp = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  resp.headers.set('Retry-After', String(Math.max(1, result.resetTime - Math.ceil(Date.now() / 1000))))
  applyRateLimitHeaders(resp, preset, result)
  // Structured log for monitoring
  const { ipAddress, userAgent, endpoint } = getRequestContext(req)
  await logSecurityEvent({
    type: 'RATE_LIMIT_EXCEEDED',
    severity: 'HIGH',
    ipAddress,
    userAgent,
    endpoint,
    correlationId: generateCorrelationId(),
    details: { preset, key, reset: result.resetTime },
  })
  return { allowed: false, response: resp }
}

export async function enforceCooldownOr429(
  req: NextRequest,
  cooldownKeyBase: string,
  cooldownMs: number
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }>
{
  const { blocked, resetTime } = await checkCooldown(cooldownKeyBase, cooldownMs)
  if (!blocked) return { allowed: true }
  const resp = NextResponse.json({ error: 'Action on cooldown' }, { status: 429 })
  resp.headers.set('Retry-After', String(Math.max(1, resetTime - Math.ceil(Date.now() / 1000))))
  resp.headers.set('X-RateLimit-Reset', String(resetTime))
  return { allowed: false, response: resp }
}

export { RATE_LIMITS }
