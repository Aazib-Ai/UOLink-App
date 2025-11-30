import { collection, query, where, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from './app'
import { getUserProfile } from './profiles'
import { usernameCache } from '../cache/username-cache'
import type { UserProfile } from '../data/types'
import { toPublicProfile } from '@/lib/security/sanitization'

/**
 * New profile resolver service that uses username-only resolution
 * This replaces the complex getUserProfileByName function with clean username lookup
 */

/**
 * Get user profile by username (primary method)
 * This is the main function for profile resolution in the new system
 */
export async function getUserByUsernameOnly(username: string): Promise<UserProfile | null> {
  try {
    const normalized = (username || '').trim()
    if (!normalized) return null

    const cached = usernameCache.get(normalized)
    if (cached !== undefined) return cached as UserProfile | null

    const q = query(collection(db, 'profiles'), where('username', '==', normalized), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) {
      usernameCache.set(normalized, null)
      return null
    }
    const docSnap = snap.docs[0]
    const raw = { id: docSnap.id, ...docSnap.data() }
    const profile = toPublicProfile(raw) as UserProfile
    usernameCache.set(normalized, profile)
    return profile
  } catch (error) {
    console.error('Error resolving user by username:', error)
    return null
  }
}

/**
 * Get user profile by user ID (direct lookup)
 */
export async function getUserByIdOnly(userId: string): Promise<UserProfile | null> {
    try {
        if (!userId?.trim()) {
            return null;
        }

        return await getUserProfile(userId);
    } catch (error) {
        console.error('Error resolving user by ID:', error);
        return null;
    }
}

/**
 * Validate username format for profile URLs
 */
export function isValidUsernameFormat(username: string): boolean {
  if (!username || typeof username !== 'string') return false
  const trimmed = username.trim()
  const numericRegex = /^\d{5,}$/
  return numericRegex.test(trimmed)
}

/**
 * Extract username from profile URL path
 */
export function extractUsernameFromPath(path: string): string | null {
  try {
    if (!path || typeof path !== 'string') return null
    const cleanPath = path.replace(/^\/+|\/+$/g, '')
    const segments = cleanPath.split('/')
    const profileIndex = segments.findIndex((s) => s === 'profile')
    if (profileIndex !== -1 && profileIndex + 1 < segments.length) {
      const u = segments[profileIndex + 1]
      return isValidUsernameFormat(u) ? u : null
    }
    if (segments.length === 1 && isValidUsernameFormat(segments[0])) {
      return segments[0]
    }
    return null
  } catch (error) {
    console.error('Error extracting username from path:', error)
    return null
  }
}

/**
 * Generate profile URL from username
 */
export function generateProfileUrl(username: string): string | null {
  try {
    if (!username || !isValidUsernameFormat(username)) return null
    return `/profile/${username.trim()}`
  } catch (error) {
    console.error('Error generating profile URL:', error)
    return null
  }
}

/**
 * Check if a path is a valid profile URL
 */
export function isValidProfileUrl(path: string): boolean {
    const username = extractUsernameFromPath(path);
    return username !== null;
}

/**
 * Profile resolver service interface
 */
export interface ProfileResolver {
    getUserByUsername(username: string): Promise<UserProfile | null>;
    getUserById(userId: string): Promise<UserProfile | null>;
    isValidUsername(username: string): boolean;
    extractUsernameFromPath(path: string): string | null;
    generateProfileUrl(username: string): string | null;
    isValidProfileUrl(path: string): boolean;
}

/**
 * Export the profile resolver service implementation
 */
export const profileResolver: ProfileResolver = {
    getUserByUsername: getUserByUsernameOnly,
    getUserById: getUserByIdOnly,
    isValidUsername: isValidUsernameFormat,
    extractUsernameFromPath,
    generateProfileUrl,
    isValidProfileUrl
};

// Legacy compatibility has been removed - use getUserByUsernameOnly instead
