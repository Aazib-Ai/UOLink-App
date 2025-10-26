'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile } from '@/lib/firebase'
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import {
    MAX_FILE_SIZE_MB,
    FORM_DRAFT_KEY,
    MATERIAL_TYPE_OPTIONS,
    SEQUENCE_OPTIONS
} from '../constants'
import {
    resolveUploadDescriptorByExtension,
    resolveUploadDescriptorByMime,
    getSupportedFileTypeSummary
} from '@/constants/uploadFileTypes'
import {
    normalizeValue,
    buildSuggestions,
    createSubjectEntries,
    createTeacherEntries,
    createLookupMap
} from '../utils'
import type { UploadStatus, ProfileData, UploadFormData } from '../types'

export function useUploadForm(enableDraftPersistence = false) {
    const { user, loading } = useAuth()

    // Form state
    const [formData, setFormData] = useState<UploadFormData>({
        title: '',
        subject: '',
        teacher: '',
        materialType: '',
        materialSequence: '',
        file: null,
        fileSource: null
    })

    const [profileData, setProfileData] = useState<ProfileData>({
        fullName: '',
        major: '',
        semester: '',
        section: ''
    })

    const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'error'>('idle')
    const [status, setStatus] = useState<UploadStatus | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [subjectError, setSubjectError] = useState<string | null>(null)
    const [teacherWarning, setTeacherWarning] = useState<string | null>(null)
    const [teacherOverrideConfirmed, setTeacherOverrideConfirmed] = useState(false)

    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const hasHydratedDraft = useRef(false)

    // Computed values
    const materialTypeLabel = useMemo(() => {
        const match = MATERIAL_TYPE_OPTIONS.find((option) => option.value === formData.materialType)
        return match?.label ?? ''
    }, [formData.materialType])

    const showSequenceDropdown = useMemo(
        () => ['assignment', 'quiz'].includes(formData.materialType),
        [formData.materialType]
    )

    const materialSequencePlaceholder = useMemo(() => {
        if (formData.materialType === 'assignment') return 'Assignment Number'
        if (formData.materialType === 'quiz') return 'Quiz Number'
        return 'Select Number'
    }, [formData.materialType])

    const supportedFileSummary = useMemo(() => getSupportedFileTypeSummary(), [])

    const isActionDisabled = !user || submitting || profileStatus === 'loading'

    // Subject/Teacher suggestions
    const subjectEntries = useMemo(() => createSubjectEntries(), [])
    const subjectLookup = useMemo(() => createLookupMap(subjectEntries), [subjectEntries])
    const subjectSuggestions = useMemo(
        () => buildSuggestions(formData.subject, subjectEntries),
        [formData.subject, subjectEntries]
    )

    const teacherEntries = useMemo(() => createTeacherEntries(), [])
    const teacherLookup = useMemo(() => createLookupMap(teacherEntries), [teacherEntries])
    const teacherSuggestions = useMemo(
        () => buildSuggestions(formData.teacher, teacherEntries),
        [formData.teacher, teacherEntries]
    )

    // Load profile data
    useEffect(() => {
        const resolveProfileData = async () => {
            if (!user?.uid) {
                setProfileData({
                    fullName: '',
                    major: '',
                    semester: '',
                    section: ''
                })
                setProfileStatus('idle')
                return
            }

            try {
                setProfileStatus('loading')
                const profile = await getUserProfile(user.uid)

                let fullName = ''
                if (profile?.fullName) {
                    fullName = profile.fullName
                } else if (user.displayName) {
                    fullName = user.displayName
                } else if (user.email) {
                    const [localPart] = user.email.split('@')
                    fullName = localPart
                }

                const record = (profile ?? {}) as Record<string, unknown>

                const profileSemester = record.semester
                let detectedSemester = ''
                if (typeof profileSemester === 'string') {
                    detectedSemester = profileSemester.includes('Semester')
                        ? profileSemester.replace('Semester ', '').trim()
                        : profileSemester
                } else if (typeof profileSemester === 'number' && Number.isFinite(profileSemester)) {
                    detectedSemester = String(profileSemester)
                }

                const newProfileData: ProfileData = {
                    fullName,
                    major: typeof record.major === 'string' ? record.major : '',
                    semester: detectedSemester,
                    section: typeof record.section === 'string' ? record.section : ''
                }

                setProfileData(newProfileData)
                setProfileStatus('idle')
            } catch (error) {
                console.error('[useUploadForm] Failed to fetch profile', error)
                setProfileStatus('error')
                let fallbackName = ''
                if (user?.displayName) {
                    fallbackName = user.displayName
                } else if (user?.email) {
                    const [localPart] = user.email.split('@')
                    fallbackName = localPart
                }

                setProfileData({
                    fullName: fallbackName,
                    major: '',
                    semester: '',
                    section: ''
                })
            }
        }

        resolveProfileData()
    }, [user?.uid, user?.displayName, user?.email])

    // Draft persistence (only for page, not modal)
    useEffect(() => {
        if (!enableDraftPersistence || typeof window === 'undefined') {
            hasHydratedDraft.current = true
            return
        }

        try {
            const stored = window.localStorage.getItem(FORM_DRAFT_KEY)
            if (!stored) {
                hasHydratedDraft.current = true
                return
            }

            const draft = JSON.parse(stored) as Partial<Record<'title' | 'subject' | 'teacher', string>>
            setFormData(prev => ({
                ...prev,
                title: draft.title || prev.title,
                subject: draft.subject || prev.subject,
                teacher: draft.teacher || (draft as any).module || prev.teacher
            }))
        } catch (error) {
            console.warn('[useUploadForm] Failed to restore draft', error)
        } finally {
            hasHydratedDraft.current = true
        }
    }, [enableDraftPersistence])

    useEffect(() => {
        if (!enableDraftPersistence || typeof window === 'undefined' || !hasHydratedDraft.current) {
            return
        }

        try {
            window.localStorage.setItem(
                FORM_DRAFT_KEY,
                JSON.stringify({
                    title: formData.title.trim(),
                    subject: formData.subject.trim(),
                    teacher: formData.teacher.trim(),
                })
            )
        } catch (error) {
            console.warn('[useUploadForm] Failed to persist draft', error)
        }
    }, [enableDraftPersistence, formData.title, formData.subject, formData.teacher])

    // Handlers
    const updateFormData = (updates: Partial<UploadFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }))
    }

    const resetForm = () => {
        setFormData({
            title: '',
            subject: '',
            teacher: '',
            materialType: '',
            materialSequence: '',
            file: null,
            fileSource: null
        })
        setStatus(null)
        setSubjectError(null)
        setTeacherWarning(null)
        setTeacherOverrideConfirmed(false)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        if (enableDraftPersistence && typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem(FORM_DRAFT_KEY)
            } catch (error) {
                console.warn('[useUploadForm] Unable to clear draft from localStorage', error)
            }
        }
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setStatus(null)

        if (!event.target.files?.length) {
            updateFormData({ file: null, fileSource: null })
            return
        }

        const selectedFile = event.target.files[0]
        const sizeInMb = selectedFile.size / (1024 * 1024)

        if (sizeInMb > MAX_FILE_SIZE_MB) {
            setStatus({
                type: 'error',
                message: `File is too large (${sizeInMb.toFixed(1)} MB).`,
                details: `Please upload a file smaller than ${MAX_FILE_SIZE_MB} MB.`,
            })
            event.target.value = ''
            updateFormData({ file: null, fileSource: null })
            return
        }

        const normalizedName = (selectedFile.name || '').trim()
        const extension =
            normalizedName && normalizedName.includes('.')
                ? (normalizedName.split('.').pop() ?? '').toLowerCase()
                : ''
        const descriptorByMime = selectedFile.type
            ? resolveUploadDescriptorByMime(selectedFile.type)
            : undefined
        const descriptorByExtension = extension
            ? resolveUploadDescriptorByExtension(extension)
            : undefined

        if (!descriptorByMime && !descriptorByExtension) {
            const summary = supportedFileSummary || 'supported document'
            setStatus({
                type: 'error',
                message: 'Unsupported file type.',
                details: `Please upload one of the supported formats: ${summary}.`,
            })
            event.target.value = ''
            updateFormData({ file: null, fileSource: null })
            return
        }

        updateFormData({ file: selectedFile, fileSource: 'manual' })
    }

    const handleScannedFile = (scannedFile: File) => {
        console.log('[useUploadForm] Handling scanned file:', {
            name: scannedFile.name,
            size: scannedFile.size,
            type: scannedFile.type
        })

        updateFormData({ file: scannedFile, fileSource: 'scanner' })
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        setStatus({
            type: 'success',
            message: 'Scanned document ready to upload.',
            details: `${scannedFile.name} (${(scannedFile.size / (1024 * 1024)).toFixed(1)} MB)`,
        })
    }

    const handleSubjectChange = (value: string) => {
        updateFormData({ subject: value })
        if (subjectError) {
            setSubjectError(null)
        }
    }

    const handleSubjectBlur = () => {
        const normalized = normalizeValue(formData.subject)
        const canonical = subjectLookup.get(normalized)
        if (canonical) {
            updateFormData({ subject: canonical })
        }
    }

    const handleTeacherChange = (value: string) => {
        updateFormData({ teacher: value })
        if (teacherWarning) {
            setTeacherWarning(null)
        }
        if (teacherOverrideConfirmed) {
            setTeacherOverrideConfirmed(false)
        }
    }

    const handleTeacherBlur = () => {
        const normalized = normalizeValue(formData.teacher)
        const canonical = teacherLookup.get(normalized)
        if (canonical) {
            updateFormData({ teacher: canonical })
        }
    }

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setStatus(null)

        if (!user) {
            setStatus({
                type: 'error',
                message: 'Please sign in before uploading.',
            })
            return
        }

        if (profileStatus === 'loading') {
            setStatus({
                type: 'error',
                message: 'Please wait while we load your profile details.',
            })
            return
        }

        if (!profileData.fullName.trim()) {
            setStatus({
                type: 'error',
                message: 'Add your full name in the profile section before uploading.',
                details: 'Use the profile editor to update your full name so classmates can recognize your contributions.',
            })
            return
        }

        if (!formData.subject.trim()) {
            setSubjectError('Pick a subject from the list before uploading.')
            return
        }

        const normalizedSubject = normalizeValue(formData.subject)
        const canonicalSubject = subjectLookup.get(normalizedSubject)
        if (!canonicalSubject) {
            setSubjectError('Please choose a subject from the matching list.')
            return
        }

        if (formData.subject !== canonicalSubject) {
            updateFormData({ subject: canonicalSubject })
        }
        setSubjectError(null)

        if (!formData.teacher.trim()) {
            setTeacherWarning('Add the teacher name or pick one from the suggestions before uploading.')
            return
        }

        let teacherToSubmit = formData.teacher.trim()
        const normalizedTeacher = normalizeValue(formData.teacher)
        const canonicalTeacher = teacherLookup.get(normalizedTeacher)
        if (canonicalTeacher) {
            teacherToSubmit = canonicalTeacher
            if (formData.teacher !== canonicalTeacher) {
                updateFormData({ teacher: canonicalTeacher })
            }
            if (teacherWarning) {
                setTeacherWarning(null)
            }
            if (teacherOverrideConfirmed) {
                setTeacherOverrideConfirmed(false)
            }
        } else if (!teacherOverrideConfirmed) {
            setTeacherWarning(
                'We could not find this teacher in our directory. Double-check the spelling or click Upload again to continue.'
            )
            setTeacherOverrideConfirmed(true)
            return
        }

        if (!formData.file) {
            setStatus({
                type: 'error',
                message: 'Select a document before submitting.',
            })
            return
        }

        if (!formData.materialType) {
            setStatus({
                type: 'error',
                message: 'Pick the material type from the dropdown.',
            })
            return
        }

        const requiresSequence = ['assignment', 'quiz'].includes(formData.materialType.toLowerCase())
        if (requiresSequence && !formData.materialSequence) {
            setStatus({
                type: 'error',
                message: `Select the ${formData.materialType.toLowerCase()} number.`,
            })
            return
        }

        try {
            setSubmitting(true)
            const token = await user.getIdToken()
            const formDataToSubmit = new FormData()
            formDataToSubmit.append('file', formData.file)
            formDataToSubmit.append('name', formData.title.trim())
            formDataToSubmit.append('subject', canonicalSubject)
            formDataToSubmit.append('teacher', teacherToSubmit)
            formDataToSubmit.append('semester', profileData.semester.trim())
            formDataToSubmit.append('section', profileData.section.trim())
            formDataToSubmit.append('materialType', formData.materialType.trim())
            formDataToSubmit.append('contributorName', profileData.fullName.trim())
            formDataToSubmit.append('contributorMajor', profileData.major.trim())
            if (formData.materialSequence.trim()) {
                formDataToSubmit.append('materialSequence', formData.materialSequence.trim())
            }

            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formDataToSubmit,
            })

            const payload = await response.json()

            if (!response.ok) {
                throw new Error(payload.error || 'Upload failed. Please try again.')
            }

            setStatus({
                type: 'success',
                message: 'Upload successful!',
                details: 'Your material is now available in the library.',
            })

            return true // Success
        } catch (uploadError) {
            const message =
                uploadError instanceof Error
                    ? uploadError.message
                    : 'Upload failed due to an unexpected error.'
            setStatus({
                type: 'error',
                message,
            })
            return false // Failure
        } finally {
            setSubmitting(false)
        }
    }

    return {
        // State
        formData,
        profileData,
        profileStatus,
        status,
        submitting,
        subjectError,
        teacherWarning,
        teacherOverrideConfirmed,
        loading,
        user,
        fileInputRef,

        // Computed
        materialTypeLabel,
        showSequenceDropdown,
        materialSequencePlaceholder,
        isActionDisabled,
        subjectSuggestions,
        teacherSuggestions,

        // Handlers
        updateFormData,
        resetForm,
        handleFileChange,
        handleScannedFile,
        handleSubjectChange,
        handleSubjectBlur,
        handleTeacherChange,
        handleTeacherBlur,
        handleSubmit,
        setStatus,
        setSubjectError,
        setTeacherWarning,
        setTeacherOverrideConfirmed,
    }
}
