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
import { 
  generateBaseUsername, 
  generateUsernameWithConflicts 
} from '@/lib/username/generation'
import { 
  checkAvailability, 
  reserveUsername 
} from '@/lib/firebase/username-service'
import { generateProfileUrl } from '@/lib/firebase/profile-resolver'

interface ProfileData {
  fullName: string
  major: string
  semester: string
  section: string
  profilePicture: string | null
  generatedUsername?: string
  profileUrl?: string
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
    profilePicture: null,
    generatedUsername: undefined,
    profileUrl: undefined
  })

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [isGeneratingUsername, setIsGeneratingUsername] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) {
      return
    }

    if (!user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  // Generate username when full name changes
  useEffect(() => {
    const generateUsernamePreview = async () => {
      if (!profileData.fullName.trim()) {
        setProfileData(prev => ({ 
          ...prev, 
          generatedUsername: undefined, 
          profileUrl: undefined 
        }))
        return
      }

      setIsGeneratingUsername(true)
      
      try {
        // Generate base username from full name
        const baseUsername = generateBaseUsername(profileData.fullName.trim())
        
        // Check if it's available
        const isAvailable = await checkAvailability(baseUsername)
        
        let finalUsername = baseUsername
        if (!isAvailable) {
          // Generate with conflict resolution (this is just for preview)
          finalUsername = `${baseUsername}-${Math.floor(Math.random() * 100)}`
        }
        
        const profileUrl = generateProfileUrl(finalUsername)
        
        setProfileData(prev => ({ 
          ...prev, 
          generatedUsername: finalUsername,
          profileUrl: profileUrl || undefined
        }))
      } catch (error) {
        console.error('Error generating username preview:', error)
        // Don't show error to user for preview generation
      } finally {
        setIsGeneratingUsername(false)
      }
    }

    // Debounce username generation
    const timeoutId = setTimeout(generateUsernamePreview, 500)
    return () => clearTimeout(timeoutId)
  }, [profileData.fullName])

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

      // Generate and reserve username atomically
      const baseUsername = generateBaseUsername(profileData.fullName.trim())
      let finalUsername = baseUsername
      
      // Check availability and generate with conflicts if needed
      const isAvailable = await checkAvailability(baseUsername)
      if (!isAvailable) {
        // Use a more sophisticated conflict resolution
        const existingUsernames = new Set<string>() // In real implementation, this would be populated
        finalUsername = generateUsernameWithConflicts(
          profileData.fullName.trim(),
          existingUsernames
        )
      }

      // Reserve the username atomically
      await reserveUsername(user.uid, finalUsername)

      // Create the profile with username
      const profileRef = doc(db, 'profiles', user.uid)
      const timestamp = serverTimestamp()
      await setDoc(
        profileRef,
        {
          fullName: profileData.fullName.trim(),
          username: finalUsername,
          major: profileData.major,
          semester: profileData.semester,
          section: profileData.section,
          profilePicture: profileData.profilePicture,
          profileCompleted: true,
          completedAt: timestamp,
          updatedAt: timestamp,
          usernameLastChanged: timestamp,
          email: user.email ?? null,
          // Keep legacy fields for backward compatibility during migration
          fullNameLower: profileData.fullName.trim().toLowerCase(),
          profileSlug: slugify(profileData.fullName.trim()),
        },
        { merge: true }
      )

      // Update profile data with final username for display
      setProfileData(prev => ({ 
        ...prev, 
        generatedUsername: finalUsername,
        profileUrl: generateProfileUrl(finalUsername) || undefined
      }))

      // Show success animation
      setShowSuccessAnimation(true)

      // Redirect to profile edit page after delay
      redirectTimeoutRef.current = setTimeout(() => {
        router.push('/profile-edit')
      }, 2000)

    } catch (err) {
      console.error('Profile creation error:', err)
      if (err instanceof Error && err.message.includes('Username is already taken')) {
        setError('The generated username is no longer available. Please try again.')
      } else {
        setError('Failed to save profile. Please try again.')
      }
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
                <p className="font-semibold">Profile completed successfully! Redirecting to profile edit...</p>
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

              {/* Generated Profile URL Preview */}
              {profileData.fullName.trim() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-sm font-semibold">🔗</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-blue-900 mb-1">
                        Your Profile URL
                      </h4>
                      {isGeneratingUsername ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                          <span className="text-sm text-blue-700">Generating...</span>
                        </div>
                      ) : profileData.profileUrl ? (
                        <div>
                          <p className="text-sm text-blue-800 font-mono bg-white px-2 py-1 rounded border break-all">
                            uolink.com{profileData.profileUrl}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            This will be your unique profile link that others can use to find you.
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-700">Enter your name to see your profile URL</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                  onClick={() => router.push('/profile-edit')}
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
