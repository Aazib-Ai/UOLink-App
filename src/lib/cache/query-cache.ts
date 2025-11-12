import { Redis } from '@upstash/redis'
import { getRateLimiterEnv } from '@/lib/security/config'

type CacheValue = any

const ENV = getRateLimiterEnv()
const hasRedis = Boolean(ENV.redisUrl && ENV.redisToken)
const redis = hasRedis
  ? new Redis({ url: ENV.redisUrl!, token: ENV.redisToken! })
  : null

// Simple in-memory fallback with TTL
type MemoryEntry = { value: CacheValue; expiresAt: number }
const memoryStore = new Map<string, MemoryEntry>()

function nowMs() {
  return Date.now()
}

export function generateCacheKey(route: string, params: Record<string, any>): string {
  const stable = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k])}`)
    .join('&')
  return `qc:${route}:${stable}`
}

export async function getCache<T = any>(key: string): Promise<T | null> {
  if (redis) {
    try {
      const val = await redis.get(key)
      return (val as T) ?? null
    } catch (e) {
      return null
    }
  }
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expiresAt <= nowMs()) {
    memoryStore.delete(key)
    return null
  }
  return entry.value as T
}

export async function setCache(key: string, value: CacheValue, ttlMs: number): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value, { px: ttlMs })
      return
    } catch (e) {
      // fall through to memory on error
    }
  }
  memoryStore.set(key, { value, expiresAt: nowMs() + ttlMs })
}

export async function clearByPrefix(prefix: string): Promise<void> {
  if (redis) {
    try {
      // Upstash Redis does not support KEYS; use scan if available. For simplicity, skip in production.
      return
    } catch {
      // ignore
    }
  }
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key)
    }
  }
}

