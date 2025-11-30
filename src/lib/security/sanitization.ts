// Lightweight output sanitization helpers for UI rendering
// Focus: escape HTML, clamp length, and compute minimal display fields

export interface SanitizationOptions {
    maxLength?: number
}

const DEFAULT_MAX = 1000

export function escapeHtml(input: string): string {
    if (!input) return ''
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function safeText(input: string, opts: SanitizationOptions = {}): string {
    const max = Math.max(1, opts.maxLength ?? DEFAULT_MAX)
    const trimmed = (input || '').replace(/[\u0000-\u001F\u007F]/g, '').trim()
    const clamped = trimmed.length > max ? trimmed.slice(0, max) : trimmed
    return escapeHtml(clamped)
}

export function safePlainText(input: string, opts: SanitizationOptions = {}): string {
    const max = Math.max(1, opts.maxLength ?? DEFAULT_MAX)
    const trimmed = (input || '').replace(/[\u0000-\u001F\u007F]/g, '').trim()
    return trimmed.length > max ? trimmed.slice(0, max) : trimmed
}

export function getEmailPrefix(email?: string | null): string | undefined {
    if (!email || typeof email !== 'string') return undefined
    const at = email.indexOf('@')
    if (at <= 0) return undefined
    const prefix = email.slice(0, at).trim()
    return prefix || undefined
}

export function getInitialsFromName(name?: string | null): string | undefined {
    const n = (name || '').trim()
    if (!n) return undefined
    const parts = n.split(/\s+/).filter(Boolean)
    if (!parts.length) return undefined
    const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('')
    return initials || undefined
}

export function computeDisplayName(
    userDisplayName?: string | null,
    userName?: string | null,
    userUsername?: string | null,
    emailPrefix?: string | null | undefined
): string {
    const preferred = (userDisplayName || userName || userUsername || emailPrefix || 'User').trim()
    return preferred.charAt(0).toUpperCase() + preferred.slice(1)
}

// Minimize and sanitize a user profile object for public exposure
// - Removes full email address if present
// - Adds displayName, emailPrefix, and initials derived from available fields
// - Ensures text fields are clamped and escaped
export function toPublicProfile(profile: any): any {
    if (!profile || typeof profile !== 'object') return {}

    const emailPrefix = getEmailPrefix(profile.email)
    const displayName = computeDisplayName(
        profile.displayName,
        profile.fullName,
        profile.username,
        emailPrefix
    )
    const initials = getInitialsFromName(profile.fullName) || getInitialsFromName(displayName) || undefined

    const safe = (v: any, max?: number) => (typeof v === 'string' ? safeText(v, { maxLength: max }) : v)

    const minimized: Record<string, any> = {
        id: profile.id,
        username: safe(profile.username, 100),
        displayName: safe(displayName, 100),
        emailPrefix: emailPrefix ? safe(emailPrefix, 100) : undefined,
        initials,
        // Public profile fields (text sanitized defensively)
        major: typeof profile.major === 'string' ? safePlainText(profile.major, { maxLength: 100 }) : profile.major,
        semester: typeof profile.semester === 'string' ? safePlainText(profile.semester, { maxLength: 20 }) : profile.semester,
        section: typeof profile.section === 'string' ? safePlainText(profile.section, { maxLength: 10 }) : profile.section,
        bio: safe(profile.bio),
        about: safe(profile.about),
        skills: Array.isArray(profile.skills) ? profile.skills.map((s: any) => safe(s, 50)).filter(Boolean) : [],
        githubUrl: safe(profile.githubUrl, 2048),
        linkedinUrl: safe(profile.linkedinUrl, 2048),
        instagramUrl: safe(profile.instagramUrl, 2048),
        facebookUrl: safe(profile.facebookUrl, 2048),
        profilePicture: typeof profile.profilePicture === 'string' ? safe(profile.profilePicture, 2048) : null,
        profileCompleted: Boolean(profile.profileCompleted),
        aura: profile.aura,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    }

    // Explicitly remove sensitive fields
    delete minimized.email
    delete minimized.fullNameLower
    delete minimized.profileSlug

    return minimized
}

