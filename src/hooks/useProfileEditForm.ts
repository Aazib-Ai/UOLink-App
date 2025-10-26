'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { syncUserProfileReferences } from '@/lib/firebase/profile-sync'
import { slugify } from '@/lib/utils'
import {
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
  setDoc,
} from 'firebase/firestore'

interface ProfileData {
  id: string
  fullName: string
  username?: string
  usernameLastChanged?: Date
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

const profileCache = new Map<string, ProfileData>()

const createInitialProfileData = (): ProfileData => ({
  id: '',
  fullName: '',
  username: undefined,
  usernameLastChanged: undefined,
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

const cloneProfileData = (data: ProfileData): ProfileData => ({
  ...data,
  skills: [...data.skills],
  usernameLastChanged: data.usernameLastChanged ? new Date(data.usernameLastChanged) : undefined,
  profilePicture: data.profilePicture ?? null,
  profilePictureStorageKey: data.profilePictureStorageKey ?? null,
})

const areProfilesEqual = (a: ProfileData, b: ProfileData): boolean => {
  const normalizeOptional = (value: string | null | undefined) => value ?? ''
  return (
    a.id === b.id &&
    a.fullName === b.fullName &&
    normalizeOptional(a.username) === normalizeOptional(b.username) &&
    (a.usernameLastChanged?.getTime() ?? 0) === (b.usernameLastChanged?.getTime() ?? 0) &&
    a.major === b.major &&
    a.semester === b.semester &&
    a.section === b.section &&
    a.bio === b.bio &&
    a.about === b.about &&
    a.skills.length === b.skills.length &&
    a.skills.every((skill, index) => skill === b.skills[index]) &&
    normalizeOptional(a.githubUrl) === normalizeOptional(b.githubUrl) &&
    normalizeOptional(a.linkedinUrl) === normalizeOptional(b.linkedinUrl) &&
    normalizeOptional(a.instagramUrl) === normalizeOptional(b.instagramUrl) &&
    normalizeOptional(a.facebookUrl) === normalizeOptional(b.facebookUrl) &&
    normalizeOptional(a.profilePicture) === normalizeOptional(b.profilePicture) &&
    normalizeOptional(a.profilePictureStorageKey) === normalizeOptional(b.profilePictureStorageKey)
  )
}

const mapSnapshotToProfileData = (uid: string, data: Record<string, any>): ProfileData => {
  const toDateValue = (value: any): Date | undefined => {
    if (!value) return undefined
    if (value instanceof Date) return value
    if (typeof value.toDate === 'function') return value.toDate()
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }

  return {
    id: uid,
    fullName: data.fullName ?? '',
    username: data.username ?? undefined,
    usernameLastChanged: toDateValue(data.usernameLastChanged),
    major: data.major ?? '',
    semester: data.semester ?? '',
    section: data.section ?? '',
    bio: data.bio ?? '',
    about: data.about ?? '',
    skills: Array.isArray(data.skills) ? [...data.skills] : [],
    githubUrl: data.githubUrl ?? '',
    linkedinUrl: data.linkedinUrl ?? '',
    instagramUrl: data.instagramUrl ?? '',
    facebookUrl: data.facebookUrl ?? '',
    profilePicture: data.profilePicture ?? null,
    profilePictureStorageKey: data.profilePictureStorageKey ?? null,
  }
}

export function useProfileEditForm() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profileData, setProfileData] = useState<ProfileData>(() => createInitialProfileData())

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialProfileDataRef = useRef<ProfileData | null>(null)

  const pushSuccessMessage = useCallback((message: string) => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current)
    }
    setSuccess(message)
    successTimeoutRef.current = setTimeout(() => {
      setSuccess(null)
      successTimeoutRef.current = null
    }, 3000)
  }, [])

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

  // Load existing profile data (with caching to avoid unnecessary reloads)
  useEffect(() => {
    if (!user?.uid) {
      initialProfileDataRef.current = null
      setProfileData(createInitialProfileData())
      setPreviewImage(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let isMounted = true
    setError(null)

    const cachedProfile = profileCache.get(user.uid)
    if (cachedProfile) {
      const cachedClone = cloneProfileData(cachedProfile)
      initialProfileDataRef.current = cloneProfileData(cachedClone)
      setProfileData(cachedClone)
      setPreviewImage(cachedClone.profilePicture)
      setIsLoading(false)
    } else {
      setIsLoading(true)
    }

    const loadProfile = async () => {
      try {
        const profileRef = doc(db, 'profiles', user.uid)
        const profileSnap = await getDoc(profileRef)

        if (!isMounted) return

        if (profileSnap.exists()) {
          const loadedProfile = cloneProfileData(mapSnapshotToProfileData(user.uid, profileSnap.data()))
          const shouldUpdate =
            !initialProfileDataRef.current || !areProfilesEqual(initialProfileDataRef.current, loadedProfile)

          if (shouldUpdate) {
            const nextInitial = cloneProfileData(loadedProfile)
            initialProfileDataRef.current = nextInitial
            profileCache.set(user.uid, cloneProfileData(nextInitial))
            setProfileData(loadedProfile)
            setPreviewImage(loadedProfile.profilePicture)
          } else {
            if (initialProfileDataRef.current) {
              profileCache.set(user.uid, cloneProfileData(initialProfileDataRef.current))
            }
          }
        } else {
          const emptyProfile = cloneProfileData({
            ...createInitialProfileData(),
            id: user.uid,
          })
          initialProfileDataRef.current = cloneProfileData(emptyProfile)
          profileCache.set(user.uid, cloneProfileData(emptyProfile))
          setProfileData(emptyProfile)
          setPreviewImage(null)
        }
      } catch (err) {
        if (!isMounted) return
        console.error('Error loading profile:', err)
        setError('Failed to load profile data')
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [user?.uid])

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!initialProfileDataRef.current) {
      setHasChanges(false)
      return
    }

    setHasChanges(prev => {
      const next = !areProfilesEqual(initialProfileDataRef.current!, profileData)
      return prev === next ? prev : next
    })
  }, [profileData])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!user?.uid) {
      setError('You must be signed in to update your profile picture.')
      return
    }

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

      const token = await user.getIdToken()
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
          aura: 0,
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
      if (user?.uid) {
        const nextInitialBase = initialProfileDataRef.current ?? {
          ...createInitialProfileData(),
          id: user.uid,
        }
        const nextInitial = cloneProfileData({
          ...nextInitialBase,
          profilePicture: fileUrl,
          profilePictureStorageKey: storageKey,
        })
        initialProfileDataRef.current = nextInitial
        profileCache.set(user.uid, cloneProfileData(nextInitial))
      }
      setPreviewImage(fileUrl)

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
      if (user?.uid) {
        const nextInitialBase = initialProfileDataRef.current ?? {
          ...createInitialProfileData(),
          id: user.uid,
        }
        const nextInitial = cloneProfileData({
          ...nextInitialBase,
          profilePicture: null,
          profilePictureStorageKey: null,
        })
        initialProfileDataRef.current = nextInitial
        profileCache.set(user.uid, cloneProfileData(nextInitial))
      }
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

    if (!hasChanges) {
      pushSuccessMessage('Profile is already up to date.')
      return
    }

    setIsSubmitting(true)

    try {
      if (!user?.uid) {
        setError('You must be signed in to save your profile.')
        return
      }

      const previousProfile = initialProfileDataRef.current
      const profileRef = doc(db, 'profiles', user.uid)
      const timestamp = serverTimestamp()
      const sanitizedFullName = profileData.fullName.trim()
      const sanitizedBio = profileData.bio.trim()
      const sanitizedAbout = profileData.about.trim()
      const sanitizedGithubUrl = processSocialUrl(profileData.githubUrl, 'github')
      const sanitizedLinkedinUrl = processSocialUrl(profileData.linkedinUrl, 'linkedin')
      const sanitizedInstagramUrl = processSocialUrl(profileData.instagramUrl, 'instagram')
      const sanitizedFacebookUrl = processSocialUrl(profileData.facebookUrl, 'facebook')

      const sanitizedProfile = cloneProfileData({
        ...profileData,
        id: user.uid,
        fullName: sanitizedFullName,
        bio: sanitizedBio,
        about: sanitizedAbout,
        githubUrl: sanitizedGithubUrl,
        linkedinUrl: sanitizedLinkedinUrl,
        instagramUrl: sanitizedInstagramUrl,
        facebookUrl: sanitizedFacebookUrl,
      })

      // Check if profile document exists, create if not
      const profileSnap = await getDoc(profileRef)
      const updateData = {
        fullName: sanitizedProfile.fullName,
        fullNameLower: sanitizedProfile.fullName.toLowerCase(),
        profileSlug: slugify(sanitizedProfile.fullName),
        major: sanitizedProfile.major,
        semester: sanitizedProfile.semester,
        section: sanitizedProfile.section,
        bio: sanitizedProfile.bio,
        about: sanitizedProfile.about,
        skills: sanitizedProfile.skills,
        githubUrl: sanitizedProfile.githubUrl,
        linkedinUrl: sanitizedProfile.linkedinUrl,
        instagramUrl: sanitizedProfile.instagramUrl,
        facebookUrl: sanitizedProfile.facebookUrl,
        profilePicture: sanitizedProfile.profilePicture,
        profilePictureStorageKey: sanitizedProfile.profilePictureStorageKey,
        profileCompleted: true,
        updatedAt: timestamp,
      }

      if (!profileSnap.exists()) {
        // Create new document
        await setDoc(profileRef, {
          ...updateData,
          aura: 0,
          createdAt: timestamp,
        })
      } else {
        // Update existing document
        await updateDoc(profileRef, updateData)
      }

      const normalizedPreviousFullName = previousProfile?.fullName?.trim() ?? ''
      const normalizedCurrentFullName = sanitizedProfile.fullName.trim()
      const previousUsername = previousProfile?.username?.trim() ?? ''
      const currentUsername = sanitizedProfile.username?.trim() ?? ''
      const nameChanged = normalizedPreviousFullName !== normalizedCurrentFullName
      const usernameChanged = previousUsername !== currentUsername

      const shouldSyncProfileReferences = nameChanged || usernameChanged

      if (shouldSyncProfileReferences) {
        try {
          await syncUserProfileReferences({
            userId: user.uid,
            fullName: sanitizedProfile.fullName,
            username: sanitizedProfile.username ?? null,
          })
        } catch (syncError) {
          // Log sync errors but don't fail the profile update
          console.warn('[ProfileSync] Some profile references may not have been updated:', syncError instanceof Error ? syncError.message : String(syncError))
        }
      }

      const nextInitial = cloneProfileData(sanitizedProfile)
      initialProfileDataRef.current = nextInitial
      profileCache.set(user.uid, cloneProfileData(nextInitial))
      setProfileData(sanitizedProfile)
      setPreviewImage(sanitizedProfile.profilePicture)
      setHasChanges(false)
      pushSuccessMessage('Profile updated successfully!')

    } catch (err) {
      setError('Failed to update profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateProfileData = (updates: Partial<ProfileData>) => {
    setProfileData(prev => ({ ...prev, ...updates }))
  }

  const addSkill = (skill: string) => {
    setProfileData(prev => ({
      ...prev,
      skills: [...prev.skills, skill]
    }))
  }

  const removeSkill = (skillToRemove: string) => {
    setProfileData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }))
  }

  // Calculate completion metrics
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

  return {
    // State
    profileData,
    previewImage,
    isSubmitting,
    error,
    success,
    isLoading,
    isUploadingImage,
    isDeletingImage,
    completionScore,
    isProfileComplete,
    hasChanges,
    fileInputRef,

    // Actions
    handleImageUpload,
    handleRemoveImage,
    handleSubmit,
    updateProfileData,
    addSkill,
    removeSkill,
    pushSuccessMessage,
  }
}
