'use client'

import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { getCachedAcademic, setCachedAcademic } from '@/lib/preferences/timetable'

export type AcademicProfile = { major: string; semester: string; section: string }

export const getProfileAcademic = async (uid: string): Promise<AcademicProfile | null> => {
  const cached = getCachedAcademic(uid)
  if (cached) return cached
  try {
    const ref = doc(db, 'profiles', uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const raw = snap.data() as { major?: unknown; semester?: unknown; section?: unknown }
    const major = typeof raw.major === 'string' ? raw.major.trim() : ''
    const semester = typeof raw.semester === 'string' ? raw.semester.trim() : ''
    const section = typeof raw.section === 'string' ? raw.section.trim().toUpperCase() : ''
    const result = { major, semester, section }
    setCachedAcademic(uid, result)
    return result
  } catch {
    return null
  }
}
