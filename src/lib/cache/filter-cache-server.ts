import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import { normalizeForStorage } from '@/lib/utils'
import { setFilterOptionsCache, invalidateFilterOptionsCache, type FilterOptions } from './filter-cache'

const REFRESH_MS = 10 * 60 * 1000

let warmingStarted = false
let refreshTimer: any = null

async function fetchFromAdmin(): Promise<FilterOptions> {
  try {
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const db = getAdminDb()
    const snap = await db.collection('notes').orderBy('uploadedAt', 'desc').limit(200).get()
    const notes = snap.docs.map((d: any) => d.data() || {})
    const semestersSet = new Set<string>()
    const subjectSet = new Set<string>(SUBJECT_NAMES.map((s) => normalizeForStorage(s)))
    const teacherSet = new Set<string>(TEACHER_NAMES.map((t) => normalizeForStorage(t)))
    const sectionsSet = new Set<string>()
    const materialTypeSet = new Set<string>()
    const materialSequencesSet = new Set<string>()
    for (const n of notes) {
      const semester = typeof n.semester === 'string' ? n.semester : ''
      if (semester) semestersSet.add(semester)
      const subject = typeof n.subject === 'string' ? normalizeForStorage(n.subject) : ''
      if (subject) subjectSet.add(subject)
      const teacher = typeof n.teacher === 'string' ? normalizeForStorage(n.teacher) : ''
      if (teacher) teacherSet.add(teacher)
      const section = typeof n.section === 'string' ? String(n.section).trim().toUpperCase() : ''
      if (section) sectionsSet.add(section)
      const materialType = typeof n.materialType === 'string' ? normalizeForStorage(n.materialType) : ''
      if (materialType) materialTypeSet.add(materialType)
      const materialSequence = n.materialSequence != null ? String(n.materialSequence).trim() : ''
      if (materialSequence) materialSequencesSet.add(materialSequence)
    }
    const materialTypeOrder = ['assignment', 'quiz', 'lecture', 'slides', 'midterm-notes', 'final-term-notes', 'books']
    const orderedMaterialTypes = materialTypeOrder.filter((t) => materialTypeSet.has(t))
    const leftoverMaterialTypes = Array.from(materialTypeSet).filter((t) => !materialTypeOrder.includes(t)).sort()
    const subjectsArr = Array.from(subjectSet)
    const sortedSubjects = subjectsArr.filter((s) => s !== 'not mentioned').sort()
    if (subjectsArr.includes('not mentioned')) sortedSubjects.push('not mentioned')
    return {
      semesters: Array.from(semestersSet).sort(),
      subjects: sortedSubjects,
      teachers: Array.from(teacherSet).sort(),
      sections: Array.from(sectionsSet).sort(),
      materialTypes: [...orderedMaterialTypes, ...leftoverMaterialTypes],
      materialSequences: Array.from(materialSequencesSet).sort((a, b) => Number(a) - Number(b)),
    }
  } catch {
    return { semesters: [], subjects: [], teachers: [], sections: [], materialTypes: [], materialSequences: [] }
  }
}

export async function refreshFilterOptionsCacheServer() {
  const fresh = await fetchFromAdmin()
  setFilterOptionsCache(fresh)
}

export async function invalidateFilterOptionsCacheServer() {
  await invalidateFilterOptionsCache()
}

export function ensureFilterOptionsCacheWarmingServer() {
  if (warmingStarted) return
  warmingStarted = true
  refreshFilterOptionsCacheServer().catch(() => {})
  refreshTimer = setInterval(() => {
    refreshFilterOptionsCacheServer().catch(() => {})
  }, REFRESH_MS)
}

