'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import Navbar from './Navbar'
import { getNotesForProfile } from '@/lib/firebase'
import { ProfileCacheProvider, useProfileByUsername } from '@/context/ProfileCacheContext'
import { getAuraTier } from '@/lib/aura'
import { ProfileData, NoteData } from './profile/types'
import {
    calculateStats,
    calculateBadges,
    getSocialLinks,
    getHeroStats,
    getProfileDisplayInfo
} from './profile/utils'
import ProfileHeader from './profile/ProfileHeader'
import ProfileStats from './profile/ProfileStats'
import ProfileAbout from './profile/ProfileAbout'
import ProfileFilters from './profile/ProfileFilters'
import ProfileNotesList from './profile/ProfileNotesList'
import { ProfileLoading, ProfileError } from './profile/ProfileStates'
import { PageCacheProvider, useNavigationState } from '@/lib/cache'
import '@/styles/skeletons.css'

export default function PublicProfile() {
    return (
        <PageCacheProvider config={{
            maxMemoryBytes: 10 * 1024 * 1024, // 10MB for profiles
            maxIndexedDBBytes: 20 * 1024 * 1024, // 20MB persistent
            staleTTL: 10 * 60 * 1000, // 10 minutes stale time
        }}>
            <ProfileCacheProvider>
                <PublicProfileContent />
            </ProfileCacheProvider>
        </PageCacheProvider>
    )
}

function PublicProfileContent() {
    const { userName } = useParams()
    const router = useRouter()
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [userNotes, setUserNotes] = useState<NoteData[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedSubject, setSelectedSubject] = useState('')
    const [showSubjectDropdown, setShowSubjectDropdown] = useState(false)
    const [displayedCount, setDisplayedCount] = useState(5)
    const [lastDoc, setLastDoc] = useState<any>(null)
    const [serverHasMore, setServerHasMore] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)

    const auraInfo = useMemo(() => getAuraTier(profile?.aura ?? 0), [profile])

    // Get unique subjects for filtering
    const uniqueSubjects = useMemo(() => {
        const subjects = [...new Set(userNotes.map(note => note.subject))].filter(Boolean)
        return subjects.sort()
    }, [userNotes])

    // Filter notes based on search and subject filter
    const filteredNotes = useMemo(() => {
        let filtered = userNotes

        // Filter by search term
        if (searchTerm.trim()) {
            const lowerSearchTerm = searchTerm.toLowerCase()
            filtered = filtered.filter(note =>
                note.subject.toLowerCase().includes(lowerSearchTerm) ||
                note.name.toLowerCase().includes(lowerSearchTerm) ||
                (note.teacher && note.teacher.toLowerCase().includes(lowerSearchTerm)) ||
                (note.module && note.module.toLowerCase().includes(lowerSearchTerm))
            )
        }

        // Filter by subject
        if (selectedSubject) {
            filtered = filtered.filter(note => note.subject === selectedSubject)
        }

        return filtered
    }, [userNotes, searchTerm, selectedSubject])

    // Progressive loading - show 5 notes initially, load more on demand
    const displayedNotes = useMemo(() => {
        return filteredNotes.slice(0, displayedCount)
    }, [filteredNotes, displayedCount])

    const filteredNotesLength = filteredNotes.length
    const displayedNotesLength = displayedNotes.length

    const hasMoreNotes = (displayedNotesLength < filteredNotesLength) || serverHasMore

    const loadMoreNotes = useCallback(async () => {
        // First consume local filtered notes
        const remainingLocal = filteredNotesLength - displayedNotesLength
        if (remainingLocal > 0) {
            setDisplayedCount(prev => Math.min(prev + 5, filteredNotesLength))
            return
        }

        // If no local remaining but server indicates more, fetch next page
        if (!serverHasMore || !profile?.id) return
        setIsLoadingMore(true)
        try {
            const next = await getNotesForProfile({
                uploadedBy: profile.id,
                pageSize: 10,
                lastDocSnapshot: lastDoc,
            })
            setUserNotes(prev => [...prev, ...next.notes])
            setLastDoc(next.lastDocSnapshot)
            setServerHasMore(next.hasMore)
            // After fetching, allow UI to display 5 more
            setDisplayedCount(prev => prev + 5)
        } catch (err) {
            console.error('Failed to load more profile notes:', err)
        } finally {
            setIsLoadingMore(false)
        }
    }, [filteredNotesLength, displayedNotesLength, serverHasMore, profile?.id, lastDoc])

    // Enable state persistence for search and filters
    useNavigationState({
        selectors: {
            search: '#profile-search-input',
            filters: ['#subject-filter-dropdown'],
        },
        restoreOnMount: true,
        captureOnUnmount: true,
    })

    // Reset displayed count when filters change
    useEffect(() => {
        setDisplayedCount(5)
    }, [searchTerm, selectedSubject])

    const decodedUserName = useMemo(() => {
        if (!userName || Array.isArray(userName)) return ''
        return decodeURIComponent(userName)
    }, [userName])
    const { profile: cachedProfile, reload } = useProfileByUsername(decodedUserName)

    useEffect(() => {
        if (!decodedUserName) return
        setLoading(true)
        setError(null)
        setUserNotes([])
        void reload()
    }, [decodedUserName, reload])

    useEffect(() => {
        const profileData: any = cachedProfile
        if (!profileData) return
        const displayName =
            (typeof profileData.displayName === 'string' && profileData.displayName) ||
            (typeof profileData.fullName === 'string' && profileData.fullName) ||
            (typeof profileData.username === 'string' && profileData.username) ||
            decodedUserName
        const normalizedProfile: ProfileData = {
            id: profileData.id,
            fullName: String(displayName),
            displayName: typeof displayName === 'string' ? displayName : undefined,
            emailPrefix: typeof profileData.emailPrefix === 'string' ? profileData.emailPrefix : undefined,
            initials: typeof profileData.initials === 'string' ? profileData.initials : undefined,
            username: typeof profileData.username === 'string' ? profileData.username : undefined,
            major: typeof profileData.major === 'string' ? profileData.major : '',
            semester: typeof profileData.semester === 'string' ? profileData.semester : profileData.semester ? String(profileData.semester) : '',
            section: typeof profileData.section === 'string' ? profileData.section : '',
            bio: typeof profileData.bio === 'string' ? profileData.bio : '',
            about: typeof profileData.about === 'string' ? profileData.about : '',
            skills: Array.isArray(profileData.skills) ? profileData.skills.filter((s: unknown): s is string => typeof s === 'string') : [],
            githubUrl: typeof profileData.githubUrl === 'string' ? profileData.githubUrl : '',
            linkedinUrl: typeof profileData.linkedinUrl === 'string' ? profileData.linkedinUrl : '',
            instagramUrl: typeof profileData.instagramUrl === 'string' ? profileData.instagramUrl : '',
            facebookUrl: typeof profileData.facebookUrl === 'string' ? profileData.facebookUrl : '',
            profilePicture: typeof profileData.profilePicture === 'string' ? profileData.profilePicture : null,
            profileCompleted: Boolean(profileData.profileCompleted),
            aura: typeof profileData.aura === 'number' ? profileData.aura : undefined,
            notesCount: typeof profileData.notesCount === 'number' ? profileData.notesCount : undefined,
            createdAt: profileData.createdAt,
            updatedAt: profileData.updatedAt,
        }
        setProfile(normalizedProfile)
        void (async () => {
            const notesResult = await getNotesForProfile({
                uploadedBy: profileData.id,
                pageSize: 10,
            })
            setUserNotes(notesResult.notes)
            setLastDoc(notesResult.lastDocSnapshot)
            setServerHasMore(notesResult.hasMore)
            setLoading(false)
        })()
    }, [cachedProfile, decodedUserName])

    const handleViewNote = (note: NoteData) => {
        const contributorDisplayName = note.contributorDisplayName || note.contributorName || ''
        const contributorUsername =
            typeof note.uploaderUsername === 'string' ? note.uploaderUsername : ''

        const params = new URLSearchParams({
            url: note.fileUrl,
            id: note.id,
            subject: note.subject,
            teacher: note.teacher || note.module || '',
            contributor: contributorDisplayName,
        })

        if (contributorDisplayName) {
            params.set('contributorDisplayName', contributorDisplayName)
        }

        if (contributorUsername) {
            params.set('contributorUsername', contributorUsername)
        }

        router.push(`/note?${params.toString()}`)
    }

    const clearFilters = () => {
        setSearchTerm('')
        setSelectedSubject('')
    }

    // Calculate derived data
    const stats = useMemo(() => calculateStats(profile, userNotes), [profile, userNotes])
    const badges = useMemo(() => calculateBadges(profile, stats, auraInfo), [profile, stats, auraInfo])
    const socialLinks = useMemo(() => getSocialLinks(profile), [profile])
    const { joinedDate, showJoinDate, firstName, major, semester, section, heroTagline } = useMemo(
        () => getProfileDisplayInfo(profile),
        [profile]
    )
    const heroStats = useMemo(
        () => getHeroStats(profile, auraInfo, stats, semester, section),
        [profile, auraInfo, stats, semester, section]
    )

    if (loading) {
        return <ProfileLoading Navbar={Navbar} />
    }

    if (error || !profile) {
        return <ProfileError Navbar={Navbar} error={error} />
    }

    return (
        <div className="w-full">
            <Navbar />
            <main className="w-full bg-[#f6f9ee] content-fade-in">
                <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>

                    {/* Profile Header */}
                    <div className="mt-6">
                        <ProfileHeader
                            profile={profile}
                            badges={badges}
                            socialLinks={socialLinks}
                            joinedDate={joinedDate}
                            showJoinDate={showJoinDate}
                            firstName={firstName}
                            heroTagline={heroTagline}
                        />
                    </div>

                    {/* Profile Stats */}
                    <div className="mt-6">
                        <ProfileStats heroStats={heroStats} />
                    </div>

                    {/* Profile About */}
                    <div className="mt-6">
                        <ProfileAbout
                            profile={profile}
                            firstName={firstName}
                            major={major}
                            semester={semester}
                            section={section}
                            stats={stats}
                            aura={auraInfo.aura}
                        />
                    </div>

                    {/* Notes Section - Fixed Layout */}
                    <div className="mt-6">
                        <div className="w-full rounded-3xl border border-lime-100 bg-white shadow-sm">
                            {/* Header */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lime-50 p-6 sm:p-8 lg:p-10">
                                <div className="flex items-center gap-2 text-lg font-semibold text-[#1f2f10]">
                                    <BookOpen className="h-5 w-5 text-[#90c639]" />
                                    Shared Notes
                                </div>
                                <div className="text-sm text-[#4c5c3c]">
                                    {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
                                    {filteredNotes.length !== stats.totalNotes && (
                                        <span className="text-[#5f7050]"> of {stats.totalNotes}</span>
                                    )}
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="border-b border-lime-50 px-6 py-4 sm:px-8 lg:px-10">
                                <ProfileFilters
                                    searchTerm={searchTerm}
                                    setSearchTerm={setSearchTerm}
                                    selectedSubject={selectedSubject}
                                    setSelectedSubject={setSelectedSubject}
                                    uniqueSubjects={uniqueSubjects}
                                    showSubjectDropdown={showSubjectDropdown}
                                    setShowSubjectDropdown={setShowSubjectDropdown}
                                    userNotesLength={userNotes.length}
                                />
                            </div>

                            {/* Notes Content - Fixed Height */}
                            <div className="p-6 sm:p-8 lg:p-10">
                                <div
                                    className="w-full"
                                    style={{ minHeight: '500px' }}
                                >
                                    <ProfileNotesList
                                        filteredNotes={filteredNotes}
                                        displayedNotes={displayedNotes}
                                        hasMoreNotes={hasMoreNotes}
                                        loadMoreNotes={loadMoreNotes}
                                        handleViewNote={handleViewNote}
                                        userNotesLength={userNotes.length}
                                        firstName={firstName}
                                        fullName={profile.fullName}
                                        searchTerm={searchTerm}
                                        selectedSubject={selectedSubject}
                                        clearFilters={clearFilters}
                                        isLoadingMore={isLoadingMore}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
