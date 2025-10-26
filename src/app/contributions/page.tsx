'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useUpload } from '@/contexts/UploadContext'
import { ContributionsProvider, useContributions } from '@/contexts/ContributionsContext'
import { UploadProvider } from '@/contexts/UploadContext'
import { useContributionsData } from '@/hooks/contributions'
import {
  ContributionsLayout,
  ContributionStatsPanel,
  ContributionFilters,
  ContributionList,
  ContributionUploadModal,
  UploadEntryPoint,
} from '@/components/contributions'
import ErrorBoundary from '@/components/ErrorBoundary'

function ContributionsPageContent() {
  const { user, loading, sendVerificationEmail } = useAuth()
  const router = useRouter()
  const [resendingVerification, setResendingVerification] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null)

  const {
    // Data
    filteredNotes,
    stats,
    subjectOptions,
    isLoading,
    error,
    noteActionState,

    // Filter state
    searchTerm,
    filterSubject,
    sortBy,
    hasActiveFilters,

    // Edit state
    editState,

    // UI helpers
    hasAnyNotes,
    hasFilteredNotes,
  } = useContributions()

  const {
    // Actions
    startEditing,
    saveNote,
    deleteNote,

    // Filter actions
    setSearchTerm,
    setFilterSubject,
    setSortBy,
    clearFilters,
  } = useContributionsData()

  // Auth redirect
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/auth')
    }
  }, [user, loading, router])

  const handleVerificationResend = async () => {
    setVerificationMessage(null)
    try {
      setResendingVerification(true)
      await sendVerificationEmail()
      setVerificationMessage('Verification email sent. Please check your inbox and spam folder.')
    } catch (err) {
      setVerificationMessage(
        err instanceof Error ? err.message : 'Unable to send verification email right now. Please try again later.'
      )
    } finally {
      setResendingVerification(false)
    }
  }

  // Event handlers
  const handleNoteView = (fileUrl: string) => {
    if (!fileUrl) return
    if (typeof window !== 'undefined') {
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const { openUploadModal } = useUpload()

  const handleEmptyStateAction = () => {
    if (!hasAnyNotes) {
      openUploadModal()
    } else {
      clearFilters()
    }
  }

  const handleUploadSuccess = () => {
    // Refresh notes after successful upload
    const { loadUserContributions } = useContributionsData()
    loadUserContributions()
  }

  if (loading || isLoading) {
    return (
      <ContributionsLayout
        isLoading={true}
        loadingMessage="Loading your contributions..."
      >
        <div></div>
      </ContributionsLayout>
    )
  }

  if (!user) {
    return null
  }

  if (!user.emailVerified) {
    return (
      <ContributionsLayout>
        <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900 shadow-sm">
          <h2 className="text-2xl font-semibold">Verify your email to access contributions</h2>
          <p className="mt-3 text-sm">
            We sent a verification link to <strong>{user.email ?? 'your account email'}</strong>. Verify it to unlock
            uploads, edits, and contributions.
          </p>
          {verificationMessage && (
            <p className="mt-3 text-sm">
              {verificationMessage}
            </p>
          )}
          <button
            onClick={handleVerificationResend}
            disabled={resendingVerification}
            className="mt-4 inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-400"
          >
            {resendingVerification ? 'Sending...' : 'Resend verification email'}
          </button>
          <p className="mt-3 text-xs text-amber-700">
            After verifying, refresh this page or sign in again to continue.
          </p>
        </div>
      </ContributionsLayout>
    )
  }

  return (
    <ContributionsLayout>
      <ErrorBoundary>
        {/* Stats Panel */}
        <ContributionStatsPanel
          stats={stats}
          contributorDisplayName={user.displayName || user.email?.split('@')[0] || 'Contributor'}
          onUploadClick={openUploadModal}
          onBackClick={() => router.back()}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        {/* Filters */}
        <ContributionFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterSubject={filterSubject}
          onSubjectFilterChange={setFilterSubject}
          sortBy={sortBy}
          onSortChange={setSortBy}
          subjectOptions={subjectOptions}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </ErrorBoundary>

      {/* Error Display */}
      {error && (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      <ErrorBoundary>
        {/* Contributions List */}
        <ContributionList
          notes={filteredNotes}
          onEditStart={startEditing}
          onDelete={deleteNote}
          onView={handleNoteView}
          noteActionState={noteActionState}
          editingId={editState.id}
          noteDraft={editState.draft}
          onNoteDraftChange={(draft) => {
            // This will be handled by context
            console.log('Draft updated:', draft)
          }}
          onEditCancel={() => {
            // This will be handled by context
            console.log('Edit cancelled')
          }}
          onEditSave={saveNote}
          subjectError={editState.errors.subject}
          teacherWarning={editState.warnings.teacher}
          subjectSuggestions={[]} // Will come from suggestion engine
          teacherSuggestions={[]} // Will come from suggestion engine
          onSubjectSuggestionClick={(suggestion) => {
            console.log('Subject suggestion clicked:', suggestion)
          }}
          onTeacherSuggestionClick={(suggestion) => {
            console.log('Teacher suggestion clicked:', suggestion)
          }}
          hasAnyNotes={hasAnyNotes}
          hasFilteredNotes={hasFilteredNotes}
          onEmptyStateAction={handleEmptyStateAction}
        />
      </ErrorBoundary>

      {/* Upload Entry Point */}
      <div className="fixed bottom-6 right-6">
        <ErrorBoundary>
          <UploadEntryPoint
            contributorDisplayName={user.displayName || user.email?.split('@')[0] || 'Contributor'}
          />
        </ErrorBoundary>
      </div>

      {/* Upload Modal */}
      <ErrorBoundary>
        <ContributionUploadModal />
      </ErrorBoundary>
    </ContributionsLayout>
  )
}

export default function ContributionsPage() {
  return (
    <ContributionsProvider>
      <UploadProvider onUploadSuccess={() => {
        // This will be handled by the page component
        console.log('Upload completed at provider level')
      }}>
        <ContributionsPageContent />
      </UploadProvider>
    </ContributionsProvider>
  )
}
