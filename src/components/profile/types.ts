export interface ProfileData {
    id: string
    fullName: string
    displayName?: string
    emailPrefix?: string
    initials?: string
    username?: string
    major: string
    semester: string
    section: string
    bio: string
    about: string
    skills: string[]
    githubUrl: string
    linkedinUrl: string
    instagramUrl: string
    facebookUrl: string
    profilePicture: string | null
    profileCompleted: boolean
    aura?: number
    createdAt?: any
    updatedAt?: any
    notesCount?: number
}

export interface NoteData {
    id: string
    subject: string
    teacher: string
    module?: string
    semester: string
    name: string
    contributorName: string
    contributorDisplayName?: string
    uploaderUsername?: string | null
    uploadedBy?: string
    fileUrl: string
    uploadedAt: any
}

export interface SocialLink {
    label: string
    icon: React.ComponentType<{ className?: string }>
    url: string
}

export interface Badge {
    label: string
    classes: string
}

export interface HeroStat {
    label: string
    value: string
    hint?: string
    icon: React.ComponentType<{ className?: string }>
}
