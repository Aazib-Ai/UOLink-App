'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import {
  UserNote,
  ActivityStats,
  NoteActionState,
  SubjectOption,
  NoteEditState,
  NoteValidationError
} from '@/types/contributions'

interface ContributionsContextType {
  // Data
  userNotes: UserNote[]
  filteredNotes: UserNote[]
  stats: ActivityStats
  subjectOptions: SubjectOption[]

  // Loading and error states
  isLoading: boolean
  error: string | null
  noteActionState: NoteActionState | null

  // Search and filter state
  searchTerm: string
  filterSubject: string
  sortBy: 'recent' | 'name' | 'subject'
  hasActiveFilters: boolean

  // Edit state
  editState: NoteEditState

  // Actions
  setUserNotes: (notes: UserNote[]) => void
  setFilteredNotes: (notes: UserNote[]) => void
  setStats: (stats: ActivityStats) => void
  setSubjectOptions: (options: SubjectOption[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setNoteActionState: (state: NoteActionState | null) => void

  setSearchTerm: (term: string) => void
  setFilterSubject: (subject: string) => void
  setSortBy: (sort: 'recent' | 'name' | 'subject') => void
  clearFilters: () => void

  // Edit actions
  startEditing: (note: UserNote) => void
  cancelEditing: () => void
  updateEditDraft: (draft: Partial<NoteEditState['draft']>) => void
  setEditError: (field: 'name' | 'subject' | 'teacher' | 'semester' | 'general', error: string | null) => void
  setEditWarning: (field: 'teacher', warning: string | null) => void
  setTeacherOverrideConfirmed: (confirmed: boolean) => void

  // Validation
  validateNoteDraft: () => NoteValidationError[]

  // UI helpers
  hasAnyNotes: boolean
  hasFilteredNotes: boolean
}

const ContributionsContext = createContext<ContributionsContextType | undefined>(undefined)

export function useContributions() {
  const context = useContext(ContributionsContext)
  if (context === undefined) {
    throw new Error('useContributions must be used within a ContributionsProvider')
  }
  return context
}

interface ContributionsProviderProps {
  children: ReactNode
}

export function ContributionsProvider({ children }: ContributionsProviderProps) {
  // Data state
  const [userNotes, setUserNotes] = useState<UserNote[]>([])
  const [filteredNotes, setFilteredNotes] = useState<UserNote[]>([])
  const [stats, setStats] = useState<ActivityStats>({
    totalContributions: 0,
    uniqueSubjects: 0,
    totalViews: 0,
    lastActiveDate: new Date().toISOString(),
  })
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([])

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [noteActionState, setNoteActionState] = useState<NoteActionState | null>(null)

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'subject'>('recent')

  // Edit state
  const [editState, setEditState] = useState<NoteEditState>({
    id: null,
    draft: {
      name: '',
      subject: '',
      teacher: '',
      semester: '',
    },
    errors: {
      name: null,
      subject: null,
      teacher: null,
      semester: null,
      general: null,
    },
    warnings: {
      teacher: null,
    },
    isTeacherOverrideConfirmed: false,
  })

  // Computed values
  const hasActiveFilters = Boolean(searchTerm.trim() || filterSubject)
  const hasAnyNotes = userNotes.length > 0
  const hasFilteredNotes = filteredNotes.length > 0

  // Actions
  const clearFilters = useCallback(() => {
    setSearchTerm('')
    setFilterSubject('')
  }, [])

  const startEditing = useCallback((note: UserNote) => {
    setError(null)
    setEditState({
      id: note.id,
      draft: {
        name: note.name,
        subject: note.subject,
        teacher: note.teacher || note.module || '',
        semester: note.semester || '',
      },
      errors: {
        name: null,
        subject: null,
        teacher: null,
        semester: null,
        general: null,
      },
      warnings: {
        teacher: null,
      },
      isTeacherOverrideConfirmed: false,
    })
  }, [])

  const cancelEditing = useCallback(() => {
    setEditState({
      id: null,
      draft: {
        name: '',
        subject: '',
        teacher: '',
        semester: '',
      },
      errors: {
        name: null,
        subject: null,
        teacher: null,
        semester: null,
        general: null,
      },
      warnings: {
        teacher: null,
      },
      isTeacherOverrideConfirmed: false,
    })
  }, [])

  const updateEditDraft = useCallback((draft: Partial<NoteEditState['draft']>) => {
    setEditState(prev => ({
      ...prev,
      draft: {
        ...prev.draft,
        ...draft
      }
    }))
  }, [])

  const setEditError = useCallback((field: 'name' | 'subject' | 'teacher' | 'semester' | 'general', error: string | null) => {
    setEditState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: error
      }
    }))
  }, [])

  const setEditWarning = useCallback((field: 'teacher', warning: string | null) => {
    setEditState(prev => ({
      ...prev,
      warnings: {
        ...prev.warnings,
        [field]: warning
      }
    }))
  }, [])

  const setTeacherOverrideConfirmed = useCallback((confirmed: boolean) => {
    setEditState(prev => ({
      ...prev,
      isTeacherOverrideConfirmed: confirmed
    }))
  }, [])

  const validateNoteDraft = useCallback((): NoteValidationError[] => {
    const errors: NoteValidationError[] = []
    const { draft } = editState

    if (!draft.name.trim()) {
      errors.push({ field: 'name', message: 'Title is required' })
    }
    if (!draft.subject.trim()) {
      errors.push({ field: 'subject', message: 'Subject is required' })
    }
    if (!draft.teacher.trim()) {
      errors.push({ field: 'teacher', message: 'Teacher is required' })
    }
    if (!draft.semester.trim()) {
      errors.push({ field: 'semester', message: 'Semester is required' })
    }

    return errors
  }, [editState])

  const value: ContributionsContextType = {
    // Data
    userNotes,
    filteredNotes,
    stats,
    subjectOptions,

    // Loading and error states
    isLoading,
    error,
    noteActionState,

    // Search and filter state
    searchTerm,
    filterSubject,
    sortBy,
    hasActiveFilters,

    // Edit state
    editState,

    // Actions
    setUserNotes,
    setFilteredNotes,
    setStats,
    setSubjectOptions,
    setLoading: setIsLoading,
    setError,
    setNoteActionState,

    setSearchTerm,
    setFilterSubject,
    setSortBy,
    clearFilters,

    // Edit actions
    startEditing,
    cancelEditing,
    updateEditDraft,
    setEditError,
    setEditWarning,
    setTeacherOverrideConfirmed,

    // Validation
    validateNoteDraft,

    // UI helpers
    hasAnyNotes,
    hasFilteredNotes,
  }

  return (
    <ContributionsContext.Provider value={value}>
      {children}
    </ContributionsContext.Provider>
  )
}

export default ContributionsContext