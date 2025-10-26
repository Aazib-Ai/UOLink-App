'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import Navbar from './Navbar'
import { getUserByUsernameOnly, getNotesForProfile } from '@/lib/firebase'
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
import '@/styles/skeletons.css'

export default function PublicProfile() {
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

    const hasMoreNotes = displayedNotesLength < filteredNotesLength

    const loadMoreNotes = useCallback(() => {
        setDisplayedCount(prev => Math.min(prev + 5, filteredNotesLength))
    }, [filteredNotesLength])

    // Reset displayed count when filters change
    useEffect(() => {
        setDisplayedCount(5)
    }, [searchTerm, selectedSubject])

    useEffect(() => {
        const fetchProfileData = async () => {
            if (!userName || Array.isArray(userName)) {
                return
            }

            try {
                setLoading(true)
                setError(null)
                setUserNotes([])

                const decodedUserName = decodeURIComponent(userName)
                const profileData = await getUserByUsernameOnly(decodedUserName)
                if (!profileData) {
                    setError('Profile not found')
                    return
                }

                const normalizedProfile: ProfileData = {
                    id: profileData.id,
                    fullName: profileData.fullName ?? decodedUserName,
                    username: profileData.username,
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

                const notesResult = await getNotesForProfile({
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
