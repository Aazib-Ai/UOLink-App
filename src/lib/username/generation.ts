/**
 * Username generation utilities
 * Handles converting display names to usernames and conflict resolution
 */

import { validateUsername, isReservedUsername } from './validation';

export interface GenerationOptions {
    maxLength?: number;
    preserveCase?: boolean;
    conflictResolver?: (base: string, attempt: number) => string;
}

/**
 * Sanitizes a display name into a username-safe format
 * Removes special characters, converts to lowercase, replaces spaces with hyphens
 */
export function sanitizeDisplayName(displayName: string): string {
    if (!displayName) {
        return '';
    }

    return displayName
        .trim()
        // Convert to lowercase
        .toLowerCase()
        // Replace spaces and multiple whitespace with single hyphens
        .replace(/\s+/g, '-')
        // Remove all characters except alphanumeric, hyphens, and underscores
        .replace(/[^a-z0-9_-]/g, '')
        // Remove leading/trailing hyphens and underscores
        .replace(/^[-_]+|[-_]+$/g, '')
        // Replace multiple consecutive hyphens/underscores with single hyphen
        .replace(/[-_]+/g, '-')
        // Ensure it doesn't start or end with special characters
        .replace(/^[-_]|[-_]$/g, '');
}

/**
 * Generates a base username from a display name
 */
export function generateBaseUsername(displayName: string, options: GenerationOptions = {}): string {
    const { maxLength = 30 } = options;

    let username = sanitizeDisplayName(displayName);

    // If empty after sanitization, use a default
    if (!username) {
        username = 'user';
    }

    // Truncate if too long, but try to keep it at word boundaries
    if (username.length > maxLength) {
        const truncated = username.substring(0, maxLength);
        // Try to cut at last hyphen to avoid cutting words
        const lastHyphen = truncated.lastIndexOf('-');
        if (lastHyphen > maxLength * 0.7) { // Only if we don't lose too much
            username = truncated.substring(0, lastHyphen);
        } else {
            username = truncated;
        }
    }

    // Ensure it ends with alphanumeric after truncation
    username = username.replace(/[-_]+$/, '');

    return username;
}

/**
 * Default conflict resolver - appends numeric suffixes
 */
export function defaultConflictResolver(baseUsername: string, attempt: number): string {
    return `${baseUsername}-${attempt}`;
}

/**
 * Generates a unique username from display name with conflict resolution
 * This is a synchronous version that doesn't check database availability
 * Use this for generating candidates that will be checked against the database
 */
export function generateUsernameWithConflicts(
    displayName: string,
    existingUsernames: Set<string>,
    options: GenerationOptions = {}
): string {
    const { conflictResolver = defaultConflictResolver } = options;

    let baseUsername = generateBaseUsername(displayName, options);

    // Validate the base username format
    const validation = validateUsername(baseUsername);
    if (!validation.isValid) {
        // If base is invalid, try a simple fallback
        baseUsername = 'user';
    }

    // Check if base username is available
    if (!existingUsernames.has(baseUsername.toLowerCase()) && !isReservedUsername(baseUsername)) {
        return baseUsername;
    }

    // Try with conflict resolution
    let attempt = 2;
    const maxAttempts = 100; // Prevent infinite loops

    while (attempt <= maxAttempts) {
        const candidate = conflictResolver(baseUsername, attempt);

        // Validate the candidate
        const candidateValidation = validateUsername(candidate);
        if (candidateValidation.isValid &&
            !existingUsernames.has(candidate.toLowerCase()) &&
            !isReservedUsername(candidate)) {
            return candidate;
        }

        attempt++;
    }

    // Fallback if all attempts failed
    const timestamp = Date.now().toString().slice(-6);
    return `user-${timestamp}`;
}

/**
 * Generates multiple username suggestions from a display name
 */
export function generateUsernameSuggestions(
    displayName: string,
    existingUsernames: Set<string>,
    count: number = 5
): string[] {
    const suggestions: string[] = [];
    const baseUsername = generateBaseUsername(displayName);

    // Try the base username first
    if (!existingUsernames.has(baseUsername.toLowerCase()) && !isReservedUsername(baseUsername)) {
        suggestions.push(baseUsername);
    }

    // Generate variations
    const variations = [
        // Numeric suffixes
        ...Array.from({ length: count }, (_, i) => `${baseUsername}-${i + 1}`),
        // Alternative formats
        `${baseUsername}-user`,
        `${baseUsername}-official`,
        baseUsername.replace(/-/g, '_'), // Replace hyphens with underscores
        baseUsername.replace(/-/g, ''), // Remove hyphens entirely
    ];

    for (const variation of variations) {
        if (suggestions.length >= count) break;

        const validation = validateUsername(variation);
        if (validation.isValid &&
            !existingUsernames.has(variation.toLowerCase()) &&
            !isReservedUsername(variation) &&
            !suggestions.includes(variation)) {
            suggestions.push(variation);
        }
    }

    return suggestions.slice(0, count);
}

/**
 * Extracts potential username components from a display name
 * Useful for generating more creative suggestions
 */
export function extractUsernameComponents(displayName: string): string[] {
    const sanitized = sanitizeDisplayName(displayName);
    const parts = sanitized.split('-').filter(part => part.length > 0);

    const components: string[] = [];

    // Add individual parts
    components.push(...parts);

    // Add combinations
    if (parts.length > 1) {
        // First + last
        components.push(`${parts[0]}-${parts[parts.length - 1]}`);
        // First two
        if (parts.length > 2) {
            components.push(`${parts[0]}-${parts[1]}`);
        }
        // Initials
        const initials = parts.map(part => part[0]).join('');
        if (initials.length >= 2) {
            components.push(initials);
        }
    }

    return components.filter(comp => comp.length >= 2);
}