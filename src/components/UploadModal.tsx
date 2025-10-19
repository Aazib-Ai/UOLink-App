'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { X, Camera } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile } from '@/lib/firebase'
import CustomSelect from '@/components/CustomSelect'
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'

interface UploadStatus {
  type: 'success' | 'error'
  message: string
  details?: string
}

interface ProfileData {
  fullName: string
  major: string
  semester: string
  section: string
}

const MAX_FILE_SIZE_MB = 25
const MAX_SUGGESTIONS = 8

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildSuggestions = (
  query: string,
  entries: Array<{ original: string; normalized: string }>
) => {
  const trimmed = query.trim()
  if (!trimmed) return []

  const normalizedQuery = normalizeValue(trimmed)
  if (!normalizedQuery) return []

  const startsWithMatches = entries.filter((entry) =>
    entry.normalized.startsWith(normalizedQuery)
  )
  const containsMatches = entries.filter(
    (entry) =>
      entry.normalized.includes(normalizedQuery) &&
      !entry.normalized.startsWith(normalizedQuery)
  )

  const combined = [...startsWithMatches, ...containsMatches]
  const seen = new Set<string>()
  const results: string[] = []

  for (const entry of combined) {
    if (!seen.has(entry.original)) {
      seen.add(entry.original)
      results.push(entry.original)
    }

    if (results.length >= MAX_SUGGESTIONS) {
      break
    }
  }

  return results
}

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onScanRequest?: () => void
  scannedFile?: File | null
}

export default function UploadModal({ isOpen, onClose, onScanRequest, scannedFile }: UploadModalProps) {
  const { user, loading } = useAuth()

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [teacher, setTeacher] = useState('')
  const [materialType, setMaterialType] = useState('')
  const [materialSequence, setMaterialSequence] = useState('')
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    major: '',
    semester: '',
    section: ''
  })
  const [profileStatus, setProfileStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [fileSource, setFileSource] = useState<'manual' | 'scanner' | null>(null)
  const [status, setStatus] = useState<UploadStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [teacherWarning, setTeacherWarning] = useState<string | null>(null)
  const [teacherOverrideConfirmed, setTeacherOverrideConfirmed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const materialTypeOptions = useMemo(
    () => [
      { value: 'assignment', label: 'Assignment' },
      { value: 'quiz', label: 'Quiz' },
      { value: 'lecture', label: 'Lecture' },
      { value: 'slides', label: 'Slides' },
      { value: 'midterm-notes', label: 'Midterm Notes' },
      { value: 'final-term-notes', label: 'Final Term Notes' },
      { value: 'books', label: 'Books' },
    ],
    []
  )
  const sequenceOptions = useMemo(() => ['1', '2', '3', '4'], [])
  const showSequenceDropdown = useMemo(
    () => ['assignment', 'quiz'].includes(materialType),
    [materialType]
  )
  const materialTypeLabel = useMemo(() => {
    const match = materialTypeOptions.find((option) => option.value === materialType)
    return match?.label ?? ''
  }, [materialType, materialTypeOptions])
  const materialTypeOptionLabels = useMemo(
    () => ['Select Material Type', ...materialTypeOptions.map((option) => option.label)],
    [materialTypeOptions]
  )
  const materialSequencePlaceholder =
    materialType === 'assignment'
      ? 'Assignment Number'
      : materialType === 'quiz'
      ? 'Quiz Number'
      : 'Select Number'
  const isActionDisabled = !user || submitting || profileStatus === 'loading'
  const subjectEntries = useMemo(
    () => SUBJECT_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )
  const subjectLookup = useMemo(() => {
    const map = new Map<string, string>()
    subjectEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [subjectEntries])
  const subjectSuggestions = useMemo(
    () => buildSuggestions(subject, subjectEntries),
    [subject, subjectEntries]
  )
  const teacherEntries = useMemo(
    () => TEACHER_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )
  const teacherLookup = useMemo(() => {
    const map = new Map<string, string>()
    teacherEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [teacherEntries])
  const teacherSuggestions = useMemo(
    () => buildSuggestions(teacher, teacherEntries),
    [teacher, teacherEntries]
  )

  const handleOpenScanner = () => {
    if (onScanRequest) {
      onScanRequest()
    }
    // Temporarily close the UploadModal to avoid interference
    onClose()
  }

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
        console.error('[UploadModal] Failed to fetch profile', error)
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

  const resetForm = () => {
    setTitle('')
    setSubject('')
    setTeacher('')
    setMaterialType('')
    setMaterialSequence('')
    setFile(null)
    setFileSource(null)
    setStatus(null)
    setSubjectError(null)
    setTeacherWarning(null)
    setTeacherOverrideConfirmed(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStatus(null)

    if (!event.target.files?.length) {
      setFile(null)
      setFileSource(null)
      return
    }
    const selectedFile = event.target.files[0]
    const sizeInMb = selectedFile.size / (1024 * 1024)

    if (sizeInMb > MAX_FILE_SIZE_MB) {
      setStatus({
        type: 'error',
        message: `File is too large (${sizeInMb.toFixed(1)} MB).`,
        details: `Please upload a PDF smaller than ${MAX_FILE_SIZE_MB} MB.`,
      })
      event.target.value = ''
      setFile(null)
      setFileSource(null)
      return
    }

    if (selectedFile.type !== 'application/pdf') {
      setStatus({
        type: 'error',
        message: 'Only PDF files are supported.',
        details: 'Export your document as a PDF before uploading.',
      })
      event.target.value = ''
      setFile(null)
      setFileSource(null)
      return
    }

    setFile(selectedFile)
    setFileSource('manual')
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

    if (!subject.trim()) {
      setSubjectError('Pick a subject from the list before uploading.')
      return
    }

    const normalizedSubject = normalizeValue(subject)
    const canonicalSubject = subjectLookup.get(normalizedSubject)
    if (!canonicalSubject) {
      setSubjectError('Please choose a subject from the matching list.')
      return
    }

    if (subject !== canonicalSubject) {
      setSubject(canonicalSubject)
    }
    setSubjectError(null)
    const subjectToSubmit = canonicalSubject

    if (!teacher.trim()) {
      setTeacherWarning('Add the teacher name or pick one from the suggestions before uploading.')
      return
    }

    let teacherToSubmit = teacher.trim()
    const normalizedTeacher = normalizeValue(teacher)
    const canonicalTeacher = teacherLookup.get(normalizedTeacher)
    if (canonicalTeacher) {
      teacherToSubmit = canonicalTeacher
      if (teacher !== canonicalTeacher) {
        setTeacher(canonicalTeacher)
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

    if (!file) {
      setStatus({
        type: 'error',
        message: 'Select a PDF file before submitting.',
      })
      return
    }

    if (!materialType) {
      setStatus({
        type: 'error',
        message: 'Pick the material type from the dropdown.',
      })
      return
    }

    const requiresSequence = ['assignment', 'quiz'].includes(materialType.toLowerCase())
    if (requiresSequence && !materialSequence) {
      setStatus({
        type: 'error',
        message: `Select the ${materialType.toLowerCase()} number.`,
      })
      return
    }

    try {
      setSubmitting(true)
      const token = await user.getIdToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', title.trim())
      formData.append('subject', subjectToSubmit)
      formData.append('teacher', teacherToSubmit)
      formData.append('semester', profileData.semester.trim())
      formData.append('section', profileData.section.trim())
      formData.append('materialType', materialType.trim())
      formData.append('contributorName', profileData.fullName.trim())
      formData.append('contributorMajor', profileData.major.trim())
      if (materialSequence.trim()) {
        formData.append('materialSequence', materialSequence.trim())
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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

      // Reset form after successful upload
      setTimeout(() => {
        resetForm()
        onClose()
      }, 2000)

    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : 'Upload failed due to an unexpected error.'
      setStatus({
        type: 'error',
        message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Handle scanned file from parent
  useEffect(() => {
    if (scannedFile) {
      setFile(scannedFile)
      setFileSource('scanner')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setStatus({
        type: 'success',
        message: 'Scanned PDF ready to upload.',
        details: scannedFile.name,
      })
    }
  }, [scannedFile])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Upload material</h1>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-amber-50 transition-colors group"
          >
            <X className="w-5 h-5 text-gray-500 group-hover:text-[#90c639] transition-colors" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-6">
          {!loading && !user && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-700 shadow-inner">
              You must{' '}
              <a href="/auth" className="font-semibold underline">
                sign in with your university email
              </a>{' '}
              before uploading materials.
            </div>
          )}

          {status && (
            <div
              className={`mb-6 rounded-2xl border px-5 py-4 text-sm shadow-sm ${
                status.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
              role={status.type === 'success' ? 'status' : 'alert'}
            >
              <p className="font-semibold">{status.message}</p>
              {status.details && <p className="mt-1 text-xs">{status.details}</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PDF File Upload */}
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <header>
                <h2 className="text-base font-semibold text-gray-900">PDF file *</h2>
              </header>
              <div className="mt-4">
                <div className="space-y-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="material-file" className="text-sm font-semibold text-gray-800">
                      Select a PDF or scan with your camera
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      disabled={isActionDisabled}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Camera className="h-4 w-4" />
                      Scan with camera
                    </button>
                  </div>
                  <input
                    id="material-file"
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="w-full cursor-pointer text-sm text-gray-700 file:mr-3 file:rounded-full file:border-0 file:bg-[#1f1f1f] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    required={!file}
                    disabled={isActionDisabled}
                  />
                  {file && (
                    <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                      <span className="text-xs font-bold text-[#90c639]">PDF</span>
                      <span className="truncate">{file.name}</span>
                      {fileSource === 'scanner' && (
                        <span className="ml-auto rounded-full bg-[#f4fbe8] px-2 py-0.5 text-[10px] font-semibold text-[#365316]">
                          Scanned with UOLink
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">
                    PDF only, max {MAX_FILE_SIZE_MB}MB. Scans are optimized automatically for clarity.
                  </p>
                </div>
              </div>
            </section>

            {/* Material Info */}
            <section className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm">
              <header>
                <h2 className="text-base font-semibold text-gray-900">Material info</h2>
              </header>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Material title"
                    required
                    maxLength={120}
                    disabled={isActionDisabled}
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Subject *
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(event) => {
                        setSubject(event.target.value)
                        if (subjectError) {
                          setSubjectError(null)
                        }
                      }}
                      onBlur={() => {
                        const normalized = normalizeValue(subject)
                        const canonical = subjectLookup.get(normalized)
                        if (canonical) {
                          setSubject(canonical)
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Subject name"
                      required
                      maxLength={80}
                      disabled={isActionDisabled}
                    />
                    {subjectError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{subjectError}</p>
                    )}
                    {subjectSuggestions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Matching subjects
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {subjectSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setSubject(suggestion)
                                setSubjectError(null)
                              }}
                              disabled={isActionDisabled}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#f0f9e8] disabled:opacity-60"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Teacher *
                    </label>
                    <input
                      type="text"
                      value={teacher}
                      onChange={(event) => {
                        setTeacher(event.target.value)
                        if (teacherWarning) {
                          setTeacherWarning(null)
                        }
                        if (teacherOverrideConfirmed) {
                          setTeacherOverrideConfirmed(false)
                        }
                      }}
                      onBlur={() => {
                        const normalized = normalizeValue(teacher)
                        const canonical = teacherLookup.get(normalized)
                        if (canonical) {
                          setTeacher(canonical)
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                      placeholder="Teacher name"
                      required
                      maxLength={80}
                      disabled={isActionDisabled}
                    />
                    {teacherSuggestions.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Matching teachers
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {teacherSuggestions.map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setTeacher(suggestion)
                                setTeacherWarning(null)
                                setTeacherOverrideConfirmed(false)
                              }}
                              disabled={isActionDisabled}
                              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#f0f9e8] disabled:opacity-60"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {teacherWarning && (
                      <p className="mt-2 text-xs font-semibold text-amber-600">{teacherWarning}</p>
                    )}
                  </div>
                <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Type *
                    </label>
                    <div className="mt-2 relative">
                      <CustomSelect
                        options={materialTypeOptionLabels}
                        placeholder="Select Material Type"
                        value={materialTypeLabel || undefined}
                        onChange={(selectedOption) => {
                          if (selectedOption === 'Select Material Type') {
                            setMaterialType('')
                            setMaterialSequence('')
                            return
                          }
                          const match = materialTypeOptions.find((option) => option.label === selectedOption)
                          if (match) {
                            setMaterialType(match.value)
                            if (!['assignment', 'quiz'].includes(match.value)) {
                              setMaterialSequence('')
                            }
                          } else {
                            const normalized = selectedOption.trim().toLowerCase().replace(/\s+/g, '-')
                            setMaterialType(normalized)
                            if (!['assignment', 'quiz'].includes(normalized)) {
                              setMaterialSequence('')
                            }
                          }
                        }}
                        disabled={isActionDisabled}
                        className="!border-amber-200 !bg-white focus:!border-[#90c639] focus:!ring-2 focus:!ring-[#90c639]/20"
                      />
                      {materialType && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-[#90c639] animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {showSequenceDropdown && (
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Number *
                    </label>
                    <div className="mt-2 relative">
                      <CustomSelect
                        options={sequenceOptions}
                        placeholder={materialSequencePlaceholder}
                        value={materialSequence || undefined}
                        onChange={(selectedOption) => {
                          setMaterialSequence(selectedOption)
                        }}
                        disabled={isActionDisabled}
                        className="!border-amber-200 !bg-white focus:!border-[#90c639] focus:!ring-2 focus:!ring-[#90c639]/20"
                      />
                      {materialSequence && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-[#90c639] animate-pulse"></div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isActionDisabled}
              className="w-full rounded-2xl bg-[#90c639] px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-[#7ab332] focus:outline-none focus:ring-2 focus:ring-[#90c639]/30 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
