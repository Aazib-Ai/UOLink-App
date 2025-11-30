import { Redis } from '@upstash/redis'
import { getRateLimiterEnv } from '@/lib/security/config'

type CacheValue = any

const ENV = getRateLimiterEnv()
const hasRedis = Boolean(ENV.redisUrl && ENV.redisToken)
const redis = hasRedis ? new Redis({ url: ENV.redisUrl!, token: ENV.redisToken! }) : null

type MemoryEntry = { value: CacheValue; expiresAt: number; sizeBytes: number; tags?: string[] }
const memoryStore = new Map<string, MemoryEntry>()
const tagIndex = new Map<string, Set<string>>()
let hits = 0
let misses = 0
let sets = 0
let evictions = 0
let memoryBytes = 0
let maxMemoryBytes = 50 * 1024 * 1024

function nowMs() {
  return Date.now()
}

function approximateSize(value: any): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) || '')
  } catch {
    return 0
  }
}

function addTag(key: string, tag: string) {
  const set = tagIndex.get(tag) || new Set<string>()
  set.add(key)
  tagIndex.set(tag, set)
}

function removeKey(key: string) {
  const entry = memoryStore.get(key)
  if (!entry) return
  memoryStore.delete(key)
  memoryBytes = Math.max(0, memoryBytes - entry.sizeBytes)
  if (entry.tags) {
    for (const t of entry.tags) {
      const s = tagIndex.get(t)
      if (!s) continue
      s.delete(key)
      if (s.size === 0) tagIndex.delete(t)
    }
  }
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
      if (val == null) {
        misses += 1
        return null
      }
      hits += 1
      return val as T
    } catch {
      misses += 1
    }
  }
  const entry = memoryStore.get(key)
  if (!entry) {
    misses += 1
    return null
  }
  if (entry.expiresAt <= nowMs()) {
    removeKey(key)
    misses += 1
    return null
  }
  hits += 1
  return entry.value as T
}

export async function setCache(key: string, value: CacheValue, ttlMs: number, tags?: string[]): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value, { px: ttlMs })
      if (tags && tags.length) {
        for (const t of tags) {
          try {
            await redis.sadd(`qc:tag:${t}`, key)
          } catch {}
        }
      }
      sets += 1
      return
    } catch {}
  }
  const sizeBytes = approximateSize(value)
  const entry: MemoryEntry = { value, expiresAt: nowMs() + ttlMs, sizeBytes, tags }
  memoryStore.set(key, entry)
  memoryBytes += sizeBytes
  sets += 1
  if (tags && tags.length) {
    for (const t of tags) addTag(key, t)
  }
  while (memoryBytes > maxMemoryBytes) {
    let oldestKey: string | null = null
    let oldestTs = Number.POSITIVE_INFINITY
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt < oldestTs) {
        oldestTs = v.expiresAt
        oldestKey = k
      }
    }
    if (!oldestKey) break
    removeKey(oldestKey)
    evictions += 1
  }
}

export async function clearByPrefix(prefix: string): Promise<void> {
  if (redis) {
    try {
      const keys = await redis.smembers(`qc:tag:${prefix}`)
      if (Array.isArray(keys) && keys.length) {
        try {
          await redis.del(...keys)
        } catch {}
      }
    } catch {}
  }
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      removeKey(key)
    }
  }
}

export async function invalidateTags(tags: string[]): Promise<void> {
  if (redis) {
    for (const t of tags) {
      try {
        const keys = await redis.smembers(`qc:tag:${t}`)
        if (Array.isArray(keys) && keys.length) {
          try {
            await redis.del(...keys)
          } catch {}
        }
      } catch {}
    }
  }
  for (const t of tags) {
    const s = tagIndex.get(t)
    if (!s) continue
    for (const k of Array.from(s)) removeKey(k)
    tagIndex.delete(t)
  }
}

type CacheQueryOptions = { ttlMs?: number; tags?: string[]; staleWhileRevalidateMs?: number }

export async function cacheQuery<T>(route: string, params: Record<string, any>, fetcher: () => Promise<T>, options: CacheQueryOptions = {}): Promise<T> {
  const ttlMs = options.ttlMs ?? 60000
  const tags = options.tags ?? []
  const key = generateCacheKey(route, params)
  const cached = await getCache<T>(key)
  if (cached != null) return cached
  const result = await fetcher()
  await setCache(key, result as any, ttlMs, tags)
  return result
}

export function getCacheStats() {
  const total = hits + misses
  const hitRate = total > 0 ? hits / total : 1
  const entries = memoryStore.size
  return { hits, misses, sets, evictions, hitRate, memoryBytes, entries }
}

export function setMaxMemoryBytes(bytes: number) {
  maxMemoryBytes = Math.max(1024 * 1024, bytes)
}
