'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    ArrowLeft,
    Github,
    Linkedin,
    Instagram,
    Facebook,
    User,
    BookOpen,
    GraduationCap,
    Calendar,
    Sparkles,
} from 'lucide-react'
import Navbar from './Navbar'
import { getUserProfileByName, getAllNotesWithFilters } from '@/lib/firebase'
import { toTitleCase } from '@/lib/utils'
import PDFThumbnail from './PDFThumbnail'
import { getAuraTier, formatAura } from '@/lib/aura'

interface ProfileData {
    id: string
    fullName: string
    fullNameLower?: string
    profileSlug?: string
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
}

interface NoteData {
    id: string
    subject: string
    teacher: string
    module?: string
    semester: string
    name: string
    contributorName: string
    uploadedBy?: string
    fileUrl: string
    uploadedAt: any
}

const isPDFUrl = (url: string) => {
    const lowerUrl = url.toLowerCase()
    return lowerUrl.includes('.pdf') || lowerUrl.includes('r2.dev') || lowerUrl.includes('r2.cloudflarestorage.com')
}

export default function PublicProfile() {
    const { userName } = useParams()
    const router = useRouter()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [userNotes, setUserNotes] = useState<NoteData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    const auraInfo = useMemo(() => getAuraTier(profile?.aura ?? 0), [profile])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!userName || Array.isArray(userName)) {
                return
            }

            try {
                setLoading(true)
                setError(null)

                const decodedUserName = decodeURIComponent(userName)
                const profileData = await getUserProfileByName(decodedUserName)
                if (!profileData) {
                    setError('Profile not found')
                    return
                }

                const normalizedProfile: ProfileData = {
                    id: profileData.id,
                    fullName: profileData.fullName ?? decodedUserName,
                    fullNameLower: profileData.fullNameLower ?? profileData.fullName?.toLowerCase() ?? decodedUserName.toLowerCase(),
                    profileSlug: profileData.profileSlug,
                    major: profileData.major ?? '',
                    semester: typeof profileData.semester === 'string' ? profileData.semester : profileData.semester ? String(profileData.semester) : '',
                    section: profileData.section ?? '',
                    bio: profileData.bio ?? '',
                    about: profileData.about ?? '',
                    skills: Array.isArray(profileData.skills) ? profileData.skills : [],
                    githubUrl: profileData.githubUrl ?? '',
                    linkedinUrl: profileData.linkedinUrl ?? '',
                    instagramUrl: profileData.instagramUrl ?? '',
                    facebookUrl: profileData.facebookUrl ?? '',
                    profilePicture: profileData.profilePicture ?? null,
                    profileCompleted: Boolean(profileData.profileCompleted),
                    aura: profileData.aura,
                    createdAt: profileData.createdAt,
                    updatedAt: profileData.updatedAt,
                }

                setProfile(normalizedProfile)

                const notesResult = await getAllNotesWithFilters({
                    contributorName: normalizedProfile.fullName,
                    uploadedBy: profileData.id,
                })

                setUserNotes(notesResult.notes)
            } catch (err: any) {
                console.error('Error fetching profile:', err)
                setError(err.message || 'Failed to load profile')
            } finally {
                setLoading(false)
            }
        }

        fetchProfileData()
    }, [userName])

    const handleViewNote = (note: NoteData) => {
        const params = new URLSearchParams({
            url: note.fileUrl,
            id: note.id,
            subject: note.subject,
            teacher: note.teacher || note.module || '',
            contributor: note.contributorName,
        })

        router.push(`/note?${params.toString()}`)
    }

    const stats = useMemo(() => {
        if (!profile) {
            return { totalNotes: 0, uniqueSubjects: 0, uniqueTeachers: 0 }
        }

        const totalNotes = userNotes.length
        const uniqueSubjects = new Set(userNotes.map((note) => note.subject)).size
        const uniqueTeachers = new Set(userNotes.map((note) => note.teacher)).size

        return { totalNotes, uniqueSubjects, uniqueTeachers }
    }, [profile, userNotes])

    const badges = useMemo(() => {
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
    }, [profile, stats, auraInfo])

    const socialLinks = useMemo(() => {
        if (!profile) {
            return []
        }

        return [
            profile.githubUrl && { label: 'GitHub', icon: Github, url: profile.githubUrl },
            profile.linkedinUrl && { label: 'LinkedIn', icon: Linkedin, url: profile.linkedinUrl },
            profile.instagramUrl && { label: 'Instagram', icon: Instagram, url: profile.instagramUrl },
            profile.facebookUrl && { label: 'Facebook', icon: Facebook, url: profile.facebookUrl },
        ].filter(Boolean) as Array<{ label: string; icon: typeof Github; url: string }>
    }, [profile])

    const joinedDate =
        profile?.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    const showJoinDate = joinedDate && joinedDate !== 'Not set'
    const firstName = profile?.fullName?.split(' ')?.[0] ?? ''
    const major = profile?.major ? toTitleCase(profile.major) : null
    const semester = profile?.semester ? toTitleCase(profile.semester) : null
    const section = profile?.section ? profile.section.toUpperCase() : null
    const heroTagline = major
        ? `${major}${semester ? ` / ${semester}` : ''}${section ? ` / Section ${section}` : ''}`
        : `${firstName || profile?.fullName} is sharing knowledge with the community.`

    const heroStats = useMemo(() => {
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
    }, [profile, auraInfo, stats, semester, section])

    if (loading) {
        return (
            <>
                <Navbar />
                <main className="min-h-screen bg-[#f6f9ee]">
                    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 sm:px-6 lg:px-8">
                        <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-10">
                            <div className="flex flex-col items-center gap-4 text-center">
                                <div className="h-16 w-16 animate-pulse rounded-[28px] bg-[#e8f3d2]" />
                                <div className="h-4 w-40 animate-pulse rounded-full bg-[#f0f6e2]" />
                                <div className="h-3 w-56 animate-pulse rounded-full bg-[#f0f6e2]" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {[...Array(3)].map((_, index) => (
                                    <div key={index} className="h-20 animate-pulse rounded-2xl bg-[#f7fbe9]" />
                                ))}
                            </div>
                        </div>
                    </div>
                </main>
            </>
        )
    }

    if (error || !profile) {
        return (
            <>
                <Navbar />
                <main className="min-h-screen bg-[#f6f9ee]">
                    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-4 text-center sm:px-6">
                        <div className="w-full rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-10">
                            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3d2]">
                                <User className="h-6 w-6 text-[#90c639]" />
                            </div>
                            <h1 className="text-xl font-semibold text-[#1f2f10]">We couldn&apos;t load that profile</h1>
                            <p className="mt-3 text-sm text-[#4c5c3c]">
                                {error || 'This profile might be private or still getting set up. Try again later or head back to your notes.'}
                            </p>
                            <div className="mt-6 flex flex-wrap justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => router.back()}
                                    className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Go back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => router.push('/')}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7ab332]"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Explore Uolink
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </>
        )
    }

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#f6f9ee]">
                <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    <section className="mt-6 overflow-hidden rounded-3xl border border-lime-100 bg-white shadow-sm sm:mt-8">
                        <div className="bg-gradient-to-b from-[#f7fbe9] via-white to-white px-6 py-8 sm:px-8 lg:px-10">
                            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-start md:gap-8 md:text-left">
                                <div className="relative">
                                    <div className="relative h-24 w-24 overflow-hidden rounded-[28px] border border-lime-100 bg-[#e8f3d2] text-[#1f2f10] shadow-inner md:h-28 md:w-28">
                                        {profile.profilePicture ? (
                                            <img src={profile.profilePicture} alt={`${profile.fullName}'s profile`} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold md:text-3xl">
                                                {(firstName || profile.fullName)[0]}
                                            </div>
                                        )}
                                    </div>
                                    {auraInfo?.tier?.name && (
                                        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#1f2f10] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                                            {auraInfo.tier.name}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col items-center md:items-start">
                                    {showJoinDate && (
                                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-[#5f7050] ring-1 ring-lime-100">
                                            <Calendar className="h-3 w-3 text-[#90c639]" />
                                            Joined {joinedDate}
                                        </div>
                                    )}
                                    <h1 className="mt-4 text-2xl font-semibold text-[#1f2f10] sm:text-3xl">{profile.fullName}</h1>
                                    <p className="mt-2 text-sm font-medium uppercase tracking-wide text-[#5f7050]">{heroTagline}</p>
                                    <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#334125]">
                                        {profile.bio || `Say hi to ${firstName || profile.fullName}. They are busy sharing knowledge with Uolink.`}
                                    </p>
                                    {badges.length > 0 && (
                                        <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2 md:justify-start">
                                            {badges.map((badge) => (
                                                <span
                                                    key={badge.label}
                                                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badge.classes}`}
                                                >
                                                    {badge.label}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {socialLinks.length > 0 && (
                                <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
                                    {socialLinks.map((link) => (
                                        <a
                                            key={link.label}
                                            href={link.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                                        >
                                            <link.icon className="h-4 w-4 text-[#90c639]" />
                                            {link.label}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {heroStats.length > 0 && (
                        <section className="mt-6 rounded-3xl border border-lime-100 bg-white px-4 py-5 shadow-sm sm:mt-8 sm:px-8">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {heroStats.map((stat) => (
                                    <div key={stat.label} className="rounded-2xl bg-[#f7fbe9] px-4 py-4 text-left sm:px-5">
                                        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-[#5f7050]">
                                            <span>{stat.label}</span>
                                            <stat.icon className="h-4 w-4 text-[#90c639]" />
                                        </div>
                                        <p className="mt-3 text-xl font-semibold text-[#1f2f10] sm:text-2xl">{stat.value}</p>
                                        {stat.hint && <p className="mt-1 text-xs text-[#4c5c3c]">{stat.hint}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="mt-6 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                            <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                                <User className="h-5 w-5 text-[#90c639]" />
                                About {firstName || profile.fullName}
                            </div>
                            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#334125]">
                                {profile.about || profile.bio || `${firstName || profile.fullName} hasn't added an about section yet.`}
                            </p>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                                <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                                    <GraduationCap className="h-5 w-5 text-[#90c639]" />
                                    Academic Snapshot
                                </div>
                                <dl className="mt-4 space-y-3 text-sm text-[#4c5c3c]">
                                    <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                                        <dt>Major</dt>
                                        <dd className="font-medium text-[#1f2f10]">{major ?? 'Not set'}</dd>
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                                        <dt>Semester</dt>
                                        <dd className="font-medium text-[#1f2f10]">{semester ?? 'Not set'}</dd>
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl bg-[#f7fbe9] px-4 py-3">
                                        <dt>Section</dt>
                                        <dd className="font-medium text-[#1f2f10]">{section ?? 'Not set'}</dd>
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-lime-100">
                                        <dt>Contributions</dt>
                                        <dd className="text-right text-sm text-[#334125]">
                                            {stats.totalNotes} note{stats.totalNotes === 1 ? '' : 's'} / {stats.uniqueSubjects} subject{stats.uniqueSubjects === 1 ? '' : 's'}
                                        </dd>
                                    </div>
                                    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 ring-1 ring-lime-100">
                                        <dt>Aura score</dt>
                                        <dd className="font-medium text-[#1f2f10]">{formatAura(auraInfo.aura)}</dd>
                                    </div>
                                </dl>
                            </div>

                            {profile.skills?.length > 0 && (
                                <div className="rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:p-8">
                                    <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                                        <Sparkles className="h-5 w-5 text-[#90c639]" />
                                        Skills &amp; Tools
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {profile.skills.map((skill) =>
                                            skill ? (
                                                <span
                                                    key={skill}
                                                    className="inline-flex items-center rounded-full border border-lime-100 bg-[#f7fbe9] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#5f7050]"
                                                >
                                                    {skill}
                                                </span>
                                            ) : null
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="mt-6 rounded-3xl border border-lime-100 bg-white p-6 shadow-sm sm:mt-8 sm:p-8 lg:p-10">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                                <BookOpen className="h-5 w-5 text-[#90c639]" />
                                Shared Notes
                            </div>
                            <div className="text-sm text-[#4c5c3c]">
                                {stats.totalNotes} {stats.totalNotes === 1 ? 'note' : 'notes'}
                            </div>
                        </div>

                        {userNotes.length === 0 ? (
                            <div className="mt-6 text-center sm:mt-10">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-lime-200 bg-[#f7fbe9]">
                                    <BookOpen className="h-7 w-7 text-[#90c639]" />
                                </div>
                                <h3 className="mt-4 text-base font-medium text-[#1f2f10]">No notes yet</h3>
                                <p className="mt-2 text-sm text-[#4c5c3c]">
                                    {firstName || profile.fullName} hasn&apos;t shared any notes just yet.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:snap-none lg:grid-cols-3 xl:grid-cols-4">
                                {userNotes.map((note) => (
                                    <button
                                        key={note.id}
                                        type="button"
                                        onClick={() => handleViewNote(note)}
                                        className="group flex h-full min-w-[16rem] flex-col overflow-hidden rounded-2xl border border-lime-100 bg-white text-left shadow-sm transition hover:border-[#90c639] hover:shadow-md sm:min-w-0"
                                    >
                                        <div className="relative aspect-[4/3] w-full border-b border-lime-50 bg-[#f7fbe9]">
                                            {isPDFUrl(note.fileUrl) ? (
                                                <PDFThumbnail
                                                    url={note.fileUrl}
                                                    width={isMobile ? 160 : 300}
                                                    height={isMobile ? 120 : 210}
                                                    className="!h-full !w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase tracking-wide text-[#7a8f5d]">
                                                    <BookOpen className="mr-2 h-5 w-5" />
                                                    Preview
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-1 flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4">
                                            <h3 className="text-sm font-semibold text-[#1f2f10] transition group-hover:text-[#90c639]">
                                                {toTitleCase(note.subject) || 'Untitled subject'}
                                            </h3>
                                            <span className="inline-flex w-fit items-center rounded-full border border-lime-100 bg-[#f3f8e7] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#5f7050]">
                                                {note.semester || 'Not set'}
                                            </span>
                                            <p className="text-xs text-[#4c5c3c]">
                                                <span className="font-medium">Teacher:</span> {toTitleCase(note.teacher || note.module || '') || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-[#5f7050] line-clamp-1">{note.name}</p>
                                            <div className="mt-auto flex items-center justify-between text-xs text-[#5f7050]">
                                                <span>
                                                    {note.uploadedAt?.toDate?.()?.toLocaleDateString('en-GB', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    }) ??
                                                        new Date().toLocaleDateString('en-GB', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric',
                                                        })}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[#90c639]">
                                                    <Sparkles className="h-3 w-3" />
                                                    Open
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </>
    )
}
