import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
  writeBatch,
} from 'firebase/firestore'
import { FirebaseError } from 'firebase/app'
import { db } from '@/lib/firebase'
import { toTitleCase } from '@/lib/utils'
import { UserNote } from '@/types/contributions'

export interface ContributionsServiceResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

class ContributionsService {
  private normalizeValue = (value: string) =>
    value
      .toLowerCase()
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  private getTimestampString = (value: unknown) => {
    if (typeof value === 'string') return value

    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString()
      } catch {
        return new Date().toISOString()
      }
    }

    return new Date().toISOString()
  }

  async loadUserContributions(uid: string, displayName?: string, email?: string, username?: string): Promise<ContributionsServiceResponse<UserNote[]>> {
    try {
      const notesRef = collection(db, 'notes')

      // Build all constraint sets for different possible user identifiers
      const constraintSets: Array<{ label: string; constraints: any[] }> = [
        {
          label: 'uploadedBy',
          constraints: [where('uploadedBy', '==', uid)],
        },
      ]

      if (email) {
        const emailLower = email.toLowerCase()
        constraintSets.push({
          label: `metadata.createdBy:${emailLower}`,
          constraints: [where('metadata.createdBy', '==', emailLower)],
        })
        constraintSets.push({
          label: `metadata.createdBy:${email}`,
          constraints: [where('metadata.createdBy', '==', email)],
        })
      }

      const contributorCandidates = new Set<string>()

      // Add username as primary identifier for contributor name matching
      if (username) {
        const trimmedUsername = username.trim()
        if (trimmedUsername) {
          contributorCandidates.add(trimmedUsername)
        }
      }

      // Add display name variations for backward compatibility
      if (displayName) {
        const trimmed = displayName.trim()
        if (trimmed) {
          contributorCandidates.add(trimmed)
          contributorCandidates.add(toTitleCase(trimmed))
        }
      }

      // Add email-based identifier for legacy compatibility
      if (email) {
        contributorCandidates.add(email.split('@')[0])
      }

      contributorCandidates.forEach((candidate) => {
        const value = candidate.trim()
        if (value) {
          constraintSets.push({
            label: `contributorName:${value}`,
            constraints: [where('contributorName', '==', value)],
          })
        }
      })

      const results = new Map<string, UserNote>()

      // Helper function for running queries with fallback
      const runQueryWithFallback = async (constraints: any[]) => {
        try {
          return await getDocs(query(notesRef, ...constraints, orderBy('uploadedAt', 'desc')))
        } catch (err) {
          if (err instanceof FirebaseError && err.code === 'failed-precondition') {
            return await getDocs(query(notesRef, ...constraints))
          }
          throw err
        }
      }

      // Execute queries in parallel for better performance
      const queryPromises = constraintSets.map(async (attempt) => {
        try {
          const snapshot = await runQueryWithFallback(attempt.constraints)
          snapshot.docs.forEach((docSnap) => {
            if (results.has(docSnap.id)) return

            const data = docSnap.data() as Record<string, unknown>
            const uploadedAtRaw = data.uploadedAt
            const updatedAtRaw = data.updatedAt

            results.set(docSnap.id, {
              id: docSnap.id,
              name: typeof data.name === 'string' ? data.name : 'Untitled note',
              subject: typeof data.subject === 'string' ? data.subject : '',
              teacher: typeof data.teacher === 'string' ? data.teacher : typeof data.module === 'string' ? data.module : '',
              module: typeof data.module === 'string' ? data.module : undefined,
              semester: typeof data.semester === 'string' ? data.semester : '',
              contributorName: typeof data.contributorName === 'string' ? data.contributorName : '',
              contributorDisplayName: typeof data.contributorDisplayName === 'string'
                ? data.contributorDisplayName
                : typeof data.contributorName === 'string'
                ? data.contributorName
                : '',
              uploaderUsername: typeof data.uploaderUsername === 'string' ? data.uploaderUsername : null,
              fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : '',
              fileSize: typeof data.fileSize === 'number' ? data.fileSize : undefined,
              uploadedAt: this.getTimestampString(uploadedAtRaw),
              updatedAt: updatedAtRaw ? this.getTimestampString(updatedAtRaw) : undefined,
            })
          })
        } catch (attemptError) {
          console.error(`[ContributionsService] Failed to load notes using ${attempt.label}:`, attemptError)
        }
      })

      // Wait for all queries to complete
      await Promise.allSettled(queryPromises)

      return {
        data: Array.from(results.values()),
        error: null,
        success: true,
      }
    } catch (error) {
      console.error('[ContributionsService] Error loading notes:', error)
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to load your contributions.',
        success: false,
      }
    }
  }

  async updateContribution(
    noteId: string,
    updates: {
      name: string
      subject: string
      teacher: string
      semester: string
    }
  ): Promise<ContributionsServiceResponse<void>> {
    try {
      const noteRef = doc(db, 'notes', noteId)

      await updateDoc(noteRef, {
        name: updates.name,
        subject: updates.subject,
        teacher: updates.teacher,
        module: updates.teacher,
        semester: updates.semester,
        updatedAt: serverTimestamp(),
      })

      return {
        data: null,
        error: null,
        success: true,
      }
    } catch (error) {
      console.error('[ContributionsService] Note update error:', error)
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update note details.',
        success: false,
      }
    }
  }

  async deleteContribution(noteId: string): Promise<ContributionsServiceResponse<void>> {
    try {
      // Get current user for authentication
      const { getAuth } = await import('firebase/auth')
      const auth = getAuth()
      const currentUser = auth.currentUser

      if (!currentUser) {
        return {
          data: null,
          error: 'You must be signed in to delete notes.',
          success: false,
        }
      }

      // Get ID token for authentication
      const token = await currentUser.getIdToken()

      // Call the DELETE API endpoint which handles both Firestore and R2 deletion
      const response = await fetch(`/api/upload?noteId=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete note (${response.status})`)
      }

      return {
        data: null,
        error: null,
        success: true,
      }
    } catch (error) {
      console.error('[ContributionsService] Note delete error:', error)
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to delete note.',
        success: false,
      }
    }
  }

  async validateSubject(subject: string, subjectLookup: Map<string, string>): Promise<ContributionsServiceResponse<string>> {
    const subjectKey = this.normalizeValue(subject)
    const canonicalSubject = subjectLookup.get(subjectKey)

    if (!canonicalSubject) {
      return {
        data: null,
        error: 'Please choose a subject from the matching list before saving.',
        success: false,
      }
    }

    return {
      data: canonicalSubject,
      error: null,
      success: true,
    }
  }

  async validateTeacher(
    teacher: string,
    teacherLookup: Map<string, string>,
    overrideConfirmed: boolean
  ): Promise<ContributionsServiceResponse<{ teacher: string; needsOverride: boolean }>> {
    const teacherKey = this.normalizeValue(teacher)
    const canonicalTeacher = teacherLookup.get(teacherKey)

    if (canonicalTeacher) {
      return {
        data: {
          teacher: canonicalTeacher,
          needsOverride: false,
        },
        error: null,
        success: true,
      }
    }

    if (!overrideConfirmed) {
      return {
        data: null,
        error: 'We could not find this teacher in our directory. Double-check the spelling or click Save again to continue.',
        success: false,
      }
    }

    return {
      data: {
        teacher,
        needsOverride: true,
      },
      error: null,
      success: true,
    }
  }

  async loadUserProfile(uid: string): Promise<ContributionsServiceResponse<string>> {
    try {
      const profileRef = doc(db, 'profiles', uid)
      const profileSnap = await getDoc(profileRef)

      if (profileSnap.exists()) {
        const profileData = profileSnap.data()
        const fullName = profileData.fullName || 'Contributor'
        return {
          data: fullName,
          error: null,
          success: true,
        }
      } else {
        return {
          data: 'Contributor',
          error: null,
          success: true,
        }
      }
    } catch (error) {
      console.error('[ContributionsService] Error loading profile:', error)
      return {
        data: 'Contributor',
        error: null,
        success: true,
      }
    }
  }
}

export const contributionsService = new ContributionsService()
export default contributionsService
