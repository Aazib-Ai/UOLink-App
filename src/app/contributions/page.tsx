'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock3,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { FirebaseError } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'

import Navbar from '@/components/Navbar'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { toTitleCase } from '@/lib/utils'
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import UploadModal from '@/components/UploadModal'
import { ScannerModal } from '@/components/scanner/ScannerModal'
interface UserNote {
  id: string
  name: string
  subject: string
  teacher: string
  semester: string
  contributorName: string
  fileUrl: string
  fileSize?: number
  uploadedAt: string
  updatedAt?: string
  module?: string
}

interface ActivityStats {
  totalContributions: number
  uniqueSubjects: number
  totalViews: number
  lastActiveDate: string
}

const MAX_SUGGESTIONS = 8

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildSuggestions = (
  queryValue: string,
  entries: Array<{ original: string; normalized: string }>
) => {
  const trimmed = queryValue.trim()
  if (!trimmed) return []

  const normalizedQuery = normalizeValue(trimmed)
  if (!normalizedQuery) return []

  const startsWithMatches = entries.filter((entry) =>
    entry.normalized.startsWith(normalizedQuery)
  )
  const containsMatches = entries.filter(
    (entry) =>
      entry.normalized.includes(normalizedQuery) &&
      !entry.normalized.startsWith(normalizedQuery)
  )

  const combined = [...startsWithMatches, ...containsMatches]
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const entry of combined) {
    if (!seen.has(entry.original)) {
      seen.add(entry.original)
      deduped.push(entry.original)
    }
    if (deduped.length >= MAX_SUGGESTIONS) break
  }

  return deduped
}

const resolveLabel = (
  value: string,
  lookup: Map<string, string>,
  fallback: (input: string) => string = toTitleCase
) => {
  const normalized = normalizeValue(value)
  if (!normalized) return ''
  return lookup.get(normalized) ?? fallback(value)
}

const getTimestampString = (value: unknown) => {
  if (typeof value === 'string') return value

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      return value.toDate().toISOString()
    } catch {
      return new Date().toISOString()
    }
  }

  return new Date().toISOString()
}

const formatFileSize = (bytes?: number) => {
  if (!bytes || Number.isNaN(bytes)) return 'Size unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const formatDisplayDate = (isoString?: string) => {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
export default function ContributionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [userNotes, setUserNotes] = useState<UserNote[]>([])
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const [isLoadingNotes, setIsLoadingNotes] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [noteActionState, setNoteActionState] = useState<{ id: string; type: 'save' | 'delete' } | null>(null)
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<{ name: string; subject: string; teacher: string; semester: string }>({
    name: '',
    subject: '',
    teacher: '',
    semester: '',
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'subject'>('recent')
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [teacherWarning, setTeacherWarning] = useState<string | null>(null)
  const [teacherOverrideConfirmed, setTeacherOverrideConfirmed] = useState(false)

  const subjectEntries = useMemo(
    () => SUBJECT_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )
  const subjectLookup = useMemo(() => {
    const map = new Map<string, string>()
    subjectEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [subjectEntries])
  const subjectSuggestions = useMemo(
    () => (noteEditingId ? buildSuggestions(noteDraft.subject, subjectEntries) : []),
    [noteDraft.subject, noteEditingId, subjectEntries]
  )

  const teacherEntries = useMemo(
    () => TEACHER_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )
  const teacherLookup = useMemo(() => {
    const map = new Map<string, string>()
    teacherEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [teacherEntries])
  const teacherSuggestions = useMemo(
    () => (noteEditingId ? buildSuggestions(noteDraft.teacher, teacherEntries) : []),
    [noteDraft.teacher, noteEditingId, teacherEntries]
  )
  const loadUserNotes = useCallback(async () => {
    if (!user?.uid) return

    setIsLoadingNotes(true)
    setNotesError(null)

    try {
      const notesRef = collection(db, 'notes')
      const constraintSets: Array<{ label: string; constraints: any[] }> = [
        {
          label: 'uploadedBy',
          constraints: [where('uploadedBy', '==', user.uid)],
        },
      ]

      if (user.email) {
        const emailLower = user.email.toLowerCase()
        constraintSets.push({
          label: `metadata.createdBy:${emailLower}`,
          constraints: [where('metadata.createdBy', '==', emailLower)],
        })
        constraintSets.push({
          label: `metadata.createdBy:${user.email}`,
          constraints: [where('metadata.createdBy', '==', user.email)],
        })
      }

      const contributorCandidates = new Set<string>()
      if (user.displayName) {
        const trimmed = user.displayName.trim()
        if (trimmed) {
          contributorCandidates.add(trimmed)
          contributorCandidates.add(toTitleCase(trimmed))
        }
      }
      if (user.email) {
        contributorCandidates.add(user.email.split('@')[0])
      }

      contributorCandidates.forEach((candidate) => {
        const value = candidate.trim()
        if (value) {
          constraintSets.push({
            label: `contributorName:${value}`,
            constraints: [where('contributorName', '==', value)],
          })
        }
      })

      const results = new Map<string, UserNote>()

      const runQueryWithFallback = async (constraints: any[]) => {
        try {
          return await getDocs(query(notesRef, ...constraints, orderBy('uploadedAt', 'desc')))
        } catch (err) {
          if (err instanceof FirebaseError && err.code === 'failed-precondition') {
            return await getDocs(query(notesRef, ...constraints))
          }
          throw err
        }
      }

      for (const attempt of constraintSets) {
        try {
          const snapshot = await runQueryWithFallback(attempt.constraints)
          snapshot.docs.forEach((docSnap) => {
            if (results.has(docSnap.id)) return

            const data = docSnap.data() as Record<string, unknown>
            const uploadedAtRaw = data.uploadedAt
            const updatedAtRaw = data.updatedAt

            results.set(docSnap.id, {
              id: docSnap.id,
              name: typeof data.name === 'string' ? data.name : 'Untitled note',
              subject: typeof data.subject === 'string' ? data.subject : '',
              teacher: typeof data.teacher === 'string' ? data.teacher : typeof data.module === 'string' ? data.module : '',
              module: typeof data.module === 'string' ? data.module : undefined,
              semester: typeof data.semester === 'string' ? data.semester : '',
              contributorName: typeof data.contributorName === 'string' ? data.contributorName : '',
              fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : '',
              fileSize: typeof data.fileSize === 'number' ? data.fileSize : undefined,
              uploadedAt: getTimestampString(uploadedAtRaw),
              updatedAt: updatedAtRaw ? getTimestampString(updatedAtRaw) : undefined,
            })
          })
        } catch (attemptError) {
          console.error('[Contributions] Failed to load notes using', attempt.label, attemptError)
        }
      }

      setUserNotes(Array.from(results.values()))
    } catch (error) {
      console.error('[Contributions] Error loading notes:', error)
      setNotesError(error instanceof Error ? error.message : 'Failed to load your contributions.')
    } finally {
      setIsLoadingNotes(false)
    }
  }, [user?.uid, user?.displayName, user?.email])

  useEffect(() => {
    if (!loading && user?.uid) {
      loadUserNotes()
    }
  }, [user?.uid, loading, loadUserNotes])

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth')
    }
  }, [user, loading, router])
  const searchTermLower = searchTerm.trim().toLowerCase()
  const filteredAndSortedNotes = userNotes
    .filter((note) => {
      const matchesSearch =
        !searchTermLower ||
        note.name.toLowerCase().includes(searchTermLower) ||
        (note.subject || '').toLowerCase().includes(searchTermLower) ||
        (note.teacher || note.module || '').toLowerCase().includes(searchTermLower)
      const matchesSubject = !filterSubject || normalizeValue(note.subject) === filterSubject
      return matchesSearch && matchesSubject
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'subject': {
          const subjectA = resolveLabel(a.subject, subjectLookup)
          const subjectB = resolveLabel(b.subject, subjectLookup)
          return subjectA.localeCompare(subjectB)
        }
        case 'recent':
        default:
          return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      }
    })

  const uniqueSubjectOptions = useMemo(() => {
    const keys = new Set<string>()
    userNotes.forEach((note) => {
      const normalized = normalizeValue(note.subject)
      if (normalized) {
        keys.add(normalized)
      }
    })
    return Array.from(keys).map((key) => ({
      key,
      label: subjectLookup.get(key) ?? toTitleCase(key),
    }))
  }, [userNotes, subjectLookup])

  const stats: ActivityStats = {
    totalContributions: userNotes.length,
    uniqueSubjects: uniqueSubjectOptions.length,
    totalViews: 0,
    lastActiveDate: userNotes.length > 0 ? userNotes[0].uploadedAt : new Date().toISOString(),
  }
  const hasAnyNotes = userNotes.length > 0
  const hasFilteredNotes = filteredAndSortedNotes.length > 0
  const subjectFilterLabel = filterSubject
    ? subjectLookup.get(filterSubject) ?? toTitleCase(filterSubject)
    : ''
  const hasActiveFilters = Boolean(searchTerm.trim() || filterSubject)
  const lastActiveLabel = stats.totalContributions ? formatDisplayDate(stats.lastActiveDate) : 'No uploads yet'
  const nextMilestone = stats.totalContributions < 5 ? 5 : stats.totalContributions + 5
  const [contributorDisplayName, setContributorDisplayName] = useState('')

  // Load user's profile to get their actual name
  useEffect(() => {
    const loadProfileName = async () => {
      if (!user?.uid) return

      try {
        const profileRef = doc(db, 'profiles', user.uid)
        const profileSnap = await getDoc(profileRef)

        if (profileSnap.exists()) {
          const profileData = profileSnap.data()
          const fullName = profileData.fullName || user?.displayName || user?.email?.split('@')[0] || 'Contributor'
          setContributorDisplayName(fullName)
        } else {
          // Fallback to display name or email if no profile exists
          const fallbackName = user?.displayName || user?.email?.split('@')[0] || 'Contributor'
          setContributorDisplayName(fallbackName)
        }
      } catch (error) {
        console.error('Error loading profile name:', error)
        const fallbackName = user?.displayName || user?.email?.split('@')[0] || 'Contributor'
        setContributorDisplayName(fallbackName)
      }
    }

    loadProfileName()
  }, [user?.uid, user?.displayName, user?.email])
  const handleNoteEditStart = (note: UserNote) => {
    setNotesError(null)
    setSubjectError(null)
    setTeacherWarning(null)
    setTeacherOverrideConfirmed(false)
    setNoteEditingId(note.id)

    const teacherValue = note.teacher || note.module || ''
    setNoteDraft({
      name: note.name,
      subject: note.subject ? resolveLabel(note.subject, subjectLookup) : '',
      teacher: teacherValue ? resolveLabel(teacherValue, teacherLookup) : '',
      semester: note.semester || '',
    })
  }

  const handleNoteEditCancel = () => {
    setNoteEditingId(null)
    setNoteDraft({ name: '', subject: '', teacher: '', semester: '' })
    setSubjectError(null)
    setTeacherWarning(null)
    setTeacherOverrideConfirmed(false)
  }

  const handleNoteEditSave = async () => {
    if (!noteEditingId) return

    setNotesError(null)

    const targetNote = userNotes.find((note) => note.id === noteEditingId)
    if (!targetNote) {
      handleNoteEditCancel()
      return
    }

    const trimmedName = noteDraft.name.trim()
    const trimmedSubjectInput = noteDraft.subject.trim()
    const trimmedTeacherInput = noteDraft.teacher.trim()
    const trimmedSemester = noteDraft.semester.trim()

    if (!trimmedName || !trimmedSubjectInput || !trimmedTeacherInput || !trimmedSemester) {
      setNotesError('Please fill in the title, subject, teacher, and semester.')
      return
    }

    const subjectKey = normalizeValue(trimmedSubjectInput)
    const canonicalSubject = subjectLookup.get(subjectKey)
    if (!canonicalSubject) {
      setSubjectError('Please choose a subject from the matching list before saving.')
      return
    }

    let teacherToPersist = trimmedTeacherInput
    const teacherKey = normalizeValue(trimmedTeacherInput)
    const canonicalTeacher = teacherLookup.get(teacherKey)
    if (canonicalTeacher) {
      teacherToPersist = canonicalTeacher
      setTeacherWarning(null)
      if (teacherOverrideConfirmed) {
        setTeacherOverrideConfirmed(false)
      }
    } else if (!teacherOverrideConfirmed) {
      setTeacherWarning(
        'We could not find this teacher in our directory. Double-check the spelling or click Save again to continue.'
      )
      setTeacherOverrideConfirmed(true)
      return
    }

    setSubjectError(null)

    const previousNotes = userNotes
    const updatedAtLocal = new Date().toISOString()
    const nextNotes = previousNotes.map((note) =>
      note.id === noteEditingId
        ? {
            ...note,
            name: trimmedName,
            subject: canonicalSubject,
            teacher: teacherToPersist,
            module: teacherToPersist,
            semester: trimmedSemester,
            updatedAt: updatedAtLocal,
          }
        : note
    )

    setNoteActionState({ id: noteEditingId, type: 'save' })
    setUserNotes(nextNotes)

    try {
      const noteRef = doc(db, 'notes', noteEditingId)
      await updateDoc(noteRef, {
        name: trimmedName,
        subject: canonicalSubject,
        teacher: teacherToPersist,
        module: teacherToPersist,
        semester: trimmedSemester,
        updatedAt: serverTimestamp(),
      })

      handleNoteEditCancel()
    } catch (error) {
      setUserNotes(previousNotes)
      console.error('[Contributions] Note update error:', error)
      setNotesError(error instanceof Error ? error.message : 'Failed to update note details.')
    } finally {
      setNoteActionState(null)
    }
  }

  const handleNoteDelete = async (noteId: string) => {
    const targetNote = userNotes.find((note) => note.id === noteId)
    if (!targetNote) return

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Remove "${targetNote.name}" from the shared library?`)
      if (!confirmed) return
    }

    setNotesError(null)
    setNoteActionState({ id: noteId, type: 'delete' })

    const previousNotes = userNotes
    const nextNotes = previousNotes.filter((note) => note.id !== noteId)
    setUserNotes(nextNotes)

    try {
      await deleteDoc(doc(db, 'notes', noteId))
    } catch (error) {
      console.error('[Contributions] Note delete error:', error)
      setUserNotes(previousNotes)
      setNotesError(error instanceof Error ? error.message : 'Failed to delete note.')
    } finally {
      setNoteActionState(null)
    }
  }

  const handleNoteView = (fileUrl: string) => {
    if (!fileUrl) return
    if (typeof window !== 'undefined') {
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const handleScanRequest = () => {
    setIsScannerOpen(true)
    setIsUploadModalOpen(false)
  }

  const handleScannerComplete = (file: File) => {
    setScannedFile(file)
    setIsScannerOpen(false)
    setIsUploadModalOpen(true)
  }

  const handleScannerClose = () => {
    setIsScannerOpen(false)
    setScannedFile(null)
  }

  const openUploadModal = () => {
    setIsUploadModalOpen(true)
  }
  if (loading || isLoadingNotes) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white pt-28">
          <div className="mx-auto flex h-full max-w-6xl items-center justify-center px-4">
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-amber-200/70 bg-white/80 px-6 py-8 text-center shadow-sm backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-[#90c639]" />
              <span className="text-sm font-semibold text-gray-700">Loading your contributions...</span>
              <span className="text-xs text-gray-500">We are syncing your uploads and activity log.</span>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gradient-to-b from-[#f4fbe8] via-white to-white">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#90c639] via-[#7ab332] to-[#6a9c2d] shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/10" />
            <div className="absolute inset-0">
              <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
              <div className="absolute -bottom-24 -right-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            </div>
            <div className="relative z-10 flex flex-col gap-10 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/90">
                  <Sparkles className="h-4 w-4" />
                  Contribution hub
                </p>
                <h1 className="mt-4 text-3xl font-bold leading-snug text-white sm:text-4xl">
                  Hey {contributorDisplayName || 'Contributor'}, your notes inspire classmates every day.
                </h1>
                <p className="mt-4 text-sm text-white/90 sm:text-base">
                  Curate, refine, and manage every file you have shared with your community in one calm workspace.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openUploadModal}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#90c639] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white/95"
                  >
                    <Plus className="h-4 w-4" />
                    Upload new note
                  </button>
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 hover:border-white/30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to profile
                  </button>
                </div>
              </div>

              <div className="grid w-full max-w-xs grid-cols-2 gap-4 sm:max-w-sm">
                <div className="rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Total files</p>
                  <p className="mt-2 text-3xl font-bold text-white">{stats.totalContributions}</p>
                </div>
                <div className="rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Subjects covered</p>
                  <p className="mt-2 text-3xl font-bold text-white">{stats.uniqueSubjects}</p>
                </div>
                <div className="col-span-2 rounded-2xl bg-white/15 px-4 py-5 backdrop-blur-sm border border-white/20">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Last active</p>
                  <p className="mt-2 text-lg font-semibold text-white">{lastActiveLabel}</p>
                </div>
              </div>
            </div>
          </div>
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-2xl border border-emerald-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">{stats.totalContributions} uploads</p>
                  <p className="text-xs text-gray-500">Shared with your classmates</p>
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {stats.uniqueSubjects} subject{stats.uniqueSubjects === 1 ? '' : 's'}
                  </p>
                  <p className="text-xs text-gray-500">Breadth of your coverage</p>
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-lime-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-100 text-lime-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">Next milestone: {nextMilestone}</p>
                  <p className="text-xs text-gray-500">Keep the streak going</p>
                </div>
              </div>
            </article>
            <article className="rounded-2xl border border-sky-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900">{lastActiveLabel}</p>
                  <p className="text-xs text-gray-500">Most recent activity</p>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-10">
            <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by title, subject, or teacher"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-xl border border-amber-200 bg-white/90 px-9 py-2 text-sm text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={filterSubject}
                    onChange={(event) => setFilterSubject(event.target.value)}
                    className="rounded-xl border border-amber-200 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                  >
                    <option value="">All subjects</option>
                    {uniqueSubjectOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as 'recent' | 'name' | 'subject')}
                    className="rounded-xl border border-amber-200 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                  >
                    <option value="recent">Most recent</option>
                    <option value="name">Alphabetical</option>
                    <option value="subject">By subject</option>
                  </select>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterSubject('')
                        setSearchTerm('')
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#90c639]/30 bg-[#f4fbe8] px-4 py-2 text-sm font-semibold text-[#335013] transition hover:bg-[#e8f6d1]"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="font-semibold text-gray-700">Active:</span>
                  {searchTermLower && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f4fbe8] px-3 py-1 font-medium text-[#365316]">
                      Search “{searchTerm}”
                    </span>
                  )}
                  {filterSubject && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f4fbe8] px-3 py-1 font-medium text-[#365316]">
                      Subject {subjectFilterLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {notesError && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
              {notesError}
            </div>
          )}

          <section className="mt-8 space-y-5">
            {!hasFilteredNotes ? (
              <div className="rounded-3xl border border-amber-200/70 bg-white/80 px-8 py-12 text-center shadow-sm backdrop-blur-sm">
                <FileText className="mx-auto mb-4 h-12 w-12 text-amber-400" />
                <h3 className="mb-2 text-xl font-semibold text-gray-900">
                  {hasAnyNotes ? 'No notes match your filters' : 'You have not uploaded any notes yet'}
                </h3>
                <p className="text-sm text-gray-600">
                  {hasAnyNotes
                    ? 'Adjust your search keywords or clear filters to see more results.'
                    : 'Share your first set of notes and help classmates catch up faster.'}
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSubject('')
                      setSearchTerm('')
                      if (!hasAnyNotes) {
                        openUploadModal()
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332]"
                  >
                    {hasAnyNotes ? (
                      <span>Reset filters</span>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>Upload your first note</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              filteredAndSortedNotes.map((note) => {
                const isEditing = noteEditingId === note.id
                const isSaving = noteActionState?.id === note.id && noteActionState.type === 'save'
                const isDeleting = noteActionState?.id === note.id && noteActionState.type === 'delete'
                const subjectLabel = resolveLabel(note.subject, subjectLookup)
                const teacherLabel = resolveLabel(note.teacher || note.module || '', teacherLookup)

                return (
                  <article
                    key={note.id}
                    className="rounded-3xl border border-amber-200/70 bg-white/90 p-6 shadow-sm transition hover:shadow-md backdrop-blur-sm"
                  >
                    {isEditing ? (
                      <div className="space-y-5">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                            Title
                          </label>
                          <input
                            type="text"
                            value={noteDraft.name}
                            onChange={(event) => setNoteDraft((prev) => ({ ...prev, name: event.target.value }))}
                            className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                            placeholder="e.g., Calculus Midterm Solutions"
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="md:col-span-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Subject
                            </label>
                            <input
                              type="text"
                              value={noteDraft.subject}
                              onChange={(event) => {
                                const value = event.target.value
                                setNoteDraft((prev) => ({ ...prev, subject: value }))
                                if (subjectError) {
                                  setSubjectError(null)
                                }
                              }}
                              onBlur={() =>
                                setNoteDraft((prev) => {
                                  const canonical = subjectLookup.get(normalizeValue(prev.subject))
                                  return canonical ? { ...prev, subject: canonical } : prev
                                })
                              }
                              className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                              placeholder="Start typing to find a subject"
                            />
                            {subjectError && (
                              <p className="mt-2 text-xs font-semibold text-rose-600">{subjectError}</p>
                            )}
                            {subjectSuggestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {subjectSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => {
                                      setNoteDraft((prev) => ({ ...prev, subject: suggestion }))
                                      setSubjectError(null)
                                    }}
                                    className="rounded-full border border-[#90c639]/30 bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316] transition hover:bg-[#e8f6d1]"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="md:col-span-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Teacher
                            </label>
                            <input
                              type="text"
                              value={noteDraft.teacher}
                              onChange={(event) => {
                                const value = event.target.value
                                setNoteDraft((prev) => ({ ...prev, teacher: value }))
                                if (teacherWarning) {
                                  setTeacherWarning(null)
                                }
                                if (teacherOverrideConfirmed) {
                                  setTeacherOverrideConfirmed(false)
                                }
                              }}
                              onBlur={() =>
                                setNoteDraft((prev) => {
                                  const canonical = teacherLookup.get(normalizeValue(prev.teacher))
                                  return canonical ? { ...prev, teacher: canonical } : prev
                                })
                              }
                              className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                              placeholder="Start typing to find a teacher"
                            />
                            {teacherSuggestions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {teacherSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    type="button"
                                    onClick={() => {
                                      setNoteDraft((prev) => ({ ...prev, teacher: suggestion }))
                                      setTeacherWarning(null)
                                      setTeacherOverrideConfirmed(false)
                                    }}
                                    className="rounded-full border border-[#90c639]/30 bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316] transition hover:bg-[#e8f6d1]"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            )}
                            {teacherWarning && (
                              <p className="mt-2 text-xs font-semibold text-amber-600">{teacherWarning}</p>
                            )}
                          </div>

                          <div className="md:col-span-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                              Semester
                            </label>
                            <input
                              type="text"
                              value={noteDraft.semester}
                              onChange={(event) =>
                                setNoteDraft((prev) => ({ ...prev, semester: event.target.value }))
                              }
                              className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                              placeholder="e.g., 1"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={handleNoteEditSave}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={handleNoteEditCancel}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-start gap-4">
                            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#f4fbe8] text-[#365316]">
                              <FileText className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900">{note.name}</h3>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {subjectLabel && (
                                  <span className="inline-flex items-center rounded-full bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316]">
                                    {subjectLabel}
                                  </span>
                                )}
                                {teacherLabel && (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                    {teacherLabel}
                                  </span>
                                )}
                                {note.semester && (
                                  <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                                    Semester {note.semester}
                                  </span>
                                )}
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  Uploaded {formatDisplayDate(note.uploadedAt)}
                                </span>
                                {note.updatedAt && note.updatedAt !== note.uploadedAt && (
                                  <span className="flex items-center gap-1">
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edited {formatDisplayDate(note.updatedAt)}
                                  </span>
                                )}
                                <span>{formatFileSize(note.fileSize)}</span>
                              </div>

                              {note.contributorName && (
                                <p className="mt-3 text-sm text-gray-600">
                                  Shared as{' '}
                                  <span className="font-semibold text-gray-800">{note.contributorName}</span>
                                </p>
                              )}

                              {note.fileUrl && (
                                <div className="mt-4 flex flex-wrap gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleNoteView(note.fileUrl)}
                                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                  >
                                    <Eye className="h-4 w-4" />
                                    View
                                  </button>
                                  <a
                                    href={note.fileUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                                  >
                                    <Download className="h-4 w-4" />
                                    Download
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 lg:items-end">
                          <button
                            type="button"
                            onClick={() => handleNoteEditStart(note)}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleNoteDelete(note.id)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                )
              })
            )}
          </section>
        </div>
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onScanRequest={handleScanRequest}
        scannedFile={scannedFile}
      />

      {/* Scanner Modal */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={handleScannerClose}
        onComplete={handleScannerComplete}
      />
    </>
  )
}

