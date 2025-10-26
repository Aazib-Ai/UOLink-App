import { formatAura } from '@/lib/aura'
import { buildMaterialDisplay } from './utils/noteFormatting'
import { NoteCardShell } from './note-card/NoteCardShell'
import { Note, FilterState, HandlerCallbacks, ProfileData, Variant } from './note-card/types'

interface NoteCardProps {
  note: Note
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
  handleViewNote: (note: Note) => void
  handleSaveNote: (noteId: string) => void
  handleVoteScoreUpdate: (noteId: string, payload: any) => void
  handleReportUpdate: (noteId: string, reportCount: number, hasReported: boolean) => void
  handleDelete: (id: string, title: string, subject: string) => void
  handleShare?: (noteUrl: string, noteId: string, noteSubject: string, noteTeacher: string, noteContributorName: string) => void
  profileData: ProfileData
  savedNotes: Record<string, boolean>
  admin: boolean
  user: any
  savingNotes?: boolean
  isNoteSaving?: (noteId: string) => boolean
}

export const NoteCard: React.FC<NoteCardProps> = ({
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
  handleViewNote,
  handleSaveNote,
  handleVoteScoreUpdate,
  handleReportUpdate,
  handleDelete,
  handleShare,
  profileData,
  savedNotes,
  admin,
  user,
  savingNotes,
  isNoteSaving
}) => {
  // Construct filters object from individual props
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

  // Construct handlers object from individual props
  const handlers: HandlerCallbacks = {
    handleViewNote,
    handleSaveNote,
    handleVoteScoreUpdate,
    handleReportUpdate,
    handleDelete,
    handleShare
  }
  // Add materialDisplay to note for child components
  const enrichedNote = {
    ...note,
    materialDisplay: buildMaterialDisplay(note)
  }

  const getVariant = (): Variant => {
    // This would normally be determined by screen size
    // For now, we'll render all variants and let CSS handle responsiveness
    return 'mobile'
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl transition hover:shadow-2xl overflow-hidden">
      {/* Single responsive container - CSS handles breakpoints */}
      <div className="note-card-responsive">
        <NoteCardShell
          note={enrichedNote}
          filters={filters}
          handlers={handlers}
          profileData={profileData}
          savedNotes={savedNotes}
          admin={admin}
          user={user}
          isNoteSaving={isNoteSaving}
          variant={getVariant()}
        />
      </div>
    </div>
  )
}

