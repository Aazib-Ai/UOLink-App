import { getAdminDb } from '@/lib/firebaseAdmin'

export type ModerationCategory = 'profanity' | 'hate' | 'sexual' | 'personal_data' | 'spam' | 'links' | 'custom'

export interface ModerationPattern {
  id: string
  category: ModerationCategory
  pattern: string // regex string
  severity: number // 1-5 numeric severity
  enabled: boolean
}

export interface ModerationSettings {
  thresholdDefault: number
  thresholdStrict: number
  violationLimit24h: number
}

type Cached<T> = { value: T; expiresAt: number }

const CACHE_TTL_MS = 60_000 // 1 minute cache
let patternsCache: Cached<ModerationPattern[]> | null = null
let settingsCache: Cached<ModerationSettings> | null = null

function now(): number { return Date.now() }

export async function getModerationPatterns(): Promise<ModerationPattern[]> {
  // ENV fallback allows bootstrapping without Firestore
  const fromEnv = process.env.MODERATION_PATTERNS_JSON
  if (fromEnv && !patternsCache) {
    try {
      const parsed: ModerationPattern[] = JSON.parse(fromEnv)
      patternsCache = { value: parsed, expiresAt: now() + CACHE_TTL_MS }
      return parsed
    } catch { /* ignore */ }
  }

  if (patternsCache && patternsCache.expiresAt > now()) {
    return patternsCache.value
  }

  const db = getAdminDb()
  const col = db.collection('moderation_patterns')
  const snap = await col.where('enabled', '==', true).get()
  const patterns: ModerationPattern[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))

  patternsCache = { value: patterns, expiresAt: now() + CACHE_TTL_MS }
  return patterns
}

export async function getModerationSettings(): Promise<ModerationSettings> {
  if (settingsCache && settingsCache.expiresAt > now()) {
    return settingsCache.value
  }
  const db = getAdminDb()
  const docRef = db.collection('moderation_settings').doc('global')
  const doc = await docRef.get()
  const defaults: ModerationSettings = {
    thresholdDefault: Number(process.env.MODERATION_THRESHOLD_DEFAULT || 3),
    thresholdStrict: Number(process.env.MODERATION_THRESHOLD_STRICT || 2),
    violationLimit24h: Number(process.env.MODERATION_VIOLATION_LIMIT_24H || 5),
  }
  const settings: ModerationSettings = doc.exists ? { ...defaults, ...(doc.data() as any) } : defaults
  settingsCache = { value: settings, expiresAt: now() + CACHE_TTL_MS }
  return settings
}

export function invalidateModerationConfigCache(): void {
  patternsCache = null
  settingsCache = null
}

// Admin updates
export async function addModerationPattern(input: Omit<ModerationPattern, 'id'>): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection('moderation_patterns').add({ ...input })
  invalidateModerationConfigCache()
  return ref.id
}

export async function updateModerationPattern(id: string, update: Partial<Omit<ModerationPattern, 'id'>>): Promise<void> {
  const db = getAdminDb()
  await db.collection('moderation_patterns').doc(id).update(update)
  invalidateModerationConfigCache()
}

export async function setModerationSettings(update: Partial<ModerationSettings>): Promise<void> {
  const db = getAdminDb()
  await db.collection('moderation_settings').doc('global').set(update, { merge: true })
  invalidateModerationConfigCache()
}

