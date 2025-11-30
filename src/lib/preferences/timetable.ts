'use client'

import { TimetableEntry } from '@/hooks/useTimetableData'
type MergedProgramLite = { department?: string; sub_department?: string; semester?: string; section?: string }

type Prefs = {
  userId?: string
  department: string
  sub_department?: string
  semester: string
  section: string
  lastUpdated: number
}

const safeParse = <T>(raw: string | null): T | null => {
  if (!raw) return null
  try { return JSON.parse(raw) as T } catch { return null }
}

const nowTs = () => Date.now()

const keyUser = (uid: string) => `timetable:prefs:${uid}`
const keyGuest = `timetable:prefs:guest`
const keyAcademic = (uid: string) => `timetable:academic:${uid}`

export const getUserPrefs = (uid: string): Prefs | null => {
  if (typeof window === 'undefined') return null
  const parsed = safeParse<Prefs>(window.localStorage.getItem(keyUser(uid)))
  return parsed
}

export const setUserPrefs = (uid: string, prefs: Omit<Prefs, 'lastUpdated'>) => {
  if (typeof window === 'undefined') return
  const v: Prefs = { ...prefs, userId: uid, lastUpdated: nowTs() }
  window.localStorage.setItem(keyUser(uid), JSON.stringify(v))
}

export const getGuestPrefs = (): Prefs | null => {
  if (typeof window === 'undefined') return null
  const parsed = safeParse<Prefs>(window.localStorage.getItem(keyGuest))
  return parsed
}

export const setGuestPrefs = (prefs: Omit<Prefs, 'lastUpdated' | 'userId'>) => {
  if (typeof window === 'undefined') return
  const v: Prefs = { ...prefs, lastUpdated: nowTs() }
  window.localStorage.setItem(keyGuest, JSON.stringify(v))
}

type Academic = { major: string; semester: string; section: string }

export const getCachedAcademic = (uid: string): Academic | null => {
  if (typeof window === 'undefined') return null
  return safeParse<Academic>(window.localStorage.getItem(keyAcademic(uid)))
}

export const setCachedAcademic = (uid: string, a: Academic) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(keyAcademic(uid), JSON.stringify(a))
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const MAJOR_TO_DEPARTMENT: Record<string, string[]> = {
  'computer science': ['CS & IT', 'COMPUTER SCIENCE', 'CS'],
  'software engineering': ['CS & IT', 'SOFTWARE ENGINEERING', 'SE'],
  'information technology': ['CS & IT', 'IT'],
  'bba': ['LAHORE BUSINESS SCHOOL', 'BUSINESS'],
  'accounting finance': ['LAHORE BUSINESS SCHOOL'],
}

export const mapMajorToDepartment = (major: string, departments: string[]): string | null => {
  const m = normalize(major)
  for (const key of Object.keys(MAJOR_TO_DEPARTMENT)) {
    if (m.includes(key)) {
      const candidates = MAJOR_TO_DEPARTMENT[key]
      const found = departments.find((d) => candidates.some((c) => normalize(d).includes(normalize(c))))
      if (found) return found
    }
  }
  const foundDirect = departments.find((d) => normalize(d).includes(m))
  return foundDirect || null
}

export const inferSubDepartment = (
  entries: TimetableEntry[],
  department: string,
  major: string,
  semester: string,
  section: string,
  days: string[],
): string | null => {
  const subSet = new Set<string>()
  for (const e of entries) {
    if ((e.department || '').trim() !== department) continue
    const sd = (e.sub_department || '').trim()
    if (sd) subSet.add(sd)
    const mpRaw = (e as unknown as { merged_programs?: MergedProgramLite[] | string | undefined }).merged_programs
    const mpArr: MergedProgramLite[] = Array.isArray(mpRaw) ? mpRaw : typeof mpRaw === 'string' ? (() => { try { const j = JSON.parse(mpRaw as string) as unknown; return Array.isArray(j) ? j as MergedProgramLite[] : [] } catch { return [] } })() : []
    for (const m of mpArr) {
      const depOk = !m.department || (m.department || '').trim() === department
      const sv = (m.sub_department || '').trim()
      if (depOk && sv) subSet.add(sv)
    }
  }
  const subs = Array.from(subSet)
  if (subs.length === 0) return null
  const mNorm = normalize(major)
  const textMatch = subs.find((sd) => normalize(sd).includes(mNorm.split(' ')[0] || '')) || null
  if (textMatch) return textMatch
  const densityBySub: Record<string, number> = {}
  for (const sd of subs) densityBySub[sd] = 0
  for (const e of entries) {
    const depOk = (e.department || '').trim() === department
    const semOk = semester ? (e.semester || '').trim() === semester : true
    const secOk = section ? (e.section || '').trim() === section : true
    if (!depOk || !semOk || !secOk) continue
    if (!days.includes(e.day)) continue
    const eSub = getSubOf(e)
    if (eSub && subs.includes(eSub)) densityBySub[eSub]++
  }
  let best: string | null = null
  let bestScore = -1
  for (const sd of subs) {
    const score = densityBySub[sd] ?? 0
    if (score > bestScore) { bestScore = score; best = sd }
  }
  return best
}

const getSubOf = (e: TimetableEntry) => {
  const sd = (e.sub_department || '').trim()
  if (sd) return sd
  const mpRaw = (e as unknown as { merged_programs?: MergedProgramLite[] | string | undefined }).merged_programs
  const mpArr: MergedProgramLite[] = Array.isArray(mpRaw) ? mpRaw : typeof mpRaw === 'string' ? (() => { try { const j = JSON.parse(mpRaw as string) as unknown; return Array.isArray(j) ? j as MergedProgramLite[] : [] } catch { return [] } })() : []
  for (const m of mpArr) {
    const sv = (m.sub_department || '').trim()
    if (sv) return sv
  }
  return ''
}
