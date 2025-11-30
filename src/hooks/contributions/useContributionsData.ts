'use client'

import { useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useContributions } from '@/contexts/ContributionsContext'
import { contributionsService } from '@/services/contributionsService'
import { getUserProfile } from '@/lib/firebase'
import { useSuggestionEngine } from './useSuggestionEngine'
import { UserNote, ActivityStats } from '@/types/contributions'

// Re-export types for convenience
export type { UserNote, ActivityStats, NoteActionState } from '@/types/contributions'

export function useContributionsData() {
  const { user } = useAuth()
  const {
    // Data
    userNotes,
    // Data setters
    setUserNotes,
    setFilteredNotes,
    setStats,
    setSubjectOptions,
    setError,
    setNoteActionState,
    setLoading,
    // Edit state
    editState,
    updateEditDraft,
    setEditError,
    setEditWarning,
    cancelEditing,
    setTeacherOverrideConfirmed,
    validateNoteDraft,
    // Filter state
    searchTerm,
    filterSubject,
    sortBy,
    setSearchTerm,
    setFilterSubject,
    setSortBy,
    clearFilters,
  } = useContributions()

  const { subjectLookup, teacherLookup, normalizeValue, resolveLabel } = useSuggestionEngine(
    editState.id,
    editState.draft
  )

  // Load user contributions
  const loadUserContributions = useCallback(async () => {
    if (!user?.uid) return

    setLoading(true)
    setError(null)

    try {
      // Get user's profile to access username for better contribution matching
      let userUsername: string | undefined
      try {
        const userProfile = await getUserProfile(user.uid)
        userUsername = userProfile?.username
      } catch (profileError) {
        console.warn('[useContributionsData] Could not load user profile for username:', profileError)
      }

      const response = await contributionsService.loadUserContributions(
        user.uid,
        user.displayName || undefined,
        user.email || undefined,
        userUsername
      )

      if (response.success && response.data) {
        setUserNotes(response.data)
      } else {
        setError(response.error || 'Failed to load contributions')
      }
    } catch (error) {
      console.error('[useContributionsData] Error loading contributions:', error)
      setError('Failed to load your contributions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.uid, user?.displayName, user?.email, setUserNotes, setLoading, setError])

  // Load user profile name
  const loadUserProfileName = useCallback(async () => {
    if (!user?.uid) return

    try {
      const response = await contributionsService.loadUserProfile(user.uid)
      if (response.success && response.data) {
        // Update contributor display name in stats or wherever needed
        console.log('Loaded profile name:', response.data)
      }
    } catch (error) {
      console.error('[useContributionsData] Error loading profile name:', error)
    }
  }, [user?.uid])

  // Filter and sort notes
  const applyFiltersAndSort = useCallback(() => {

    const filtered = userNotes
      .filter((note) => {
        const searchTermLower = searchTerm.trim().toLowerCase()
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

    setFilteredNotes(filtered)

    // Update subject options for filters
    const keys = new Set<string>()
    userNotes.forEach((note) => {
      const normalized = normalizeValue(note.subject)
      if (normalized) {
        keys.add(normalized)
      }
    })
    const options = Array.from(keys).map((key) => ({
      key,
      label: subjectLookup.get(key) || key,
    }))
    setSubjectOptions(options)

    // Update stats
    const stats: ActivityStats = {
      totalContributions: userNotes.length,
      uniqueSubjects: options.length,
      totalViews: 0,
      lastActiveDate: userNotes.length > 0 ? userNotes[0].uploadedAt : new Date().toISOString(),
    }
    setStats(stats)
  }, [
    userNotes,
    searchTerm,
    filterSubject,
    sortBy,
    normalizeValue,
    subjectLookup,
    resolveLabel,
    setFilteredNotes,
    setSubjectOptions,
    setStats,
  ])

  // Edit handlers
  const startEditing = useCallback((note: UserNote) => {
    const teacherValue = note.teacher || note.module || ''
    updateEditDraft({
      name: note.name,
      subject: note.subject ? resolveLabel(note.subject, subjectLookup) : '',
      teacher: teacherValue ? resolveLabel(teacherValue, teacherLookup) : '',
      semester: note.semester || '',
    })
  }, [subjectLookup, teacherLookup, resolveLabel, updateEditDraft])

  const saveNote = useCallback(async () => {
    if (!editState.id) return

    const validationErrors = validateNoteDraft()
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => {
        setEditError(error.field, error.message)
      })
      return
    }

    // Validate subject
    const subjectValidation = await contributionsService.validateSubject(
      editState.draft.subject,
      subjectLookup
    )
    if (!subjectValidation.success) {
      setEditError('subject', subjectValidation.error || 'Invalid subject')
      return
    }

    // Validate teacher
    const teacherValidation = await contributionsService.validateTeacher(
      editState.draft.teacher,
      teacherLookup,
      editState.isTeacherOverrideConfirmed
    )
    if (!teacherValidation.success) {
      if (teacherValidation.error?.includes('could not find this teacher')) {
        setEditWarning('teacher', teacherValidation.error)
        setTeacherOverrideConfirmed(true)
        return
      } else {
        setEditError('teacher', teacherValidation.error || 'Invalid teacher')
        return
      }
    }

    // Clear any previous errors
    setEditError('subject', null)
    setEditError('teacher', null)
    setEditWarning('teacher', null)

    setNoteActionState({ id: editState.id, type: 'save' })

    try {
      const response = await contributionsService.updateContribution(editState.id, {
        name: editState.draft.name.trim(),
        subject: subjectValidation.data!,
        teacher: teacherValidation.data!.teacher,
        semester: editState.draft.semester.trim(),
      })

      if (response.success) {
        // Update local state optimistically
        const updatedNotes = userNotes.map((note) =>
          note.id === editState.id
            ? {
              ...note,
              name: editState.draft.name.trim(),
              subject: subjectValidation.data!,
              teacher: teacherValidation.data!.teacher,
              module: teacherValidation.data!.teacher,
              semester: editState.draft.semester.trim(),
              updatedAt: new Date().toISOString(),
            }
            : note
        )
        setUserNotes(updatedNotes)
        cancelEditing()
      } else {
        setError(response.error || 'Failed to update note')
      }
    } catch (error) {
      console.error('[useContributionsData] Error updating note:', error)
      setError('Failed to update note. Please try again.')
    } finally {
      setNoteActionState(null)
    }
  }, [
    userNotes,
    editState,
    validateNoteDraft,
    setEditError,
    setEditWarning,
    setTeacherOverrideConfirmed,
    subjectLookup,
    teacherLookup,
    setNoteActionState,
    setUserNotes,
    cancelEditing,
    setError,
  ])

  const deleteNote = useCallback(async (noteId: string) => {
    const targetNote = userNotes.find((note) => note.id === noteId)
    if (!targetNote) return

    setError(null)
    setNoteActionState({ id: noteId, type: 'delete' })

    try {
      const response = await contributionsService.deleteContribution(noteId)
      if (response.success) {
        const updatedNotes = userNotes.filter((note) => note.id !== noteId)
        setUserNotes(updatedNotes)
      } else {
        setError(response.error || 'Failed to delete note')
      }
    } catch (error) {
      console.error('[useContributionsData] Error deleting note:', error)
      setError('Failed to delete note. Please try again.')
    } finally {
      setNoteActionState(null)
    }
  }, [userNotes, setError, setNoteActionState, setUserNotes])

  // Effects
  useEffect(() => {
    if (user?.uid) {
      loadUserContributions()
    }
  }, [user?.uid, loadUserContributions])

  useEffect(() => {
    loadUserProfileName()
  }, [loadUserProfileName])

  // Re-apply filters when notes or filter criteria change
  useEffect(() => {
    applyFiltersAndSort()
  }, [applyFiltersAndSort])

  return {
    // Data
    loadUserContributions,

    // Actions
    startEditing,
    saveNote,
    deleteNote,

    // Filter/sort actions
    setSearchTerm,
    setFilterSubject,
    setSortBy,
    clearFilters,

    // Utility functions
    normalizeValue,
    resolveLabel,

    // Suggestions from suggestion engine
    subjectLookup,
    teacherLookup,
  }
}
