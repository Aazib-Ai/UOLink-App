import { getInitialNotes, getRecentNotesByMajorSemester } from '@/lib/firebase/notes'
import { getAuraLeaderboard } from '@/lib/firebase/profiles'
import { getFilterOptions } from '@/lib/firebase/notes'

const REFRESH_MS = 10 * 60 * 1000
let warmingStarted = false
let refreshTimer: any = null

export async function warmInitialNotes() {
  try {
    await getInitialNotes()
  } catch {}
}

export async function warmLeaderboard(limit = 20) {
  try {
    await getAuraLeaderboard(limit)
  } catch {}
}

export async function warmRecentNotesBySemester(limit = 9) {
  try {
    const opts = await getFilterOptions()
    const semesters = Array.isArray(opts.semesters) ? opts.semesters.slice(0, 6) : []
    for (const s of semesters) {
      await getRecentNotesByMajorSemester('', s, limit)
    }
  } catch {}
}

export function ensureQueryCacheWarmingServer() {
  if (warmingStarted) return
  warmingStarted = true
  ;(async () => {
    await warmInitialNotes()
    await warmLeaderboard(20)
    await warmRecentNotesBySemester(9)
  })().catch(() => {})
  refreshTimer = setInterval(() => {
    ;(async () => {
      await warmInitialNotes()
      await warmLeaderboard(20)
      await warmRecentNotesBySemester(9)
    })().catch(() => {})
  }, REFRESH_MS)
}
