import { logSecurityEvent, generateCorrelationId } from '@/lib/security/logging'
import { getModerationPatterns, getModerationSettings } from '@/lib/security/moderation-config'
import { Redis } from '@upstash/redis'
import { getRateLimiterEnv } from '@/lib/security/config'
import crypto from 'crypto'

export type ModerationCategory = 'profanity' | 'hate' | 'sexual' | 'personal_data' | 'spam' | 'links' | 'custom'

export interface ModerationViolation {
  category: ModerationCategory
  match: string
  index?: number
  severity: number
}

export interface ModerationResult {
  allowed: boolean
  score: number
  violations: ModerationViolation[]
  sanitizedText: string
  blockedByUserLimit?: boolean
}
const STRICT = process.env.PROFANITY_FILTER_STRICT === 'true'

// Basic keyword lists (can be extended via environment configuration)
// Fallback built-in patterns used when external configuration is not available
const PROFANITY_LIST = [ /\b(damn|hell|shit|fuck)\b/i ]
const HATE_LIST = [ /\b(?:(?:racist|bigot|supremacist))\b/i ]
const SEXUAL_LIST = [ /\b(?:porn|nsfw|explicit)\b/i ]
const PERSONAL_DATA_PATTERNS = [ /\b\d{3}[- ]?\d{3}[- ]?\d{4}\b/, /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/ ]
const SPAM_PATTERNS = [ /(free\s+money|click\s+here|work\s+from\s+home)/i, /(http:\/\/|https:\/\/).*(\.?ru|\.cn|bit\.ly|tinyurl\.com)/i ]
const LINKS_PATTERN = /(https?:\/\/[^\s]+)/i

function scoreFor(category: ModerationCategory, strict: boolean): number {
  switch (category) {
    case 'profanity':
      return strict ? 3 : 2
    case 'hate':
      return 4
    case 'sexual':
      return strict ? 4 : 2
    case 'personal_data':
      return 3
    case 'spam':
      return 2
    case 'links':
      return 1
    default:
      return 0
  }
}

export function evaluateText(text: string): { score: number; violations: ModerationViolation[] } {
  const violations: ModerationViolation[] = []
  const s = (text || '').toString()

  // Try external patterns first
  const externalPatternsPromise = getModerationPatterns().catch(() => [])

  // Collect matches from built-ins
  for (const re of PROFANITY_LIST) {
    const m = s.match(re)
    if (m) violations.push({ category: 'profanity', match: m[0], severity: scoreFor('profanity', STRICT) })
  }
  for (const re of HATE_LIST) {
    const m = s.match(re)
    if (m) violations.push({ category: 'hate', match: m[0], severity: scoreFor('hate', STRICT) })
  }
  for (const re of SEXUAL_LIST) {
    const m = s.match(re)
    if (m) violations.push({ category: 'sexual', match: m[0], severity: scoreFor('sexual', STRICT) })
  }
  for (const re of PERSONAL_DATA_PATTERNS) {
    const m = s.match(re)
    if (m) violations.push({ category: 'personal_data', match: m[0], severity: scoreFor('personal_data', STRICT) })
  }
  for (const re of SPAM_PATTERNS) {
    const m = s.match(re)
    if (m) violations.push({ category: 'spam', match: m[0], severity: scoreFor('spam', STRICT) })
  }
  const linkMatch = s.match(LINKS_PATTERN)
  if (linkMatch) {
    violations.push({ category: 'links', match: linkMatch[0], severity: scoreFor('links', STRICT) })
  }

  const score = violations.reduce((acc, v) => acc + v.severity, 0)
  return { score, violations }
}

export function sanitizeViolations(text: string, violations: ModerationViolation[]): string {
  let out = text
  for (const v of violations) {
    try {
      const regex = new RegExp(v.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      out = out.replace(regex, '***')
    } catch {
      // fallback: naive replacement
      out = out.split(v.match).join('***')
    }
  }
  return out
}

export async function enforceModeration(text: string, context: { endpoint?: string; userId?: string }): Promise<ModerationResult> {
  // Evaluate built-in patterns first
  let { score, violations } = evaluateText(text)

  // Apply external patterns with configurable severities
  try {
    const patterns = await getModerationPatterns()
    const s = (text || '').toString()
    for (const p of patterns) {
      try {
        const re = new RegExp(p.pattern, 'i')
        const m = s.match(re)
        if (m) {
          violations.push({ category: p.category as any, match: m[0], severity: p.severity })
        }
      } catch {
        // ignore invalid regex from config
      }
    }
  } catch {
    // ignore loader errors
  }

  // Compute final score and thresholds
  score = violations.reduce((acc, v) => acc + v.severity, 0)
  const settings = await getModerationSettings()
  const threshold = STRICT ? settings.thresholdStrict : settings.thresholdDefault
  const allowed = score <= threshold

  const sanitizedText = sanitizeViolations(text, violations)

  // Build content hash for logging
  const normalized = (text || '').trim().toLowerCase()
  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex')

  // Track user violation counts over 24h window when violations exist
  let blockedByUserLimit = false
  if (violations.length && context.userId) {
    const env = getRateLimiterEnv()
    const isRedisAvailable = Boolean(env.redisUrl && env.redisToken)
    const redis = isRedisAvailable ? new Redis({ url: env.redisUrl!, token: env.redisToken! }) : null
    const windowMs = 24 * 60 * 60 * 1000
    const key = `mod:violations:user:${context.userId}`
    const nowMs = Date.now()
    if (redis) {
      const member = `${nowMs}-${Math.random().toString(36).slice(2, 8)}`
      await redis.zremrangebyscore(key, 0, nowMs - windowMs)
      await redis.zadd(key, { score: nowMs, member })
      await redis.pexpire(key, windowMs + 5_000)
      const count = (await redis.zcard(key)) as number
      if (count >= settings.violationLimit24h) {
        blockedByUserLimit = true
      }
    }
  }

  if (!allowed || blockedByUserLimit) {
    await logSecurityEvent({
      type: 'SUSPICIOUS_ACTIVITY',
      severity: !allowed ? 'MEDIUM' : 'HIGH',
      userId: context.userId,
      endpoint: context.endpoint,
      correlationId: generateCorrelationId(),
      details: {
        reason: !allowed ? 'content_policy_violation' : 'moderation_violation_rate_limited',
        score,
        threshold,
        contentHash,
        length: normalized.length,
        violations,
      },
    })
  }

  return { allowed: allowed && !blockedByUserLimit, score, violations, sanitizedText, blockedByUserLimit }
}

export function moderateProfileFields(input: Record<string, any>): { allowed: boolean; sanitized: Record<string, any>; score: number; violations: ModerationViolation[] } {
  const keys = ['bio', 'about', 'skills']
  let score = 0
  const violations: ModerationViolation[] = []
  const sanitized: Record<string, any> = { ...input }
  for (const k of keys) {
    const v = input[k]
    if (typeof v === 'string') {
      const res = evaluateText(v)
      if (res.violations.length) {
        violations.push(...res.violations)
        score += res.score
        sanitized[k] = sanitizeViolations(v, res.violations)
      }
    } else if (Array.isArray(v)) {
      sanitized[k] = v.map((item) => {
        if (typeof item === 'string') {
          const res = evaluateText(item)
          if (res.violations.length) {
            violations.push(...res.violations)
            score += res.score
            return sanitizeViolations(item, res.violations)
          }
        }
        return item
      })
    }
  }
  // Use configurable thresholds for profile fields (slightly higher default)
  const settingsThreshold = STRICT ? 2 : 4
  const allowed = score <= settingsThreshold
  return { allowed, sanitized, score, violations }
}
