'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import CustomSelect from './CustomSelect'
import Navbar from './Navbar'
import { db } from '@/lib/firebase'
import { slugify } from '@/lib/utils'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { MAJOR_NAMES } from '@/constants/universityData'

interface ProfileData {
  fullName: string
  major: string
  semester: string
  section: string
  profilePicture: string | null
}

const SEMESTER_OPTIONS = [
  'Semester 1',
  'Semester 2',
  'Semester 3',
  'Semester 4',
  'Semester 5',
  'Semester 6',
  'Semester 7',
  'Semester 8'
]

const SECTION_OPTIONS = ['A', 'B', 'C']

export default function CompleteProfile() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    major: '',
    semester: '',
    section: '',
    profilePicture: null
  })

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setPreviewImage(result)
        setProfileData(prev => ({ ...prev, profilePicture: result }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setPreviewImage(null)
    setProfileData(prev => ({ ...prev, profilePicture: null }))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateForm = (): boolean => {
    if (!profileData.fullName.trim()) {
      setError('Please enter your full name')
      return false
    }

    if (!profileData.major) {
      setError('Please select your major')
      return false
    }

    if (!profileData.semester) {
      setError('Please select your current semester')
      return false
    }

    if (!profileData.section) {
      setError('Please select your section')
      return false
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setShowSuccessAnimation(false)

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (!user?.uid) {
        setError('You must be signed in to save your profile.')
        return
      }

      const profileRef = doc(db, 'profiles', user.uid)
      const timestamp = serverTimestamp()
      await setDoc(
        profileRef,
        {
          fullName: profileData.fullName.trim(),
          fullNameLower: profileData.fullName.trim().toLowerCase(),
          profileSlug: slugify(profileData.fullName.trim()),
          major: profileData.major,
          semester: profileData.semester,
          section: profileData.section,
          profilePicture: profileData.profilePicture,
          profileCompleted: true,
          completedAt: timestamp,
          updatedAt: timestamp,
          email: user.email ?? null,
        },
        { merge: true }
      )

      // Show success animation
      setShowSuccessAnimation(true)

      // Redirect to dashboard after delay
      redirectTimeoutRef.current = setTimeout(() => {
        router.push('/')
      }, 2000)

    } catch (err) {
      setError('Failed to save profile. Please try again.')
      setShowSuccessAnimation(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-yellow-50 pt-28 md:pt-36 flex items-center justify-center">
          <div className="rounded-xl bg-white/80 px-6 py-4 text-sm font-semibold text-gray-600 shadow">
            Preparing your profile setup...
          </div>
        </div>
      </>
    )
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-yellow-50 pt-28 md:pt-36 pb-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-amber-100">
            {/* Welcome Message */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-3">
                Welcome to UOLink! Let's set up your profile.
              </h1>
              <p className="text-gray-600 text-sm md:text-base">
                This information will be displayed on your profile and helps make your contributions more valuable to other students.
              </p>
            </div>

            {/* Success Animation */}
            {showSuccessAnimation && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 text-center animate-pulse" role="status" aria-live="polite">
                <p className="font-semibold">Profile completed successfully! Redirecting to dashboard...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Profile Picture Upload */}
              <div className="flex flex-col items-center">
                <label className="text-sm font-semibold text-gray-700 mb-4">Profile Picture (Optional)</label>
                <div className="relative">
                  <div
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-amber-50 border-2 border-dashed border-amber-300 flex items-center justify-center cursor-pointer hover:bg-amber-100 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-amber-200/70"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        fileInputRef.current?.click()
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload profile picture"
                  >
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Profile preview"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="text-center">
                        <Camera className="w-8 h-8 md:w-10 md:h-10 text-amber-600 mx-auto mb-2" />
                        <span className="text-xs text-amber-600 font-medium">Add Photo</span>
                      </div>
                    )}
                  </div>

                  {previewImage && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      aria-label="Remove profile picture"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  aria-describedby="profile-picture-help"
                />

                <p id="profile-picture-help" className="text-xs text-gray-500 mt-2">Click to upload - JPG or PNG up to 5MB</p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                  placeholder="e.g., Aazib Bodla"
                  required
                />
              </div>

              {/* Major Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Your Major
                </label>
                <CustomSelect
                  options={['Select Major', ...MAJOR_NAMES]}
                  placeholder="Select Major"
                  value={profileData.major}
                  onChange={(selectedOption) => {
                    if (selectedOption === 'Select Major') {
                      setProfileData(prev => ({ ...prev, major: '' }))
                    } else {
                      setProfileData(prev => ({ ...prev, major: selectedOption }))
                    }
                  }}
                />
              </div>

              {/* Semester and Section Row */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Semester Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Your Current Semester
                  </label>
                  <CustomSelect
                    options={['Select Semester', ...SEMESTER_OPTIONS]}
                    placeholder="Select Semester"
                    value={profileData.semester}
                    onChange={(selectedOption) => {
                      if (selectedOption === 'Select Semester') {
                        setProfileData(prev => ({ ...prev, semester: '' }))
                      } else {
                        setProfileData(prev => ({ ...prev, semester: selectedOption }))
                      }
                    }}
                  />
                </div>

                {/* Section Dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Section
                  </label>
                  <CustomSelect
                    options={['Select Section', ...SECTION_OPTIONS]}
                    placeholder="Select Section"
                    value={profileData.section}
                    onChange={(selectedOption) => {
                      if (selectedOption === 'Select Section') {
                        setProfileData(prev => ({ ...prev, section: '' }))
                      } else {
                        setProfileData(prev => ({ ...prev, section: selectedOption }))
                      }
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[#90c639] px-6 py-3 font-semibold text-white transition-all hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting ? 'Saving Profile...' : 'Complete Profile'}
              </button>

              {/* Skip for now link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
