import React from 'react'
import { NoteCard } from './NoteCard'
import { Note, FilterState, HandlerCallbacks, ProfileData } from './note-card/types'

// Backward compatibility wrapper for existing API
interface NoteCardWrapperProps {
  note: any
  subjectFilter: string
  setSubjectFilter: (value: string) => void
  teacherFilter: string
  setTeacherFilter: (value: string) => void
  semesterFilter: string
  setSemesterFilter: (value: string) => void
  sectionFilter: string
  setSectionFilter: (value: string) => void
  materialTypeFilter: string
  setMaterialTypeFilter: (value: string) => void
  materialSequenceFilter: string
  setMaterialSequenceFilter: (value: string) => void
  savedNotes: Record<string, boolean>
  savingNotes?: boolean
  isNoteSaving?: (noteId: string) => boolean
  profileData: {
    profilePictures: Record<string, string | undefined>
    profileUsernames: Record<string, string | undefined>  // Changed from profileSlugs to profileUsernames
    profileAura: Record<string, {
      aura: number
      tierName: string
      badgeClass: string
      borderClass: string
    }>
  }
  admin: boolean
  user: any
  handleViewNote: (note: any) => void
  handleSaveNote: (noteId: string) => void
  handleVoteScoreUpdate: (noteId: string, payload: any) => void
  handleReportUpdate: (noteId: string, reportCount: number, hasReported: boolean) => void
  handleDelete: (id: string, title: string, subject: string) => void
  handleShare?: (noteUrl: string, noteId: string, noteSubject: string, noteTeacher: string, noteContributorName: string) => void
}

export const NoteCardWrapper: React.FC<NoteCardWrapperProps> = ({
  note,
  subjectFilter,
  setSubjectFilter,
  teacherFilter,
  setTeacherFilter,
  semesterFilter,
  setSemesterFilter,
  sectionFilter,
  setSectionFilter,
  materialTypeFilter,
  setMaterialTypeFilter,
  materialSequenceFilter,
  setMaterialSequenceFilter,
  savedNotes,
  savingNotes,
  isNoteSaving,
  profileData,
  admin,
  user,
  handleViewNote,
  handleSaveNote,
  handleVoteScoreUpdate,
  handleReportUpdate,
  handleDelete,
  handleShare
}) => {
  // Convert old API to new grouped interfaces
  const filters: FilterState = {
    subjectFilter,
    setSubjectFilter,
    teacherFilter,
    setTeacherFilter,
    semesterFilter,
    setSemesterFilter,
    sectionFilter,
    setSectionFilter,
    materialTypeFilter,
    setMaterialTypeFilter,
    materialSequenceFilter,
    setMaterialSequenceFilter
  }

  const handlers: HandlerCallbacks = {
    handleViewNote,
    handleSaveNote,
    handleVoteScoreUpdate,
    handleReportUpdate,
    handleDelete,
    handleShare
  }

  const typedProfileData: ProfileData = profileData as ProfileData

  return (
    <NoteCard
      note={note as Note}
      subjectFilter={filters.subjectFilter}
      setSubjectFilter={filters.setSubjectFilter}
      teacherFilter={filters.teacherFilter}
      setTeacherFilter={filters.setTeacherFilter}
      semesterFilter={filters.semesterFilter}
      setSemesterFilter={filters.setSemesterFilter}
      sectionFilter={filters.sectionFilter}
      setSectionFilter={filters.setSectionFilter}
      materialTypeFilter={filters.materialTypeFilter}
      setMaterialTypeFilter={filters.setMaterialTypeFilter}
      materialSequenceFilter={filters.materialSequenceFilter}
      setMaterialSequenceFilter={filters.setMaterialSequenceFilter}
      handleViewNote={handlers.handleViewNote}
      handleSaveNote={handlers.handleSaveNote}
      handleVoteScoreUpdate={handlers.handleVoteScoreUpdate}
      handleReportUpdate={handlers.handleReportUpdate}
      handleDelete={handlers.handleDelete}
      handleShare={handlers.handleShare}
      profileData={typedProfileData}
      savedNotes={savedNotes}
      admin={admin}
      user={user}
      savingNotes={savingNotes}
      isNoteSaving={isNoteSaving}
    />
  )
}

// Export as default for backward compatibility
export default NoteCardWrapper
