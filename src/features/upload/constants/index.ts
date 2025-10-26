export const MAX_FILE_SIZE_MB = 25
export const MAX_SUGGESTIONS = 8
export const FORM_DRAFT_KEY = 'uolink-upload-draft-v1'

export const MATERIAL_TYPE_OPTIONS = [
    { value: 'assignment', label: 'Assignment' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'lecture', label: 'Lecture' },
    { value: 'slides', label: 'Slides' },
    { value: 'midterm-notes', label: 'Midterm Notes' },
    { value: 'final-term-notes', label: 'Final Term Notes' },
    { value: 'books', label: 'Books' },
] as const

export const SEQUENCE_OPTIONS = ['1', '2', '3', '4'] as const

export const MATERIAL_TYPE_OPTION_LABELS = [
    'Select Material Type',
    ...MATERIAL_TYPE_OPTIONS.map((option) => option.label)
] as const