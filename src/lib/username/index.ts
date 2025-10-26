/**
 * Username utilities - validation and generation
 * 
 * This module provides utilities for:
 * - Validating username format and reserved names
 * - Generating usernames from display names
 * - Handling username conflicts and suggestions
 */

// Validation exports
export {
    validateUsername,
    validateUsernameFormat,
    validateReservedUsername,
    isReservedUsername,
    generateAlternativeSuggestions,
    getReservedUsernames,
    type ValidationResult
} from './validation';

// Generation exports
export {
    generateBaseUsername,
    generateUsernameWithConflicts,
    generateUsernameSuggestions,
    sanitizeDisplayName,
    extractUsernameComponents,
    defaultConflictResolver,
    type GenerationOptions
} from './generation';

// Combined utilities
export * from './utils';