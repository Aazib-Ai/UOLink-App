'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  X,
  Plus,
  Github,
  Linkedin,
  Instagram,
  Facebook,
  User,
  CheckCircle,
  Save,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import CustomSelect from './CustomSelect'
import Navbar from './Navbar'
import ContributionHub from './ContributionHub'
import { db } from '@/lib/firebase'
import { slugify } from '@/lib/utils'
import {
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import { MAJOR_NAMES } from '@/constants/universityData'

interface ProfileData {
  fullName: string
  major: string
  semester: string
  section: string
  bio: string
  about: string
  skills: string[]
  githubUrl: string
  linkedinUrl: string
  instagramUrl: string
  facebookUrl: string
  profilePicture: string | null
  profilePictureStorageKey?: string | null
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

const COMMON_SKILLS = [
  'Python', 'JavaScript', 'React', 'Node.js', 'TypeScript', 'Java', 'C++', 'C#',
  'HTML/CSS', 'SQL', 'MongoDB', 'Express.js', 'Vue.js', 'Angular', 'Django',
  'Flutter', 'Swift', 'Kotlin', 'Go', 'Rust', 'PHP', 'Ruby', 'MATLAB',
  'Machine Learning', 'Data Analysis', 'Web Development', 'Mobile Development',
  'Cloud Computing', 'DevOps', 'UI/UX Design', 'Git', 'Docker', 'AWS',
  'Google Cloud', 'Azure', 'TensorFlow', 'PyTorch', 'Deep Learning',
  'Blockchain', 'Game Development', 'AR/VR', 'IoT', 'Networking'
]

export default function ProfileEdit() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skillsInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    major: '',
    semester: '',
    section: '',
    bio: '',
    about: '',
    skills: [],
    githubUrl: '',
    linkedinUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    profilePicture: null,
    profilePictureStorageKey: null,
  })

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [newSkill, setNewSkill] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const githubInputRef = useRef<HTMLInputElement>(null)
  const linkedinInputRef = useRef<HTMLInputElement>(null)
  const instagramInputRef = useRef<HTMLInputElement>(null)
  const facebookInputRef = useRef<HTMLInputElement>(null)


  const pushSuccessMessage = (message: string) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }
    setSuccess(message)
    successTimeoutRef.current = setTimeout(() => {
      setSuccess(null)
      successTimeoutRef.current = null
    }, 3000)
  }

  
  const connectedLinks = [profileData.githubUrl, profileData.linkedinUrl, profileData.instagramUrl, profileData.facebookUrl].filter((url) => url && url.trim()).length
  const baseCompleted = [
    profileData.fullName.trim(),
    profileData.major,
    profileData.semester,
    profileData.section,
  ].filter(Boolean).length
  const extraCompleted = [
    profileData.bio.trim(),
    profileData.about.trim(),
    profileData.skills.length > 0 ? 'skills' : '',
    connectedLinks > 0 ? 'links' : '',
  ].filter(Boolean).length
  const completionScore = Math.min(100, Math.round(((baseCompleted + extraCompleted) / 8) * 100))
  const isProfileComplete = completionScore === 100

  // Load existing profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return

      setIsLoading(true)
      setError(null)
      
      try {
        const profileRef = doc(db, 'profiles', user.uid)
        const profileSnap = await getDoc(profileRef)

        if (profileSnap.exists()) {
          const data = profileSnap.data()
          console.log('Loading profile data:', data)
          
          const newProfileData: ProfileData = {
            fullName: data.fullName || '',
            major: data.major || '',
            semester: data.semester || '',
            section: data.section || '',
            bio: data.bio || '',
            about: data.about || '',
            skills: Array.isArray(data.skills) ? data.skills : [],
            githubUrl: data.githubUrl || '',
            linkedinUrl: data.linkedinUrl || '',
            instagramUrl: data.instagramUrl || '',
            facebookUrl: data.facebookUrl || '',
            profilePicture: data.profilePicture || null,
            profilePictureStorageKey: data.profilePictureStorageKey || null,
          }

          setProfileData(newProfileData)
          
          // Set preview image with logging
          if (data.profilePicture) {
            console.log('Setting preview image:', data.profilePicture)
            setPreviewImage(data.profilePicture)
          } else {
            console.log('No profile picture in data')
            setPreviewImage(null)
          }
        } else {
          console.log('No profile document found')
        }
      } catch (err) {
        console.error('Error loading profile:', err)
        setError('Failed to load profile data')
      } finally {
        setIsLoading(false)
      }
    }

    if (!loading && user?.uid) {
      loadProfile()
    }
  }, [user?.uid, loading])

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
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  // Focus newly added social input fields
  useEffect(() => {
    if (profileData.githubUrl === '') {
      githubInputRef.current?.focus()
    } else if (profileData.linkedinUrl === '') {
      linkedinInputRef.current?.focus()
    } else if (profileData.instagramUrl === '') {
      instagramInputRef.current?.focus()
    } else if (profileData.facebookUrl === '') {
      facebookInputRef.current?.focus()
    }
  }, [profileData.githubUrl, profileData.linkedinUrl, profileData.instagramUrl, profileData.facebookUrl])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB')
      return
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setError(null)
    setIsUploadingImage(true)

    try {
      // Show preview immediately
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviewImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to R2
      const formData = new FormData()
      formData.append('file', file)

      const token = await user?.getIdToken()
      const response = await fetch('/api/profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const { fileUrl, storageKey } = await response.json()
      
      // Delete old image if exists
      if (profileData.profilePictureStorageKey) {
        try {
          await fetch(`/api/profile-picture?key=${encodeURIComponent(profileData.profilePictureStorageKey)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        } catch (deleteError) {
          console.warn('Failed to delete old profile picture:', deleteError)
        }
      }

      // Update Firebase with the new profile picture URL
      const profileRef = doc(db, 'profiles', user.uid)
      
      // Check if profile document exists, create if not
      const profileSnap = await getDoc(profileRef)
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          fullName: profileData.fullName.trim(),
          fullNameLower: profileData.fullName.trim().toLowerCase(),
          profileSlug: slugify(profileData.fullName.trim()),
          major: profileData.major || '',
          semester: profileData.semester || '',
          section: profileData.section || '',
          bio: profileData.bio || '',
          about: profileData.about || '',
          skills: profileData.skills || [],
          githubUrl: profileData.githubUrl || '',
          linkedinUrl: profileData.linkedinUrl || '',
          instagramUrl: profileData.instagramUrl || '',
          facebookUrl: profileData.facebookUrl || '',
          profilePicture: fileUrl,
          profilePictureStorageKey: storageKey,
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      } else {
        await updateDoc(profileRef, {
          profilePicture: fileUrl,
          profilePictureStorageKey: storageKey,
          updatedAt: serverTimestamp()
        })
      }

      setProfileData(prev => ({ 
        ...prev, 
        profilePicture: fileUrl,
        profilePictureStorageKey: storageKey
      }))
      setPreviewImage(fileUrl)
      
      console.log('Profile picture saved to Firebase:', fileUrl)

    } catch (err) {
      console.error('Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload image')
      // Reset preview on error
      setPreviewImage(profileData.profilePicture)
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleRemoveImage = async () => {
    setIsDeletingImage(true)
    setError(null)
    
    try {
      // Delete from R2 if storage key exists
      if (profileData.profilePictureStorageKey) {
        const token = await user?.getIdToken()
        const response = await fetch(`/api/profile-picture?key=${encodeURIComponent(profileData.profilePictureStorageKey)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to remove image from storage')
        }
      }

      // Update Firestore to remove profile picture
      if (user?.uid) {
        const profileRef = doc(db, 'profiles', user.uid)
        await updateDoc(profileRef, {
          profilePicture: null,
          profilePictureStorageKey: null,
          updatedAt: serverTimestamp()
        })
      }

      // Clear local state
      setPreviewImage(null)
      setProfileData(prev => ({ ...prev, profilePicture: null, profilePictureStorageKey: null }))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

    } catch (err) {
      console.error('Remove error:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove image')
    } finally {
      setIsDeletingImage(false)
    }
  }

  const addSkill = () => {
    const trimmedSkill = newSkill.trim()
    if (trimmedSkill && !profileData.skills.includes(trimmedSkill)) {
      setProfileData(prev => ({
        ...prev,
        skills: [...prev.skills, trimmedSkill]
      }))
      setNewSkill('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setProfileData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  const handleSkillInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSkill()
    }
  }

  const addCommonSkill = (skill: string) => {
    if (!profileData.skills.includes(skill)) {
      setProfileData(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }))
    }
  }

  
  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return true // Optional field
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const processSocialUrl = (url: string, platform: string): string => {
    if (!url.trim()) return ''

    // If it's already a complete URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    // Otherwise, construct the URL based on platform
    switch (platform) {
      case 'github':
        return `https://github.com/${url.replace('@', '').replace('/', '')}`
      case 'linkedin':
        if (url.includes('linkedin.com/in/')) {
          return url.startsWith('http') ? url : `https://${url}`
        }
        return `https://linkedin.com/in/${url.replace('@', '').replace('/', '')}`
      case 'instagram':
        if (url.includes('instagram.com/')) {
          return url.startsWith('http') ? url : `https://${url}`
        }
        return `https://instagram.com/${url.replace('@', '').replace('/', '')}`
      case 'facebook':
        if (url.includes('facebook.com/')) {
          return url.startsWith('http') ? url : `https://${url}`
        }
        return `https://facebook.com/${url.replace('@', '').replace('/', '')}`
      default:
        return url.startsWith('http') ? url : `https://${url}`
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

    if (profileData.bio.length > 150) {
      setError('Bio should be 150 characters or less')
      return false
    }

    // Process and validate URLs
    const processedGithubUrl = processSocialUrl(profileData.githubUrl, 'github')
    const processedLinkedinUrl = processSocialUrl(profileData.linkedinUrl, 'linkedin')
    const processedInstagramUrl = processSocialUrl(profileData.instagramUrl, 'instagram')
    const processedFacebookUrl = processSocialUrl(profileData.facebookUrl, 'facebook')

    if (processedGithubUrl && !validateUrl(processedGithubUrl)) {
      setError('Please enter a valid GitHub URL')
      return false
    }

    if (processedLinkedinUrl && !validateUrl(processedLinkedinUrl)) {
      setError('Please enter a valid LinkedIn URL')
      return false
    }

    if (processedInstagramUrl && !validateUrl(processedInstagramUrl)) {
      setError('Please enter a valid Instagram URL')
      return false
    }

    if (processedFacebookUrl && !validateUrl(processedFacebookUrl)) {
      setError('Please enter a valid Facebook URL')
      return false
    }

    return true
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

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

      await updateDoc(profileRef, {
        fullName: profileData.fullName.trim(),
        fullNameLower: profileData.fullName.trim().toLowerCase(),
        profileSlug: slugify(profileData.fullName.trim()),
        major: profileData.major,
        semester: profileData.semester,
        section: profileData.section,
        bio: profileData.bio.trim(),
        about: profileData.about.trim(),
        skills: profileData.skills,
        githubUrl: processSocialUrl(profileData.githubUrl, 'github'),
        linkedinUrl: processSocialUrl(profileData.linkedinUrl, 'linkedin'),
        instagramUrl: processSocialUrl(profileData.instagramUrl, 'instagram'),
        facebookUrl: processSocialUrl(profileData.facebookUrl, 'facebook'),
        profilePicture: profileData.profilePicture,
        profilePictureStorageKey: profileData.profilePictureStorageKey,
        profileCompleted: true,
        updatedAt: timestamp,
      })

      pushSuccessMessage('Profile updated successfully!')

    } catch (err) {
      setError('Failed to update profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || isLoading) {
    return (
      <>
        <Navbar />
        <div className="flex min-h-screen items-center justify-center bg-[#f6f9ee] pb-16 pt-24">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-lime-200/70 bg-white/80 px-6 py-8 text-sm font-semibold text-[#426014] shadow-lg backdrop-blur">
            <Loader2 className="h-5 w-5 animate-spin text-[#90c639]" />
            <span>Getting your profile ready...</span>
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
      <main className="min-h-screen bg-[#f6f9ee] pb-24 pt-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <section className="relative overflow-hidden rounded-3xl border border-lime-200/70 bg-white/90 shadow-xl backdrop-blur">
            <div className="absolute -left-24 top-[-96px] h-56 w-56 rounded-full bg-[#e3f2c7] blur-3xl" />
            <div className="absolute -bottom-28 right-[-72px] h-72 w-72 rounded-full bg-[#d1f0a8] blur-3xl" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12">
              <header className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="relative mx-auto flex flex-col items-center sm:mx-0">
                    <div
                      className={`group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white/40 p-1.5 shadow-[0_20px_40px_-24px_rgba(37,72,8,0.65)] transition ${
                        isUploadingImage || isDeletingImage
                          ? 'pointer-events-none opacity-70'
                          : 'cursor-pointer hover:-translate-y-1 hover:shadow-[0_24px_45px_-22px_rgba(37,72,8,0.65)]'
                      }`}
                      onClick={() => !isUploadingImage && !isDeletingImage && fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (!isUploadingImage && !isDeletingImage && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Upload profile picture"
                    >
                      {previewImage && (
                        <img
                          key={previewImage}
                          src={previewImage}
                          alt="Profile preview"
                          className="absolute inset-0 h-full w-full rounded-full object-cover"
                        />
                      )}
                      {!previewImage && !isUploadingImage && !isDeletingImage && (
                        <div className="flex flex-col items-center gap-1 text-gray-700">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-[#5f9428] shadow-inner">
                            <User className="h-5 w-5" />
                          </div>
                          <span className="text-xs font-medium">Upload photo</span>
                        </div>
                      )}
                      {isUploadingImage && (
                        <div className="flex flex-col items-center gap-1 text-white">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          <span className="text-xs font-medium">Uploading</span>
                        </div>
                      )}
                      {isDeletingImage && (
                        <div className="flex flex-col items-center gap-1 text-white">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                          <span className="text-xs font-medium">Removing</span>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[#90c639]/0 transition group-hover:bg-[#90c639]/15" />
                    </div>
                    {previewImage && !(isUploadingImage || isDeletingImage) && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 left-4 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white text-gray-500 shadow-sm transition hover:text-rose-500"
                        aria-label="Remove profile picture"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="mt-4 text-xs font-medium text-gray-600">
                      {isUploadingImage ? 'Uploading...' : isDeletingImage ? 'Removing...' : 'Square image, max 5MB'}
                    </span>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.45em] text-[#5f7f2a]/80">
                      Profile workspace
                    </p>
                    <h1 className="mt-3 text-3xl font-semibold text-gray-900 sm:text-[2.6rem]">
                      Craft a clean, confident first impression
                    </h1>
                    <p className="mt-4 max-w-xl text-sm text-gray-600 sm:text-base">
                      Curate how classmates discover you with a minimalist edit experience that feels calm and deliberate.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start lg:flex-col lg:items-end">
                  {!isProfileComplete && (
                    <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold text-[#426014] shadow-sm">
                      <CheckCircle className="h-4 w-4 text-[#90c639]" />
                      {completionScore >= 70 ? 'Almost complete' : 'Keep building'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const slug = slugify(profileData.fullName.trim() || '')
                      if (slug) router.push(`/profile/${encodeURIComponent(slug)}`)
                    }}
                    disabled={!profileData.fullName.trim()}
                    className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-xs font-semibold text-[#426014] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="View public profile"
                  >
                    <User className="h-4 w-4" />
                    View public profile
                  </button>
                </div>
              </header>
              {!isProfileComplete && (
                <div className="mt-8">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm max-w-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7f2a]/70">Completion</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-3xl font-semibold text-gray-900">{completionScore}%</span>
                      <span className="text-xs text-gray-500">profile score</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-[#e7f4cf]">
                      <div className="h-full rounded-full bg-[#90c639]" style={{ width: `${completionScore}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {success && (
                <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-medium text-[#2f5f1d] shadow-sm" role="status">
                  {success}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-600 shadow-sm" role="alert">
                  {error}
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="relative z-10 border-t border-lime-200/60 bg-white/95 px-6 py-8 sm:px-10 sm:py-12">
              <div className="space-y-8">
                <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">About you</p>
                      <h2 className="text-lg font-semibold text-gray-900">Basic info</h2>
                    </div>
                    <span className="text-xs text-gray-500">Fields with * are required</span>
                  </div>
                  <div className="mt-6 space-y-5">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Full name *</label>
                      <input
                        type="text"
                        value={profileData.fullName}
                        onChange={(e) => setProfileData(prev => ({ ...prev, fullName: e.target.value }))}
                        className="mt-2 w-full rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Bio</label>
                      <div className="relative mt-2">
                        <textarea
                          value={profileData.bio}
                          onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                          className="w-full resize-none rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="Share a short snapshot of how you learn or collaborate"
                          rows={2}
                          maxLength={150}
                        />
                        <span className="absolute bottom-3 right-4 text-xs text-gray-500">
                          {profileData.bio.length}/150
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">About</label>
                      <div className="relative mt-2">
                        <textarea
                          value={profileData.about}
                          onChange={(e) => setProfileData(prev => ({ ...prev, about: e.target.value }))}
                          className="w-full resize-none rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm leading-relaxed text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="Tell your story - your journey, passions, goals, and what drives you in academics and beyond"
                          rows={6}
                          maxLength={2000}
                        />
                        <span className="absolute bottom-3 right-4 text-xs text-gray-500">
                          {profileData.about.length}/2000
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Share more about yourself, your background, interests, and aspirations. This helps others understand your journey better.
                      </p>
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Campus track</p>
                    <h2 className="text-lg font-semibold text-gray-900">Academic info</h2>
                  </div>
                  <div className="mt-6 space-y-5">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Major *</label>
                      <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
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
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Current semester *</label>
                        <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
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
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Section *</label>
                        <div className="mt-2 rounded-xl border border-lime-200 bg-white/70 px-3 py-2">
                          <CustomSelect
                            options={['Select Section', 'A', 'B', 'C']}
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
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Signature strengths</p>
                    <h2 className="text-lg font-semibold text-gray-900">Skills</h2>
                  </div>
                  <div className="mt-6 space-y-5">
                    {profileData.skills.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                          Your skills ({profileData.skills.length})
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {profileData.skills.map((skill, index) => (
                            <span
                              key={index}
                              className="group inline-flex items-center gap-2 rounded-full border border-[#90c639]/40 bg-[#f4fbe8] px-4 py-2 text-xs font-semibold text-[#335013] shadow-sm"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => removeSkill(skill)}
                                className="rounded-full border border-transparent bg-white/40 p-1 text-[#335013] transition hover:bg-white hover:text-rose-600"
                                aria-label={`Remove ${skill}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">Add a skill</label>
                        <input
                          ref={skillsInputRef}
                          type="text"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          onKeyDown={handleSkillInputKeyDown}
                          className="mt-2 w-full rounded-xl border border-lime-200 bg-white/70 px-4 py-3 text-sm text-gray-900 shadow-sm transition hover:border-lime-300 focus:border-[#90c639] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="Type a skill and press Enter"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addSkill}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332]"
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Suggested skills</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {COMMON_SKILLS.slice(0, 15).map((skill) => {
                          const isAdded = profileData.skills.includes(skill)
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => addCommonSkill(skill)}
                              disabled={isAdded}
                              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                isAdded
                                  ? 'cursor-not-allowed border-lime-100 bg-lime-50 text-gray-400'
                                  : 'border-lime-200 bg-white text-gray-700 hover:-translate-y-0.5 hover:border-[#90c639] hover:text-gray-900'
                              }`}
                            >
                              {skill}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </section>
                {/* Positive, private-only encouragement to contribute lives here, not on public profile */}
                <section className="rounded-2xl border border-lime-100 bg-[#f4fbe8] p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[#90c639]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[#1f2f10]">Grow your aura</h3>
                      <p className="mt-1 text-sm text-[#445236]">Share helpful, high-quality notes to build credibility and help classmates discover your strengths.</p>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => router.push('/upload')}
                          className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white/90 px-4 py-2 text-sm font-semibold text-[#335013] shadow-sm transition hover:border-[#90c639] hover:bg-white"
                        >
                          Start uploading
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
                <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
                  <ContributionHub />
                </section>
                <section className="rounded-2xl border border-lime-100 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#5f7f2a]/70">Social footprint</p>
                      <h2 className="text-lg font-semibold text-gray-900">Links</h2>
                    </div>
                    <span className="text-xs text-gray-500">Add your social profiles</span>
                  </div>

                  <div className="mt-6 space-y-3">
                    {/* Active social links */}
                    {profileData.githubUrl && (
                      <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#90c639] text-white">
                          <Github className="h-5 w-5" />
                        </div>
                        <input
                          ref={githubInputRef}
                          type="url"
                          value={profileData.githubUrl}
                          onChange={(e) => setProfileData(prev => ({ ...prev, githubUrl: e.target.value }))}
                          className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="username"
                        />
                        <button
                          type="button"
                          onClick={() => setProfileData(prev => ({ ...prev, githubUrl: '' }))}
                          className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                          aria-label="Remove GitHub"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {profileData.linkedinUrl && (
                      <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
                          <Linkedin className="h-5 w-5" />
                        </div>
                        <input
                          ref={linkedinInputRef}
                          type="url"
                          value={profileData.linkedinUrl}
                          onChange={(e) => setProfileData(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                          className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="username or custom URL"
                        />
                        <button
                          type="button"
                          onClick={() => setProfileData(prev => ({ ...prev, linkedinUrl: '' }))}
                          className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                          aria-label="Remove LinkedIn"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {profileData.instagramUrl && (
                      <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white">
                          <Instagram className="h-5 w-5" />
                        </div>
                        <input
                          ref={instagramInputRef}
                          type="url"
                          value={profileData.instagramUrl}
                          onChange={(e) => setProfileData(prev => ({ ...prev, instagramUrl: e.target.value }))}
                          className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="@username or custom URL"
                        />
                        <button
                          type="button"
                          onClick={() => setProfileData(prev => ({ ...prev, instagramUrl: '' }))}
                          className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                          aria-label="Remove Instagram"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {profileData.facebookUrl && (
                      <div className="group flex items-center gap-3 rounded-2xl border border-lime-100 bg-white/80 p-3 transition-all hover:border-[#90c639]/30">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                          <Facebook className="h-5 w-5" />
                        </div>
                        <input
                          ref={facebookInputRef}
                          type="url"
                          value={profileData.facebookUrl}
                          onChange={(e) => setProfileData(prev => ({ ...prev, facebookUrl: e.target.value }))}
                          className="flex-1 rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-gray-900 shadow-sm transition focus:border-lime-200 focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                          placeholder="username or custom URL"
                        />
                        <button
                          type="button"
                          onClick={() => setProfileData(prev => ({ ...prev, facebookUrl: '' }))}
                          className="rounded-full border border-transparent bg-gray-100 p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 hover:border-red-200"
                          aria-label="Remove Facebook"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Available social platforms to add */}
                    <div className="mt-6">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-3">Add more links</p>
                      <div className="flex flex-wrap gap-2">
                        {!profileData.githubUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileData(prev => ({ ...prev, githubUrl: 'https://github.com/' }))
                              setTimeout(() => githubInputRef.current?.focus(), 100)
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
                          >
                            <Github className="h-4 w-4" />
                            Add GitHub
                          </button>
                        )}
                        {!profileData.linkedinUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileData(prev => ({ ...prev, linkedinUrl: 'https://linkedin.com/in/' }))
                              setTimeout(() => linkedinInputRef.current?.focus(), 100)
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
                          >
                            <Linkedin className="h-4 w-4" />
                            Add LinkedIn
                          </button>
                        )}
                        {!profileData.instagramUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileData(prev => ({ ...prev, instagramUrl: 'https://instagram.com/' }))
                              setTimeout(() => instagramInputRef.current?.focus(), 100)
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
                          >
                            <Instagram className="h-4 w-4" />
                            Add Instagram
                          </button>
                        )}
                        {!profileData.facebookUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileData(prev => ({ ...prev, facebookUrl: 'https://facebook.com/' }))
                              setTimeout(() => facebookInputRef.current?.focus(), 100)
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-[#90c639] hover:bg-[#f4fbe8] hover:text-[#335013]"
                          >
                            <Facebook className="h-4 w-4" />
                            Add Facebook
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
                <div className="flex flex-col gap-3 border-t border-lime-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => router.push('/userpage')}
                    className="inline-flex items-center justify-center rounded-full border border-lime-200 px-5 py-3 text-sm font-semibold text-[#426014] transition hover:border-[#90c639] hover:text-[#2d460b]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#90c639] to-[#7ab332] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(37,72,8,0.7)] transition hover:shadow-[0_18px_36px_-16px_rgba(37,72,8,0.8)] disabled:cursor-not-allowed disabled:from-[#b5d783] disabled:to-[#b5d783]"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                        Saving
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  )
}
