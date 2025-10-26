'use client'

import { useState } from 'react'
import { FileText, Plus, Calendar, Pencil, Eye, Download, Trash2, Loader2 } from 'lucide-react'
import PWADownloadButton from '../PWADownloadButton'

interface UserNote {
  id: string
  name: string
  subject: string
  teacher: string
  semester: string
  contributorName: string
  contributorDisplayName?: string
  uploaderUsername?: string | null
  fileUrl: string
  fileSize?: number
  uploadedAt: string
  updatedAt?: string
  module?: string
}

interface NoteActionState {
  id: string
  type: 'save' | 'delete'
}

interface ContributionListProps {
  notes: UserNote[]
  onEditStart: (note: UserNote) => void
  onDelete: (noteId: string) => void
  onView: (fileUrl: string) => void
  noteActionState: NoteActionState | null
  editingId: string | null
  noteDraft: {
    name: string
    subject: string
    teacher: string
    semester: string
  }
  onNoteDraftChange: (draft: { name: string; subject: string; teacher: string; semester: string }) => void
  onEditCancel: () => void
  onEditSave: () => void
  subjectError: string | null
  teacherWarning: string | null
  subjectSuggestions: string[]
  teacherSuggestions: string[]
  onSubjectSuggestionClick: (suggestion: string) => void
  onTeacherSuggestionClick: (suggestion: string) => void
  hasAnyNotes: boolean
  hasFilteredNotes: boolean
  onEmptyStateAction: () => void
}

export default function ContributionList({
  notes,
  onEditStart,
  onDelete,
  onView,
  noteActionState,
  editingId,
  noteDraft,
  onNoteDraftChange,
  onEditCancel,
  onEditSave,
  subjectError,
  teacherWarning,
  subjectSuggestions,
  teacherSuggestions,
  onSubjectSuggestionClick,
  onTeacherSuggestionClick,
  hasAnyNotes,
  hasFilteredNotes,
  onEmptyStateAction
}: ContributionListProps) {
  const formatFileSize = (bytes?: number) => {
    if (!bytes || Number.isNaN(bytes)) return 'Size unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDisplayDate = (isoString?: string) => {
    if (!isoString) return 'Unknown'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return 'Unknown'
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  if (!hasFilteredNotes) {
    return (
      <div className="rounded-3xl border border-amber-200/70 bg-white/80 px-8 py-12 text-center shadow-sm backdrop-blur-sm">
        <FileText className="mx-auto mb-4 h-12 w-12 text-amber-400" />
        <h3 className="mb-2 text-xl font-semibold text-gray-900">
          {hasAnyNotes ? 'No notes match your filters' : 'You have not uploaded any notes yet'}
        </h3>
        <p className="text-sm text-gray-600">
          {hasAnyNotes
            ? 'Adjust your search keywords or clear filters to see more results.'
            : 'Share your first set of notes and help classmates catch up faster.'}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onEmptyStateAction}
            className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332]"
          >
            {hasAnyNotes ? (
              <span>Reset filters</span>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                <span>Upload your first note</span>
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="mt-8 space-y-5">
      {notes.map((note) => {
        const isEditing = editingId === note.id
        const isSaving = noteActionState?.id === note.id && noteActionState.type === 'save'
        const isDeleting = noteActionState?.id === note.id && noteActionState.type === 'delete'

        return (
          <article
            key={note.id}
            className="rounded-3xl border border-amber-200/70 bg-white/90 p-6 shadow-sm transition hover:shadow-md backdrop-blur-sm"
          >
            {isEditing ? (
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Title
                  </label>
                  <input
                    type="text"
                    value={noteDraft.name}
                    onChange={(event) => onNoteDraftChange({ ...noteDraft, name: event.target.value })}
                    className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                    placeholder="e.g., Calculus Midterm Solutions"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={noteDraft.subject}
                      onChange={(event) => onNoteDraftChange({ ...noteDraft, subject: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                      placeholder="Start typing to find a subject"
                    />
                    {subjectError && (
                      <p className="mt-2 text-xs font-semibold text-rose-600">{subjectError}</p>
                    )}
                    {subjectSuggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {subjectSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => onSubjectSuggestionClick(suggestion)}
                            className="rounded-full border border-[#90c639]/30 bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316] transition hover:bg-[#e8f6d1]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Teacher
                    </label>
                    <input
                      type="text"
                      value={noteDraft.teacher}
                      onChange={(event) => onNoteDraftChange({ ...noteDraft, teacher: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                      placeholder="Start typing to find a teacher"
                    />
                    {teacherSuggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {teacherSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => onTeacherSuggestionClick(suggestion)}
                            className="rounded-full border border-[#90c639]/30 bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316] transition hover:bg-[#e8f6d1]"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    {teacherWarning && (
                      <p className="mt-2 text-xs font-semibold text-amber-600">{teacherWarning}</p>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Semester
                    </label>
                    <input
                      type="text"
                      value={noteDraft.semester}
                      onChange={(event) => onNoteDraftChange({ ...noteDraft, semester: event.target.value })}
                      className="mt-2 w-full rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
                      placeholder="e.g., 1"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={onEditSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-[#90c639] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7ab332] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={onEditCancel}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#f4fbe8] text-[#365316]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{note.name}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {note.subject && (
                          <span className="inline-flex items-center rounded-full bg-[#f4fbe8] px-3 py-1 text-xs font-semibold text-[#365316]">
                            {note.subject}
                          </span>
                        )}
                        {(note.teacher || note.module) && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                            {note.teacher || note.module}
                          </span>
                        )}
                        {note.semester && (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                            Semester {note.semester}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Uploaded {formatDisplayDate(note.uploadedAt)}
                        </span>
                        {note.updatedAt && note.updatedAt !== note.uploadedAt && (
                          <span className="flex items-center gap-1">
                            <Pencil className="h-3.5 w-3.5" />
                            Edited {formatDisplayDate(note.updatedAt)}
                          </span>
                        )}
                        <span>{formatFileSize(note.fileSize)}</span>
                      </div>

                      {(note.contributorDisplayName || note.contributorName) && (
                        <p className="mt-3 text-sm text-gray-600">
                          Shared as{' '}
                          <span className="font-semibold text-gray-800">
                            {note.contributorDisplayName || note.contributorName}
                          </span>
                        </p>
                      )}

                      {note.fileUrl && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => onView(note.fileUrl)}
                            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </button>
                          <PWADownloadButton
                            url={note.fileUrl}
                            title={note.subject}
                            className="rounded-full"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:items-end">
                  <button
                    type="button"
                    onClick={() => onEditStart(note)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(note.id)}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Delete
                  </button>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
