import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

/**
 * Checks if the current user has completed their profile
 * @returns Promise<boolean> - true if profile is completed, false otherwise
 */
export async function checkProfileCompletion(): Promise<boolean> {
  try {
    // Get current user from Firebase auth
    const { getAuth } = await import('firebase/auth')
    const auth = getAuth()
    const currentUser = auth.currentUser

    if (!currentUser) {
      return false
    }

    // Check if profile document exists and has profileCompleted: true
    const profileRef = doc(db, 'profiles', currentUser.uid)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      return false
    }

    const profileData = profileSnap.data()
    return profileData.profileCompleted === true
  } catch (error) {
    console.error('Error checking profile completion:', error)
    // Default to false if there's an error
    return false
  }
}

/**
 * Checks if a user has all required profile fields
 * @returns Promise<{isComplete: boolean, missingFields: string[]}>
 */
export async function checkRequiredProfileFields(): Promise<{
  isComplete: boolean
  missingFields: string[]
}> {
  try {
    const { getAuth } = await import('firebase/auth')
    const auth = getAuth()
    const currentUser = auth.currentUser

    if (!currentUser) {
      return { isComplete: false, missingFields: ['User not authenticated'] }
    }

    const profileRef = doc(db, 'profiles', currentUser.uid)
    const profileSnap = await getDoc(profileRef)

    if (!profileSnap.exists()) {
      return {
        isComplete: false,
        missingFields: ['Full Name', 'Major', 'Semester', 'Section']
      }
    }

    const profileData = profileSnap.data()
    const missingFields: string[] = []

    // Check required fields
    if (!profileData.fullName || profileData.fullName.trim() === '') {
      missingFields.push('Full Name')
    }
    if (!profileData.major || profileData.major.trim() === '') {
      missingFields.push('Major')
    }
    if (!profileData.semester || profileData.semester.trim() === '') {
      missingFields.push('Semester')
    }
    if (!profileData.section || profileData.section.trim() === '') {
      missingFields.push('Section')
    }

    return {
      isComplete: missingFields.length === 0,
      missingFields
    }
  } catch (error) {
    console.error('Error checking required profile fields:', error)
    return {
      isComplete: false,
      missingFields: ['Unable to verify profile data']
    }
  }
}