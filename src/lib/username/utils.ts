/**
 * Combined username utilities that use both validation and generation
 */

import { validateUsername, type ValidationResult } from './validation';
import { generateBaseUsername, generateUsernameSuggestions, type GenerationOptions } from './generation';

/**
 * Complete username processing result
 */
export interface UsernameProcessingResult {
    username: string;
    isValid: boolean;
    errors: string[];
    suggestions: string[];
    wasGenerated: boolean;
}

/**
 * Processes a display name into a valid username with full validation and suggestions
 */
export function processDisplayNameToUsername(
    displayName: string,
    existingUsernames: Set<string> = new Set(),
    options: GenerationOptions = {}
): UsernameProcessingResult {
    // Generate base username
    const generatedUsername = generateBaseUsername(displayName, options);

    // Validate the generated username
    const validation = validateUsername(generatedUsername);

    // Check if it's taken
    const isTaken = existingUsernames.has(generatedUsername.toLowerCase());

    let finalUsername = generatedUsername;
    let suggestions: string[] = [];

    // If invalid or taken, generate suggestions
    if (!validation.isValid || isTaken) {
        suggestions = generateUsernameSuggestions(displayName, existingUsernames, 5);

        // Use first suggestion as the final username if available
        if (suggestions.length > 0) {
            finalUsername = suggestions[0];
        }
    }

    return {
        username: finalUsername,
        isValid: validation.isValid && !isTaken,
        errors: validation.errors,
        suggestions,
        wasGenerated: true
    };
}

/**
 * Validates an existing username and provides suggestions if invalid
 */
export function validateExistingUsername(
    username: string,
    existingUsernames: Set<string> = new Set()
): UsernameProcessingResult {
    const validation = validateUsername(username);
    const isTaken = existingUsernames.has(username.toLowerCase());

    let suggestions: string[] = [];

    if (!validation.isValid || isTaken) {
        // Generate suggestions based on the provided username
        suggestions = generateUsernameSuggestions(username, existingUsernames, 5);
    }

    return {
        username,
        isValid: validation.isValid && !isTaken,
        errors: isTaken ? [...validation.errors, 'Username is already taken'] : validation.errors,
        suggestions,
        wasGenerated: false
    };
}

/**
 * Utility to check if a username meets all requirements (format + availability)
 */
export function isUsernameAvailable(username: string, existingUsernames: Set<string>): boolean {
    const validation = validateUsername(username);
    const isTaken = existingUsernames.has(username.toLowerCase());

    return validation.isValid && !isTaken;
}

/**
 * Formats username for display (preserves original case if provided)
 */
export function formatUsernameForDisplay(username: string, originalCase?: string): string {
    if (originalCase && originalCase.toLowerCase() === username.toLowerCase()) {
        return originalCase;
    }
    return username;
}

/**
 * Normalizes username for storage/comparison (lowercase)
 */
export function normalizeUsername(username: string): string {
    return username.toLowerCase();
}