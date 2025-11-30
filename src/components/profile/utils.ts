import { NoteData, ProfileData, Badge, SocialLink, HeroStat } from './types'
import { Github, Linkedin, Instagram, Facebook, Sparkles, BookOpen, GraduationCap } from 'lucide-react'
import { getAuraTier, formatAura } from '@/lib/aura'
import { toTitleCase } from '@/lib/utils'
import { resolveUploadDescriptorByUrl } from '@/constants/uploadFileTypes'

export const isPDFUrl = (url: string): boolean => {
    if (!url) {
        return false
    }

    const descriptor = resolveUploadDescriptorByUrl(url)
    if (descriptor) {
        return descriptor.extension === 'pdf'
    }

    return url.toLowerCase().includes('.pdf')
}

export const calculateStats = (profile: ProfileData | null, userNotes: NoteData[]) => {
    if (!profile) {
        return { totalNotes: 0, uniqueSubjects: 0, uniqueTeachers: 0 }
    }

    const totalNotes = typeof profile.notesCount === 'number' ? profile.notesCount : userNotes.length
    const uniqueSubjects = new Set(userNotes.map((note) => note.subject)).size
    const uniqueTeachers = new Set(userNotes.map((note) => note.teacher)).size

    return { totalNotes, uniqueSubjects, uniqueTeachers }
}

export const calculateBadges = (profile: ProfileData | null, stats: ReturnType<typeof calculateStats>, auraInfo: ReturnType<typeof getAuraTier>): Badge[] => {
    if (!profile) {
        return []
    }

    const earned: Array<{ label: string; classes: string }> = []

    if (stats.totalNotes >= 20) {
        earned.push({ label: 'Note Machine', classes: 'border-emerald-200 bg-emerald-50 text-emerald-700' })
    } else if (stats.totalNotes >= 5) {
        earned.push({ label: 'Rising Contributor', classes: 'border-emerald-200 bg-emerald-50 text-emerald-600' })
    }

    if (stats.uniqueSubjects >= 5) {
        earned.push({ label: 'Subject Explorer', classes: 'border-sky-200 bg-sky-50 text-sky-600' })
    } else if (stats.uniqueSubjects >= 3) {
        earned.push({ label: 'Across The Board', classes: 'border-indigo-200 bg-indigo-50 text-indigo-600' })
    }

    if (auraInfo.aura >= 2500) {
        earned.push({ label: 'GOAT Status', classes: 'border-purple-300 bg-purple-50 text-purple-600' })
    } else if (auraInfo.aura >= 1000) {
        earned.push({ label: 'Main Character Energy', classes: 'border-amber-300 bg-amber-50 text-amber-600' })
    } else if (auraInfo.aura >= 500) {
        earned.push({ label: 'Community Favourite', classes: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600' })
    }

    if (earned.length === 0) {
        earned.push({ label: 'Aura Explorer', classes: 'border-slate-200 bg-slate-50 text-slate-600' })
    }

    return earned
}

export const getSocialLinks = (profile: ProfileData | null): SocialLink[] => {
    if (!profile) {
        return []
    }

    return [
        profile.githubUrl && { label: 'GitHub', icon: Github, url: profile.githubUrl },
        profile.linkedinUrl && { label: 'LinkedIn', icon: Linkedin, url: profile.linkedinUrl },
        profile.instagramUrl && { label: 'Instagram', icon: Instagram, url: profile.instagramUrl },
        profile.facebookUrl && { label: 'Facebook', icon: Facebook, url: profile.facebookUrl },
    ].filter(Boolean) as SocialLink[]
}

export const getHeroStats = (
    profile: ProfileData | null,
    auraInfo: ReturnType<typeof getAuraTier>,
    stats: ReturnType<typeof calculateStats>,
    semester: string | null,
    section: string | null
): HeroStat[] => {
    if (!profile) {
        return []
    }

    return [
        {
            label: 'Aura',
            value: formatAura(auraInfo.aura),
            hint: auraInfo.tier.name,
            icon: Sparkles,
        },
        {
            label: 'Shared notes',
            value: stats.totalNotes.toString(),
            hint: `${stats.uniqueSubjects} subject${stats.uniqueSubjects === 1 ? '' : 's'}`,
            icon: BookOpen,
        },
        {
            label: 'Semester',
            value: semester ?? 'Not set',
            hint: section ? `Section ${section}` : 'Section not set',
            icon: GraduationCap,
        },
    ]
}

export const getProfileDisplayInfo = (profile: ProfileData | null) => {
    const joinedDate =
        profile?.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    const showJoinDate = joinedDate && joinedDate !== 'Not set'
    const baseName = profile?.displayName || profile?.fullName || profile?.username || ''
    const firstName = baseName?.split(' ')?.[0] ?? ''
    const major = profile?.major
        ? (() => {
            const s = (profile.major || '').trim()
            if (!s) return ''
            const spaced = s.replace(/\s*&\s*/g, ' & ').replace(/\s*\/\s*/g, ' / ')
            const parts = spaced.split(/\s+/)
            return parts
                .map((p) => (p === '&' || p === '/' ? p : p.charAt(0).toUpperCase() + p.substring(1).toLowerCase()))
                .join(' ')
          })()
        : null
    const semester = profile?.semester ? toTitleCase(profile.semester) : null
    const section = profile?.section ? profile.section.toUpperCase() : null
    const heroTagline = major
        ? `${major}${semester ? ` / ${semester}` : ''}${section ? ` / Section ${section}` : ''}`
        : `${firstName || baseName} is sharing knowledge with the community.`

    return {
        joinedDate,
        showJoinDate,
        firstName,
        major,
        semester,
        section,
        heroTagline
    }
}
