export interface Note {
  id: string
  name: string
  subject: string
  teacher?: string
  semester?: string
  section?: string
  materialType?: string
  materialSequence?: string | number
  fileUrl?: string
  contributorName?: string
  contributorDisplayName?: string
  uploaderUsername?: string | null
  uploadedBy?: string
  uploadedAt?: any // Firebase timestamp
  credibilityScore?: number
  upvoteCount?: number
  downvoteCount?: number
  saveCount?: number
  metadata?: {
    createdBy?: string
  }
}

export interface AuraDetails {
  aura: number
  tierName: string
  badgeClass: string
  borderClass: string
}

export interface ProfileData {
  // All records are now keyed by the contributor's userId (uploadedBy)
  profilePictures: Record<string, string | undefined>
  profileUsernames: Record<string, string | undefined>
  profileAura: Record<string, AuraDetails>
}

export interface FilterState {
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
}

export interface HandlerCallbacks {
  handleViewNote: (note: Note) => void
  handleSaveNote: (noteId: string) => void
  handleVoteScoreUpdate: (noteId: string, payload: any) => void
  handleReportUpdate: (noteId: string, reportCount: number, hasReported: boolean) => void
  handleDelete: (id: string, title: string, subject: string) => void
  handleShare?: (noteUrl: string, noteId: string, noteSubject: string, noteTeacher: string, noteContributorName: string) => void
}

export interface BadgeState {
  isSemesterActive: boolean
  isSectionActive: boolean
  isMaterialActive: boolean
  badgeBase: string
  badgeActive: string
}

export interface CredibilityData {
  credibilityScoreValue: number
  credibilityDisplayValue: string
  vibeBadge: {
    classes: string
    icon: 'flame' | 'skull' | null
  }
}

export interface DerivedNoteData {
  noteSection: string
  materialDisplay: string
  auraDetails?: AuraDetails
  auraBorderClass: string
  auraScoreLabel: string | null
  saveCount: number
}

export type Variant = 'mobile' | 'tablet' | 'desktop'

export interface VariantStyles {
  header: {
    titleSize: string
    layout: 'vertical' | 'horizontal'
  }
  metadata: {
    gap: string
    chipSize: string
  }
  layout: {
    direction: 'column' | 'row'
    previewPosition: 'inline' | 'side'
  }
}
