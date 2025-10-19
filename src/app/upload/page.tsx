'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera } from 'lucide-react'

import Navbar from '@/components/Navbar'
import CustomSelect from '@/components/CustomSelect'
import { ScannerModal } from '@/components/scanner/ScannerModal'
import { useAuth } from '@/contexts/AuthContext'
import { getUserProfile } from '@/lib/firebase'

interface UploadStatus {
  type: 'success' | 'error'
  message: string
  details?: string
}

const MAX_FILE_SIZE_MB = 25
const FORM_DRAFT_KEY = 'uolink-upload-draft-v1'

export default function UploadPage() {
  const { user, loading } = useAuth()

  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('')
  const [teacher, setTeacher] = useState('')
  const [materialType, setMaterialType] = useState('')
  const [materialSequence, setMaterialSequence] = useState('')
  const [profileData, setProfileData] = useState({
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
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const hasHydratedDraft = useRef(false)
  const hasAppliedProfileData = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleScannerComplete = (scannedFile: File) => {
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
    setIsScannerOpen(false)
  }

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
        hasAppliedProfileData.current = false
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

        const profileRecord = (profile ?? {}) as Record<string, unknown>
        const profileMajor = typeof profileRecord?.major === 'string' ? profileRecord.major : ''
        const profileSemesterRaw = profileRecord?.semester
        const profileSection = typeof profileRecord?.section === 'string' ? profileRecord.section : ''

        let detectedSemester = ''
        if (typeof profileSemesterRaw === 'string') {
          detectedSemester = profileSemesterRaw.includes('Semester')
            ? profileSemesterRaw.replace('Semester ', '').trim()
            : profileSemesterRaw
        } else if (typeof profileSemesterRaw === 'number' && Number.isFinite(profileSemesterRaw)) {
          detectedSemester = String(profileSemesterRaw)
        }

        const newProfileData = {
          fullName,
          major: profileMajor,
          semester: detectedSemester,
          section: profileSection
        }

        setProfileData(newProfileData)
        setProfileStatus('idle')
        hasAppliedProfileData.current = true
      } catch (error) {
        console.error('[UploadPage] Failed to fetch profile', error)
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
  const contributorStatusMessage = useMemo(() => {
    if (profileStatus === 'loading') {
      return 'Loading profile...'
    }
    if (profileStatus === 'error') {
      return 'Profile unavailable'
    }
    if (!profileData.fullName) {
      return 'Update your profile to show your name'
    }
    return 'Linked with your profile name'
  }, [profileStatus, profileData.fullName])
  const contributorStatusTone =
    profileStatus === 'error'
      ? 'text-rose-600'
      : profileStatus === 'loading'
      ? 'text-amber-600'
      : 'text-emerald-600'

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    try {
      const stored = window.localStorage.getItem(FORM_DRAFT_KEY)
      if (!stored) {
        hasHydratedDraft.current = true
        return
      }

      const draft = JSON.parse(stored) as Partial<Record<'title' | 'subject' | 'teacher', string>>
      if (draft.title) {
        setTitle(draft.title)
      }
      if (draft.subject) {
        setSubject(draft.subject)
      }
      if (draft.teacher) {
        setTeacher(draft.teacher)
      } else if ((draft as Record<string, string | undefined>).module) {
        setTeacher((draft as Record<string, string | undefined>).module!)
      }
    } catch (error) {
      console.warn('[UploadPage] Failed to restore draft', error)
    } finally {
      hasHydratedDraft.current = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !hasHydratedDraft.current) {
      return
    }

    try {
      window.localStorage.setItem(
        FORM_DRAFT_KEY,
        JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          teacher: teacher.trim(),
        })
      )
    } catch (error) {
      console.warn('[UploadPage] Failed to persist draft', error)
    }
  }, [title, subject, teacher])

  const resetForm = () => {
    setTitle('')
    setSubject('')
    setTeacher('')
    setMaterialType('')
    setMaterialSequence('')
    setFile(null)
    setFileSource(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(FORM_DRAFT_KEY)
      } catch (error) {
        console.warn('[UploadPage] Unable to clear draft from localStorage', error)
      }
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
    setIsScannerOpen(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      formData.append('subject', subject.trim())
      formData.append('teacher', teacher.trim())
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
      resetForm()
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

  return (
    <>
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onComplete={handleScannerComplete}
      />
      <Navbar />
      <div className="container md:mt-24 mt-20 mx-auto px-4 pb-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-3xl border border-gray-200 bg-white/70 p-4 shadow-xl backdrop-blur-sm sm:p-6">
            <header className="text-center sm:text-left">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Upload material</h1>
            </header>

            {status && (
              <div
                className={`mt-6 rounded-2xl border px-5 py-4 text-sm shadow-sm sm:text-base ${
                  status.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
                role={status.type === 'success' ? 'status' : 'alert'}
              >
                <p className="font-semibold">{status.message}</p>
                {status.details && <p className="mt-1 text-xs sm:text-sm">{status.details}</p>}
              </div>
            )}

            {!loading && !user && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-700 shadow-inner sm:text-base">
                You must{' '}
                <Link href="/auth" className="font-semibold underline">
                  sign in with your university email
                </Link>{' '}
                before uploading materials.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
              <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
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
                        onClick={() => setIsScannerOpen(true)}
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

              <section className="rounded-2xl border border-amber-200/70 bg-white p-4 shadow-sm sm:p-5">
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
                        onChange={(event) => setSubject(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Subject name"
                        required
                        maxLength={80}
                        disabled={isActionDisabled}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                        Teacher *
                      </label>
                      <input
                        type="text"
                        value={teacher}
                        onChange={(event) => setTeacher(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20 disabled:cursor-not-allowed disabled:opacity-60"
                        placeholder="Teacher name"
                        required
                        maxLength={80}
                        disabled={isActionDisabled}
                      />
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
                              // fallback slugify for unexpected casing
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

              
              <button
                type="submit"
                disabled={isActionDisabled}
                className="w-full rounded-2xl bg-[#1f1f1f] px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-black/30 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {submitting ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

