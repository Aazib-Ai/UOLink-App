import { getAdminDb } from '@/lib/firebaseAdmin'
import { getReservedUsernames } from './validation'

let cache: { set: Set<string>; expiresAt: number } | null = null
const TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function isReservedUsernameServer(username: string): Promise<boolean> {
  const now = Date.now()
  try {
    const lower = username.toLowerCase().trim()

    // Serve from cache if fresh
    if (cache && cache.expiresAt > now) {
      return cache.set.has(lower)
    }

    // Load dynamic list from Firestore (optional)
    const db = getAdminDb()
    const docRef = db.collection('config').doc('reserved_usernames')
    const snap = await docRef.get()
    const dynamicList: string[] = Array.isArray(snap.data()?.list) ? snap.data()!.list : []

    const combined = new Set<string>([
      ...getReservedUsernames().map((s) => s.toLowerCase()),
      ...dynamicList.map((s) => String(s).toLowerCase()),
    ])

    cache = { set: combined, expiresAt: now + TTL_MS }
    return combined.has(lower)
  } catch {
    // Fallback to static list in case of any failure
    const staticSet = new Set(getReservedUsernames().map((s) => s.toLowerCase()))
    return staticSet.has(username.toLowerCase().trim())
  }
}

export function invalidateReservedCache() {
  cache = null
}
