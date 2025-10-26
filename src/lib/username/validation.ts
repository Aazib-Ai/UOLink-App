/**
 * Username validation utilities
 * Handles format validation, reserved username checking, and availability validation
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    suggestions?: string[];
}

// Reserved usernames that cannot be used by regular users
const RESERVED_USERNAMES = new Set([
    // System/Admin
    'admin', 'administrator', 'root', 'system', 'moderator', 'mod',

    // API/Technical
    'api', 'app', 'www', 'mail', 'email', 'ftp', 'blog', 'news',
    'support', 'help', 'info', 'contact', 'about', 'terms', 'privacy',

    // Common routes/pages
    'profile', 'profiles', 'user', 'users', 'account', 'settings',
    'dashboard', 'home', 'login', 'logout', 'register', 'signup',
    'signin', 'auth', 'oauth', 'callback', 'verify', 'reset',

    // UOLink specific
    'uolink', 'upload', 'note', 'notes', 'leaderboard', 'aura',
    'contributions', 'donate', 'hall-of-fame', 'complete-profile',

    // Common variations
    'test', 'demo', 'example', 'sample', 'null', 'undefined',
    'anonymous', 'guest', 'public', 'private', 'static', 'assets'
]);

/**
 * Validates username format according to system rules
 * Rules: 3-30 characters, alphanumeric + hyphens/underscores, 
 * must start and end with alphanumeric
 */
export function validateUsernameFormat(username: string): ValidationResult {
    const errors: string[] = [];

    if (!username) {
        errors.push('Username is required');
        return { isValid: false, errors };
    }

    // Length validation
    if (username.length < 3) {
        errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 30) {
        errors.push('Username must be no more than 30 characters long');
    }

    // Character validation - only alphanumeric, hyphens, underscores
    const validCharPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validCharPattern.test(username)) {
        errors.push('Username can only contain letters, numbers, hyphens, and underscores');
    }

    // Must start and end with alphanumeric
    const startsWithAlphanumeric = /^[a-zA-Z0-9]/.test(username);
    const endsWithAlphanumeric = /[a-zA-Z0-9]$/.test(username);

    if (!startsWithAlphanumeric) {
        errors.push('Username must start with a letter or number');
    }

    if (!endsWithAlphanumeric) {
        errors.push('Username must end with a letter or number');
    }

    // No consecutive special characters
    if (/[-_]{2,}/.test(username)) {
        errors.push('Username cannot contain consecutive hyphens or underscores');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Checks if a username is reserved and cannot be used
 */
export function isReservedUsername(username: string): boolean {
    return RESERVED_USERNAMES.has(username.toLowerCase());
}

/**
 * Validates if a username is reserved
 */
export function validateReservedUsername(username: string): ValidationResult {
    const isReserved = isReservedUsername(username);

    if (isReserved) {
        return {
            isValid: false,
            errors: ['This username is reserved and cannot be used'],
            suggestions: generateAlternativeSuggestions(username)
        };
    }

    return { isValid: true, errors: [] };
}

/**
 * Comprehensive username validation combining format and reserved checks
 */
export function validateUsername(username: string): ValidationResult {
    // First check format
    const formatResult = validateUsernameFormat(username);
    if (!formatResult.isValid) {
        return formatResult;
    }

    // Then check if reserved
    const reservedResult = validateReservedUsername(username);
    if (!reservedResult.isValid) {
        return reservedResult;
    }

    return { isValid: true, errors: [] };
}

/**
 * Generates alternative username suggestions when one is taken or reserved
 */
export function generateAlternativeSuggestions(baseUsername: string, count: number = 3): string[] {
    const suggestions: string[] = [];
    const cleanBase = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Add numeric suffixes
    for (let i = 1; i <= count; i++) {
        suggestions.push(`${cleanBase}${i}`);
    }

    // Add common suffixes
    const suffixes = ['user', 'official', 'real'];
    suffixes.slice(0, count - suggestions.length).forEach(suffix => {
        suggestions.push(`${cleanBase}-${suffix}`);
    });

    return suggestions.slice(0, count);
}

/**
 * Gets the list of reserved usernames (for testing/debugging)
 */
export function getReservedUsernames(): string[] {
    return Array.from(RESERVED_USERNAMES);
}