export interface UserNote {
  id: string
  name: string
  subject: string
  teacher: string
  semester: string
  contributorName: string
  contributorDisplayName?: string
  uploaderUsername?: string | null
  fileUrl: string
  fileSize?: number
  uploadedAt: string
  updatedAt?: string
  module?: string
  section?: string
  materialType?: string
  materialSequence?: string | null
  contributorMajor?: string
  storageProvider?: string
  storageBucket?: string
  storageKey?: string
  contentType?: string
  originalFileName?: string
  [key: string]: any
}

export interface ActivityStats {
  totalContributions: number
  uniqueSubjects: number
  totalViews: number
  lastActiveDate: string
}

export interface NoteActionState {
  id: string
  type: 'save' | 'delete'
}

export interface SubjectOption {
  key: string
  label: string
}

export interface NoteValidationError {
  field: 'name' | 'subject' | 'teacher' | 'semester'
  message: string
}

export interface NoteEditState {
  id: string | null
  draft: {
    name: string
    subject: string
    teacher: string
    semester: string
  }
  errors: {
    name: string | null
    subject: string | null
    teacher: string | null
    semester: string | null
    general: string | null
  }
  warnings: {
    teacher: string | null
  }
  isTeacherOverrideConfirmed: boolean
}
