'use client'

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowUp } from "lucide-react"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/contexts/AuthContext"
import { useDashboardState } from "@/hooks/useDashboardState"
import { useSavedNotesOptimized } from "@/hooks/useSavedNotesOptimized"
import { useProfileData } from "@/hooks/useProfileData"
import { DONATORS } from "./dashboard/constants"
import { DashboardFilters } from "./dashboard/DashboardFilters"
import { DashboardSearch } from "./dashboard/DashboardSearch"
import { DashboardSort } from "./dashboard/DashboardSort"
import { NoteCard } from "./dashboard/NoteCard"
import NotesLoader from "./NotesLoader"
import DeleteConfirmModalLazy from "./DeleteConfirmModalLazy"
import { MorphingTextLazy } from "@/components/ui/morphing-text-lazy"
import Link from "next/link"
import Skeleton from "react-loading-skeleton"
import "react-loading-skeleton/dist/skeleton.css"
import "@/styles/loader.css"

function DashboardRefactored() {
  const { user } = useAuth()
  const router = useRouter()

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Dashboard state
  const dashboard = useDashboardState()

  // Saved notes management
  const savedNotes = useSavedNotesOptimized(dashboard.applyNotePatch)

  // Profile data
  const profileData = useProfileData(dashboard.notes)

  // Delete confirmation modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string; subject: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle view note
  const handleViewNote = useCallback((note: any) => {
    const noteUrl = typeof note.fileUrl === "string" ? note.fileUrl : ""

    if (!noteUrl) {
      alert("Invalid Note URL")
      return
    }

    const contributorUserId = typeof note.uploadedBy === 'string' ? note.uploadedBy : ''
    const auraDetails = contributorUserId ? profileData.profileAura[contributorUserId] : undefined
    const teacherValue = note.teacher || note.module || ''
    const contributorDisplayName = note.contributorDisplayName || note.contributorName || ''
    const contributorUsername =
      (contributorUserId && profileData.profileUsernames[contributorUserId]) ||
      (typeof note.uploaderUsername === 'string' ? note.uploaderUsername : '')
    const params = new URLSearchParams({
      url: noteUrl,
      id: note.id ?? '',
      subject: note.subject ?? '',
      teacher: teacherValue ?? '',
      contributor: contributorDisplayName,
    })

    if (auraDetails) {
      params.set('aura', String(auraDetails.aura))
    }

    const credibilityForParam = typeof note.credibilityScore === 'number' ? note.credibilityScore : 0
    params.set('credibilityScore', String(credibilityForParam))

    if (note.storageProvider) {
      params.set('storageProvider', note.storageProvider)
    }

    if (note.storageKey) {
      params.set('storageKey', note.storageKey)
    }

    if (note.storageBucket) {
      params.set('storageBucket', note.storageBucket)
    }

    if (contributorDisplayName) {
      params.set('contributorDisplayName', contributorDisplayName)
    }

    if (contributorUsername) {
      params.set('contributorUsername', contributorUsername)
    }

    const url = `/note?${params.toString()}`

    if (typeof window !== 'undefined') {
      try {
        router.push(url)
        return
      } catch (error) {
        console.error('[Dashboard] Failed to navigate with router, falling back', error)
      }

      window.location.assign(url)
    }
  }, [router, profileData.profileAura, profileData.profileUsernames])

  // Handle delete
  const handleDelete = useCallback((id: string, title: string, subject: string) => {
    setNoteToDelete({ id, title, subject })
    setIsDeleteModalOpen(true)
  }, [])

  // Handle confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) {
      return
    }

    if (!auth.currentUser) {
      dashboard.setError('You need to sign in to delete notes.')
      return
    }

    try {
      setIsDeleting(true)
      const token = await auth.currentUser.getIdToken()
      const response = await fetch(`/api/upload?noteId=${encodeURIComponent(noteToDelete.id)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error || 'Failed to delete the note. Please try again.'
        throw new Error(message)
      }

      dashboard.setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteToDelete.id))
      console.log(`Note with ID: ${noteToDelete.id} has been deleted successfully.`)

      setIsDeleteModalOpen(false)
      setNoteToDelete(null)
    } catch (error) {
      console.error("Error deleting note:", error)
      dashboard.setError(error instanceof Error ? error.message : 'Failed to delete the note. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }, [noteToDelete, dashboard])

  // Handle share
  const handleShare = useCallback((noteUrl: string, noteId: string, noteSubject: string, noteTeacher: string, noteContributorName: string) => {
    const matchingNote = dashboard.notes.find((item) => item.id === noteId)
    const contributorDisplayName =
      matchingNote?.contributorDisplayName || noteContributorName || 'Contributor'
    const contributorUsername =
      (matchingNote?.uploaderUsername && matchingNote.uploaderUsername.trim()) || ''

    const params = new URLSearchParams({
      url: noteUrl,
      id: noteId,
      subject: noteSubject,
      teacher: noteTeacher,
      contributor: contributorDisplayName,
      contributorDisplayName,
    })

    if (contributorUsername) {
      params.set('contributorUsername', contributorUsername)
    }

    const shareUrl = `https://uolink.vercel.app/note?${params.toString()}`
    const message = `Check out the notes of *${noteSubject}* | *${noteTeacher}* by *${contributorDisplayName}* on *UOLINK* :- ${shareUrl}`

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }, [dashboard.notes])

  return (
    <div className="container md:mt-16 mt-14 mx-auto px-4 pb-8 pt-4">
      {/* Scroll to top button */}
      <button
        className="fixed bottom-4 right-4 border border-black text-black p-2 rounded-full shadow-lg hover:bg-green-50 transition-all duration-300"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="md:size-5 size-3" />
      </button>

      {/* Donators section */}
      {DONATORS.length > 0 && (
        <div className="flex justify-center items-center flex-col">
          <MorphingTextLazy texts={DONATORS.map((contributor) => `${contributor.name}-${contributor.amount}`)} />
        </div>
      )}

      {/* Donate link */}
      <Link href="/donate">
        <div className="flex flex-row justify-center animate-pulse duration-700 hover:animate-none items-center">
          <h1 className="text-xs sm:text-sm hover:underline md:hover:border-x px-3 sm:px-5 md:hover:border-[#90c639] font-bold text-center hover:text-[#90c639] transition-all duration-200 ">
            Database <span className="text-amber-600 hover:text-[#90c639]">Cost</span> Rising.
            <span className="text-[#90c639]">Donate</span> to Keep Us Running!
          </h1>
        </div>
      </Link>

      {/* Quick Actions */}
      <div className="flex flex-wrap justify-center items-center gap-4 mt-4 mb-2">
        {user && (
          <button
            onClick={() => {
              // This will be handled by the parent AppWithScanner component
              const event = new CustomEvent('openUploadModal')
              window.dispatchEvent(event)
            }}
            className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-[#90c639] hover:bg-green-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Upload Material
          </button>
        )}
        <Link
          href="/leaderboard"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-4 py-2 text-sm font-semibold text-[#90c639] hover:bg-lime-100 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
          </svg>
          View Leaderboard
        </Link>
        {user && (
          <Link
            href="/aura"
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            My Aura
          </Link>
        )}
      </div>

      {/* Filters */}
      <DashboardFilters
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filterOptions={dashboard.filterOptions}
        titleFilter={dashboard.titleFilter}
        setTitleFilter={dashboard.setTitleFilter}
        semesterFilter={dashboard.semesterFilter}
        setSemesterFilter={dashboard.setSemesterFilter}
        subjectFilter={dashboard.subjectFilter}
        setSubjectFilter={dashboard.setSubjectFilter}
        teacherFilter={dashboard.teacherFilter}
        setTeacherFilter={dashboard.setTeacherFilter}
        nameFilter={dashboard.nameFilter}
        setNameFilter={dashboard.setNameFilter}
        sectionFilter={dashboard.sectionFilter}
        setSectionFilter={dashboard.setSectionFilter}
        majorFilter={dashboard.majorFilter}
        setMajorFilter={dashboard.setMajorFilter}
        materialTypeFilter={dashboard.materialTypeFilter}
        setMaterialTypeFilter={dashboard.setMaterialTypeFilter}
        materialSequenceFilter={dashboard.materialSequenceFilter}
        setMaterialSequenceFilter={dashboard.setMaterialSequenceFilter}
        hasActiveFilters={dashboard.hasActiveFilters}
        resetFilters={dashboard.resetFilters}
      />

      {/* Search */}
      <DashboardSearch
        titleFilter={dashboard.titleFilter}
        setTitleFilter={dashboard.setTitleFilter}
      />

      {/* Error display */}
      {dashboard.error && <p className="text-red-500">Error fetching notes: {dashboard.error}</p>}

      {/* Sort */}
      <DashboardSort
        sortMode={dashboard.sortMode}
        setSortMode={dashboard.setSortMode}
        notesCount={dashboard.notes.length}
      />

      {/* Notes Grid */}
      {dashboard.loading ? (
        <NotesLoader />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dashboard.displayedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              subjectFilter={dashboard.subjectFilter}
              setSubjectFilter={dashboard.setSubjectFilter}
              teacherFilter={dashboard.teacherFilter}
              setTeacherFilter={dashboard.setTeacherFilter}
              semesterFilter={dashboard.semesterFilter}
              setSemesterFilter={dashboard.setSemesterFilter}
              sectionFilter={dashboard.sectionFilter}
              setSectionFilter={dashboard.setSectionFilter}
              materialTypeFilter={dashboard.materialTypeFilter}
              setMaterialTypeFilter={dashboard.setMaterialTypeFilter}
              materialSequenceFilter={dashboard.materialSequenceFilter}
              setMaterialSequenceFilter={dashboard.setMaterialSequenceFilter}
              savedNotes={savedNotes.savedNotes}
              savingNotes={savedNotes.savingNotes}
              isNoteSaving={savedNotes.isNoteSaving}
              profileData={profileData}
              admin={dashboard.admin}
              user={user}
              handleViewNote={handleViewNote}
              handleSaveNote={savedNotes.handleSaveNote}
              handleVoteScoreUpdate={dashboard.handleVoteScoreUpdate}
              handleReportUpdate={dashboard.handleReportUpdate}
              handleDelete={handleDelete}
              handleShare={handleShare}
            />
          ))}

          {/* No results message */}
          {dashboard.notes.length === 0 && !dashboard.loading && (
            <div className="col-span-full text-center text-gray-500 py-8">
              No notes found! Reset filters or try different search terms.
            </div>
          )}

          {/* Load More Button */}
          {dashboard.hasMore && dashboard.notes.length > 0 && !dashboard.hasActiveFilters() && (
            <div className="col-span-full flex justify-center py-8">
              <button
                onClick={dashboard.loadMoreNotes}
                disabled={dashboard.loadingMore}
                className="px-6 py-3 rounded-lg font-medium
                bg-amber-300 text-black
                hover:bg-amber-400
                disabled:bg-zinc-300 disabled:text-zinc-600
                shadow-sm hover:shadow-md
                transition-all duration-300 ease-in-out"
              >
                {dashboard.loadingMore ? 'Loading More...' : 'Load More Notes'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading More Skeleton */}
      {dashboard.loadingMore && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="z-70 w-full bg-zinc-50 rounded-lg shadow-lg p-4 flex flex-row space-x-6 overflow-hidden"
            >
              <div className="flex flex-col justify-center flex-grow">
                <Skeleton height={30} width={200} className="mb-4" />
                <Skeleton height={20} width={140} className="mb-4" />
                <Skeleton height={20} width={180} className="mb-4" />
                <Skeleton height={20} width={160} className="mb-4" />
                <div className="flex flex-row gap-2">
                  <Skeleton height={40} width={100} className="mt-4" />
                  <Skeleton height={40} width={40} className="mt-4" />
                </div>
              </div>
              <div className="flex-shrink-0">
                <Skeleton height={200} width={150} className="rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Initial loading indicator for saved notes */}
      {savedNotes.isInitialLoading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg border p-3 z-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-4 h-4 border-2 border-[#90c639] border-t-transparent rounded-full animate-spin"></div>
            Loading saved notes...
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModalLazy
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setNoteToDelete(null)
        }}
        onConfirm={handleConfirmDelete}
        noteTitle={noteToDelete?.title || ''}
        noteSubject={noteToDelete?.subject || ''}
        isDeleting={isDeleting}
      />

      {/* Footer */}
      <div className="text-center opacity-90 pt-14 flex flex-col">
        <div className="hover:-rotate-3 transition-all duration-300">
          <span className="text-[#90c639] font-bold">
            <span className="text-black">~ by</span> Aazib
          </span>
        </div>
      </div>
    </div>
  )
}

export default DashboardRefactored
