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

// Initialize Redis client with error handling
let redis: Redis | null = null
if (isRedisAvailable) {
  try {
    redis = new Redis({
      url: RL_ENV.redisUrl!,
      token: RL_ENV.redisToken!,
    })
    console.log('[RateLimit] Redis client initialized successfully')
  } catch (err: any) {
    console.error('[RateLimit] Failed to initialize Redis client:', err?.message || err)
    redis = null
  }
} else {
  console.warn('[RateLimit] Redis not available, using memory fallback')
}

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

export async function checkCooldown(keyBase: string, cooldownMs: number): Promise<{ blocked: boolean; resetTime: number }> {
  const key = `cooldown:${keyBase}`

  // Validate inputs
  if (!cooldownMs || cooldownMs <= 0 || !isFinite(cooldownMs)) {
    console.warn('[RateLimit] Invalid cooldownMs:', cooldownMs, 'using memory fallback')
    // Fall through to memory fallback
  } else if (redis) {
    try {
      // OPTIMIZED: Single SET NX operation instead of exists + pttl + set
      // SET with NX returns null if key exists, 'OK' if set successfully
      const result = await redis.set(key, '1', { px: cooldownMs, nx: true })

      if (result === 'OK') {
        // Key was set - not blocked, cooldown starts now
        return { blocked: false, resetTime: Math.ceil((Date.now() + cooldownMs) / 1000) }
      } else {
        // Key exists - blocked, get TTL for reset time
        const pttl = await redis.pttl(key)
        const msLeft = typeof pttl === 'number' && pttl > 0 ? pttl : cooldownMs
        return { blocked: true, resetTime: Math.ceil((Date.now() + msLeft) / 1000) }
      }
    } catch (err: any) {
      console.error('[RateLimit] Redis error in checkCooldown:', err?.message || err)
      // Fall through to memory fallback
    }
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

  // Validate inputs to prevent NaN or invalid values from reaching Redis
  if (!isFinite(nowMs) || nowMs <= 0) {
    console.error('[RateLimit] Invalid nowMs:', nowMs)
    return { allowed: false, remaining: 0, resetTime: Math.ceil((Date.now() + windowMs) / 1000), source: 'memory' }
  }

  if (!windowMs || windowMs <= 0 || !isFinite(windowMs)) {
    console.error('[RateLimit] Invalid windowMs:', windowMs)
    return { allowed: false, remaining: 0, resetTime: Math.ceil((Date.now() + 60000) / 1000), source: 'memory' }
  }

  if (!max || max <= 0 || !isFinite(max)) {
    console.error('[RateLimit] Invalid max:', max)
    return { allowed: false, remaining: 0, resetTime: Math.ceil((nowMs + windowMs) / 1000), source: 'memory' }
  }

  // OPTIMIZED: Fixed window counter instead of sliding window
  // Uses 2 ops (INCR + EXPIRE) vs 4-5 ops for sliding window
  const windowId = Math.floor(nowMs / windowMs)
  const windowKey = `fw:${key}:${windowId}`
  const ttlSeconds = Math.ceil(windowMs / 1000) + 1
  const windowEndMs = (windowId + 1) * windowMs

  if (redis) {
    try {
      // Use pipeline to combine INCR + EXPIRE into single round-trip
      const pipe = redis.pipeline()
      pipe.incr(windowKey)
      pipe.expire(windowKey, ttlSeconds)
      const results = await pipe.exec()

      const count = (results[0] as number) || 1
      const allowed = count <= max
      const remaining = Math.max(0, max - count)
      const resetTime = Math.ceil(windowEndMs / 1000)

      return { allowed, remaining, resetTime, source: 'redis' }
    } catch (err: any) {
      console.error('[RateLimit] Redis error in checkRateLimitSlidingWindow:', err?.message || err)
      // Fall through to memory fallback
    }
  }

  // Fail-closed in production when Redis unavailable
  if (isProduction && RL_ENV.requireRedisInProd) {
    return { allowed: false, remaining: 0, resetTime: Math.ceil((nowMs + windowMs) / 1000), source: 'memory' }
  }

  // Memory fallback - also use fixed window for consistency
  const memKey = `fw:${key}:${windowId}`
  const currentCount = (memoryWindows.get(memKey)?.[0] || 0) + 1
  memoryWindows.set(memKey, [currentCount])

  const allowed = currentCount <= max
  const remaining = Math.max(0, max - currentCount)
  const resetTime = Math.ceil(windowEndMs / 1000)

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
): Promise<{ allowed: true; headers: Record<string, string> } | { allowed: false; response: NextResponse }> {
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
    return {
      allowed: true, headers: {
        'X-RateLimit-Limit': String(RATE_LIMITS[preset].max),
        'X-RateLimit-Remaining': String(RATE_LIMITS[preset].max),
        'X-RateLimit-Reset': String(reset),
      }
    }
  }

  const { windowMs, max } = RATE_LIMITS[preset]
  const perfStart = Date.now()
  const result = await checkRateLimitSlidingWindow(key, windowMs, max)
  const rlLatencyMs = Date.now() - perfStart
  try {
    const { recordPerfMetric } = await import('@/lib/performance/bench')
    await recordPerfMetric('rate_limiter_latency_ms', rlLatencyMs, { preset, key, source: result.source || 'unknown' })
  } catch { }
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
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const { blocked, resetTime } = await checkCooldown(cooldownKeyBase, cooldownMs)
  if (!blocked) return { allowed: true }
  const resp = NextResponse.json({ error: 'Action on cooldown' }, { status: 429 })
  resp.headers.set('Retry-After', String(Math.max(1, resetTime - Math.ceil(Date.now() / 1000))))
  resp.headers.set('X-RateLimit-Reset', String(resetTime))
  return { allowed: false, response: resp }
}

export { RATE_LIMITS }
