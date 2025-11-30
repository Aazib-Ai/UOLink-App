export type FilterOptions = {
  semesters: string[]
  subjects: string[]
  teachers: string[]
  sections: string[]
  materialTypes: string[]
  materialSequences: string[]
}

const TTL_MS = 15 * 60 * 1000
const REFRESH_MS = 10 * 60 * 1000

let store: { value: FilterOptions; expiresAt: number } | null = null
let hits = 0
let misses = 0
let lastRefreshMs: number | null = null
let warmingStarted = false
let refreshTimer: any = null

function now() {
  return Date.now()
}

function computeMetrics() {
  const total = hits + misses
  const rate = total > 0 ? hits / total : 1
  const size = store ? JSON.stringify(store.value).length : 0
  return { hits, misses, hitRate: rate, cacheSize: size, lastRefreshMs }
}

function logIfLowHitRate() {
  const m = computeMetrics()
  if (m.hitRate < 0.8) {
    try {
      if (typeof console !== 'undefined') {
        console.warn(JSON.stringify({ category: 'filter_cache_alert', hitRate: m.hitRate, hits, misses, cacheSize: m.cacheSize }))
      }
    } catch {}
  }
}

function logMetrics() {
  const m = computeMetrics()
  try {
    if (typeof console !== 'undefined') {
      console.log(JSON.stringify({ category: 'filter_cache_metrics', hits: m.hits, misses: m.misses, hitRate: m.hitRate, cacheSize: m.cacheSize, lastRefreshMs: m.lastRefreshMs }))
    }
  } catch {}
}

export async function getCachedFilterOptions(fetchFresh: () => Promise<FilterOptions>): Promise<FilterOptions> {
  const ts = now()
  if (store && store.expiresAt > ts) {
    hits += 1
    logMetrics()
    logIfLowHitRate()
    return store.value
  }
  misses += 1
  const fresh = await fetchFresh()
  store = { value: fresh, expiresAt: ts + TTL_MS }
  lastRefreshMs = ts
  logMetrics()
  logIfLowHitRate()
  return fresh
}

export function getFilterCacheMetrics() {
  return computeMetrics()
}

export async function invalidateFilterOptionsCache() {
  store = null
}

export function setFilterOptionsCache(value: FilterOptions) {
  store = { value, expiresAt: now() + TTL_MS }
  lastRefreshMs = now()
  logMetrics()
}


