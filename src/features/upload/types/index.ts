export interface UploadStatus {
    type: 'success' | 'error'
    message: string
    details?: string
    action?: {
        label: string
        href: string
    }
}

export interface ProfileData {
    fullName: string
    major: string
    semester: string
    section: string
}

export interface UploadFormData {
    title: string
    subject: string
    teacher: string
    materialType: string
    materialSequence: string
    file: File | null
    fileSource: 'manual' | 'scanner' | null
}

export interface UploadFormProps {
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
    isActionDisabled: boolean
    status: UploadStatus | null
    formData: UploadFormData
    onFormDataChange: (updates: Partial<UploadFormData>) => void
    profileData: ProfileData
    profileStatus: 'idle' | 'loading' | 'error'
    submitting: boolean
    onScanRequest?: () => void
    fileInputRef: React.RefObject<HTMLInputElement>
    subjectError: string | null
    teacherWarning: string | null
    onSubjectErrorChange: (error: string | null) => void
    onTeacherWarningChange: (warning: string | null) => void
    teacherOverrideConfirmed: boolean
    onTeacherOverrideConfirmedChange: (confirmed: boolean) => void
}

export interface UploadStatusBannerProps {
    status: UploadStatus | null
}