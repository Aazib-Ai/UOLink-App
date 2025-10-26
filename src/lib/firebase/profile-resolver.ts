import { getUserByUsername } from './username-service';
import { getUserProfile } from './profiles';
import { usernameCache } from '../cache/username-cache';
import type { UserProfile } from '../data/types';

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
        const normalizedUsername = username?.trim();
        if (!normalizedUsername) {
            return null;
        }

        // Check cache first for faster resolution
        const cachedProfile = usernameCache.get(normalizedUsername);
        if (cachedProfile !== undefined) {
            return cachedProfile;
        }

        // Use the username service for clean resolution
        const profile = await getUserByUsername(normalizedUsername);

        // The username service already handles caching, but we ensure consistency
        return profile;
    } catch (error) {
        console.error('Error resolving user by username:', error);
        return null;
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
    if (!username || typeof username !== 'string') {
        return false;
    }

    const trimmed = username.trim();

    // Check length (3-30 characters)
    if (trimmed.length < 3 || trimmed.length > 30) {
        return false;
    }

    // Check format: alphanumeric, hyphens, underscores only
    // Must start and end with alphanumeric
    const usernameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

    return usernameRegex.test(trimmed);
}

/**
 * Extract username from profile URL path
 */
export function extractUsernameFromPath(path: string): string | null {
    try {
        if (!path || typeof path !== 'string') {
            return null;
        }

        // Handle paths like "/profile/username" or "profile/username"
        const cleanPath = path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
        const segments = cleanPath.split('/');

        // Look for profile segment followed by username
        const profileIndex = segments.findIndex(segment => segment === 'profile');

        if (profileIndex !== -1 && profileIndex + 1 < segments.length) {
            const username = segments[profileIndex + 1];
            return isValidUsernameFormat(username) ? username : null;
        }

        // If no profile segment, assume the path is just the username
        if (segments.length === 1 && isValidUsernameFormat(segments[0])) {
            return segments[0];
        }

        return null;
    } catch (error) {
        console.error('Error extracting username from path:', error);
        return null;
    }
}

/**
 * Generate profile URL from username
 */
export function generateProfileUrl(username: string): string | null {
    try {
        if (!username || !isValidUsernameFormat(username)) {
            return null;
        }

        return `/profile/${username.trim()}`;
    } catch (error) {
        console.error('Error generating profile URL:', error);
        return null;
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