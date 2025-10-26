'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import {
  getInitialNotes,
  getFilterOptions,
  getAllNotesWithFilters,
  getNotesWithPagination,
} from '@/lib/firebase'
import { auth } from '@/lib/firebase'
import { SortMode } from '@/components/dashboard/constants'
import { computeTrendingScore, getTimestampAsDate } from '@/components/dashboard/constants'

interface DashboardStateContextValue {
  notes: any[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  filterOptions: any
  titleFilter: string
  semesterFilter: string
  subjectFilter: string
  nameFilter: string
  teacherFilter: string
  sectionFilter: string
  majorFilter: string
  materialTypeFilter: string
  materialSequenceFilter: string
  sortMode: SortMode
  admin: boolean
  displayedNotes: any[]
  isInitialized: boolean
  setNotes: React.Dispatch<React.SetStateAction<any[]>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setTitleFilter: React.Dispatch<React.SetStateAction<string>>
  setSemesterFilter: React.Dispatch<React.SetStateAction<string>>
  setSubjectFilter: React.Dispatch<React.SetStateAction<string>>
  setNameFilter: React.Dispatch<React.SetStateAction<string>>
  setTeacherFilter: React.Dispatch<React.SetStateAction<string>>
  setSectionFilter: React.Dispatch<React.SetStateAction<string>>
  setMajorFilter: React.Dispatch<React.SetStateAction<string>>
  setMaterialTypeFilter: React.Dispatch<React.SetStateAction<string>>
  setMaterialSequenceFilter: React.Dispatch<React.SetStateAction<string>>
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>
  applyFilters: () => Promise<void>
  loadMoreNotes: () => Promise<void>
  resetFilters: () => Promise<void>
  applyNotePatch: (noteId: string, patch: Record<string, any>) => void
  handleVoteScoreUpdate: (
    noteId: string,
    payload: { upvotes: number; downvotes: number; credibilityScore: number }
  ) => void
  handleReportUpdate: (noteId: string, reportCount: number, hasReported: boolean) => void
  hasActiveFilters: () => boolean
  getActiveFilterCount: () => number
}

const DashboardStateContext = createContext<DashboardStateContextValue | null>(null)

interface DashboardStateProviderProps {
  children: ReactNode
}

export function DashboardStateProvider({ children }: DashboardStateProviderProps) {
  // Notes state
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDocSnapshot, setLastDocSnapshot] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Filter options
  const [filterOptions, setFilterOptions] = useState<any>({
    subjects: [],
    teachers: [],
    semesters: [],
    sections: [],
    majors: [],
    materialTypes: [],
    materialSequences: [],
  })

  // Filter state
  const [titleFilter, setTitleFilter] = useState('')
  const [semesterFilter, setSemesterFilter] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [majorFilter, setMajorFilter] = useState('')
  const [materialTypeFilter, setMaterialTypeFilter] = useState('')
  const [materialSequenceFilter, setMaterialSequenceFilter] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('trending')

  // Admin state
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@example.com'
  const [admin, setAdmin] = useState(false)

  // Initialization state
  const [isInitialized, setIsInitialized] = useState(false)
  const hasFiltersEffectMounted = useRef(false)

  const applyFilters = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const hasFilters =
        titleFilter.trim() !== '' ||
        semesterFilter ||
        subjectFilter ||
        teacherFilter ||
        nameFilter ||
        sectionFilter ||
        majorFilter ||
        materialTypeFilter ||
        materialSequenceFilter

      if (hasFilters) {
        const filters = {
          semester: semesterFilter,
          subject: subjectFilter,
          teacher: teacherFilter,
          contributorName: nameFilter,
          section: sectionFilter,
          contributorMajor: majorFilter,
          materialType: materialTypeFilter,
          materialSequence: materialSequenceFilter,
        }
        const result = await getAllNotesWithFilters(filters, titleFilter)

        setNotes(result.notes)
        setLastDocSnapshot(null)
        setHasMore(false)
      } else {
        const result = await getInitialNotes()
        setNotes(result.notes)
        setLastDocSnapshot(result.lastDocSnapshot)
        setHasMore(result.hasMore)
      }
    } catch (err: any) {
      console.error('Error applying filters:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [
    titleFilter,
    semesterFilter,
    subjectFilter,
    teacherFilter,
    nameFilter,
    sectionFilter,
    majorFilter,
    materialTypeFilter,
    materialSequenceFilter,
  ])

  const loadMoreNotes = useCallback(async () => {
    if (loadingMore || !hasMore) {
      return
    }

    try {
      setLoadingMore(true)
      const result = await getNotesWithPagination(10, lastDocSnapshot, {})

      setNotes((prevNotes) => [...prevNotes, ...result.notes])
      setLastDocSnapshot(result.lastDocSnapshot)
      setHasMore(result.hasMore)
    } catch (err: any) {
      console.error('Error loading more notes:', err)
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, lastDocSnapshot])

  const resetFilters = useCallback(async () => {
    setTitleFilter('')
    setSemesterFilter('')
    setSubjectFilter('')
    setNameFilter('')
    setTeacherFilter('')
    setSectionFilter('')
    setMajorFilter('')
    setMaterialTypeFilter('')
    setMaterialSequenceFilter('')
    setSortMode('trending')

    try {
      setLoading(true)
      const result = await getInitialNotes()
      setNotes(result.notes)
      setLastDocSnapshot(result.lastDocSnapshot)
      setHasMore(result.hasMore)
    } catch (err: any) {
      console.error('Error resetting filters:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isInitialized) {
      return
    }

    let isMounted = true

    const fetchInitialData = async () => {
      try {
        setLoading(true)
        setError(null)

        const initialNotesResult = await getInitialNotes()
        if (!isMounted) {
          return
        }

        setNotes(initialNotesResult.notes)
        setLastDocSnapshot(initialNotesResult.lastDocSnapshot)
        setHasMore(initialNotesResult.hasMore)

        const filterOptionsResult = await getFilterOptions()
        if (isMounted) {
          setFilterOptions(filterOptionsResult)
        }

        const user = auth.currentUser
        if (isMounted && user && user.email === adminEmail) {
          setAdmin(true)
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error fetching initial data:', err)
          setError(err.message)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
          setIsInitialized(true)
        }
      }
    }

    fetchInitialData()

    return () => {
      isMounted = false
    }
  }, [adminEmail, isInitialized])

  useEffect(() => {
    if (!isInitialized) {
      return
    }

    if (!hasFiltersEffectMounted.current) {
      hasFiltersEffectMounted.current = true
      return
    }

    const timeoutId = setTimeout(() => {
      void applyFilters()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [applyFilters, isInitialized])

  useEffect(() => {
    if (materialSequenceFilter && !['assignment', 'quiz'].includes(materialTypeFilter)) {
      setMaterialSequenceFilter('')
    }
  }, [materialTypeFilter, materialSequenceFilter])

  const displayedNotes = useMemo(() => {
    if (!Array.isArray(notes)) {
      return []
    }

    const decorated = notes.map((note) => {
      const credibilityScore = typeof note?.credibilityScore === 'number' ? note.credibilityScore : 0
      const trendingScore = computeTrendingScore(note)
      const uploadedDate = getTimestampAsDate(note?.uploadedAt) || new Date(0)

      return {
        note,
        credibilityScore,
        trendingScore,
        uploadedDate,
      }
    })

    decorated.sort((a, b) => {
      if (sortMode === 'trending') {
        if (b.trendingScore !== a.trendingScore) {
          return b.trendingScore - a.trendingScore
        }
        return b.uploadedDate.getTime() - a.uploadedDate.getTime()
      }

      if (sortMode === 'top') {
        if (b.credibilityScore !== a.credibilityScore) {
          return b.credibilityScore - a.credibilityScore
        }
        return b.uploadedDate.getTime() - a.uploadedDate.getTime()
      }

      return b.uploadedDate.getTime() - a.uploadedDate.getTime()
    })

    return decorated.map((entry) => entry.note)
  }, [notes, sortMode])

  const hasActiveFilters = useCallback((): boolean => {
    return !!(
      titleFilter.trim() !== '' ||
      semesterFilter ||
      subjectFilter ||
      teacherFilter ||
      nameFilter ||
      sectionFilter ||
      majorFilter ||
      materialTypeFilter ||
      materialSequenceFilter
    )
  }, [
    titleFilter,
    semesterFilter,
    subjectFilter,
    teacherFilter,
    nameFilter,
    sectionFilter,
    majorFilter,
    materialTypeFilter,
    materialSequenceFilter,
  ])

  const getActiveFilterCount = useCallback(() => {
    let count = 0
    if (titleFilter.trim() !== '') count++
    if (semesterFilter) count++
    if (subjectFilter) count++
    if (teacherFilter) count++
    if (nameFilter) count++
    if (sectionFilter) count++
    if (majorFilter) count++
    if (materialTypeFilter) count++
    if (materialSequenceFilter) count++
    return count
  }, [
    titleFilter,
    semesterFilter,
    subjectFilter,
    teacherFilter,
    nameFilter,
    sectionFilter,
    majorFilter,
    materialTypeFilter,
    materialSequenceFilter,
  ])

  const applyNotePatch = useCallback((noteId: string, patch: Record<string, any>) => {
    setNotes((prevNotes) => prevNotes.map((note) => (note.id === noteId ? { ...note, ...patch } : note)))
  }, [])

  const handleVoteScoreUpdate = useCallback(
    (noteId: string, payload: { upvotes: number; downvotes: number; credibilityScore: number }) => {
      const now = new Date()
      applyNotePatch(noteId, {
        upvoteCount: payload.upvotes,
        downvoteCount: payload.downvotes,
        credibilityScore: payload.credibilityScore,
        lastInteractionAt: now,
        credibilityUpdatedAt: now,
      })
    },
    [applyNotePatch]
  )

  const handleReportUpdate = useCallback(
    (noteId: string, reportCount: number, _hasReported: boolean) => {
      const now = new Date()
      const currentNote = notes.find((note) => note.id === noteId)

      if (currentNote) {
        const newCredibilityScore =
          (currentNote.upvoteCount || 0) * 2 -
          (currentNote.downvoteCount || 0) * 3 +
          (currentNote.saveCount || 0) * 5 -
          reportCount * 10

        applyNotePatch(noteId, {
          reportCount,
          credibilityScore: newCredibilityScore,
          lastInteractionAt: now,
          credibilityUpdatedAt: now,
        })
      }
    },
    [applyNotePatch, notes]
  )

  const contextValue = useMemo<DashboardStateContextValue>(
    () => ({
      notes,
      loading,
      loadingMore,
      hasMore,
      error,
      filterOptions,
      titleFilter,
      semesterFilter,
      subjectFilter,
      nameFilter,
      teacherFilter,
      sectionFilter,
      majorFilter,
      materialTypeFilter,
      materialSequenceFilter,
      sortMode,
      admin,
      displayedNotes,
      isInitialized,
      setNotes,
      setError,
      setTitleFilter,
      setSemesterFilter,
      setSubjectFilter,
      setNameFilter,
      setTeacherFilter,
      setSectionFilter,
      setMajorFilter,
      setMaterialTypeFilter,
      setMaterialSequenceFilter,
      setSortMode,
      applyFilters,
      loadMoreNotes,
      resetFilters,
      applyNotePatch,
      handleVoteScoreUpdate,
      handleReportUpdate,
      hasActiveFilters,
      getActiveFilterCount,
    }),
    [
      notes,
      loading,
      loadingMore,
      hasMore,
      error,
      filterOptions,
      titleFilter,
      semesterFilter,
      subjectFilter,
      nameFilter,
      teacherFilter,
      sectionFilter,
      majorFilter,
      materialTypeFilter,
      materialSequenceFilter,
      sortMode,
      admin,
      displayedNotes,
      isInitialized,
      applyFilters,
      loadMoreNotes,
      resetFilters,
      applyNotePatch,
      handleVoteScoreUpdate,
      handleReportUpdate,
      hasActiveFilters,
      getActiveFilterCount,
    ]
  )

  return <DashboardStateContext.Provider value={contextValue}>{children}</DashboardStateContext.Provider>
}

export function useDashboardState() {
  const context = useContext(DashboardStateContext)
  if (!context) {
    throw new Error('useDashboardState must be used within a DashboardStateProvider')
  }
  return context
}
