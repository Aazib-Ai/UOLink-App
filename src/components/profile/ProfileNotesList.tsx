'use client'

import React from 'react'
import { BookOpen, Sparkles, Search, FileText } from 'lucide-react'
import { NoteData } from './types'
import { toTitleCase } from '@/lib/utils'
import PDFThumbnail from '../PDFThumbnail'
import { isPDFUrl } from './utils'
import { resolveUploadDescriptorByUrl } from '@/constants/uploadFileTypes'

interface ProfileNotesListProps {
    filteredNotes: NoteData[]
    displayedNotes: NoteData[]
    hasMoreNotes: boolean
    loadMoreNotes: () => void | Promise<void>
    handleViewNote: (note: NoteData) => void
    userNotesLength: number
    firstName: string
    fullName: string
    searchTerm: string
    selectedSubject: string
    clearFilters: () => void
    isLoadingMore?: boolean
}

export default function ProfileNotesList({
    filteredNotes,
    displayedNotes,
    hasMoreNotes,
    loadMoreNotes,
    handleViewNote,
    userNotesLength,
    firstName,
    fullName,
    searchTerm,
    selectedSubject,
    clearFilters,
    isLoadingMore = false
}: ProfileNotesListProps) {
    const remainingLocal = Math.max(filteredNotes.length - displayedNotes.length, 0)
    const nextBatchSize = remainingLocal > 0 ? Math.min(5, remainingLocal) : 5
    const loadMoreLabel = isLoadingMore
        ? 'Loading...'
        : remainingLocal > 0
            ? `Load ${nextBatchSize} more notes`
            : 'Load more notes'
    
    if (filteredNotes.length === 0) {
        return (
            <div 
                className="flex w-full flex-col items-center justify-center text-center"
                style={{ minHeight: '500px' }}
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-lime-200 bg-[#f7fbe9]">
                    {userNotesLength === 0 ? (
                        <BookOpen className="h-7 w-7 text-[#90c639]" />
                    ) : (
                        <Search className="h-7 w-7 text-[#90c639]" />
                    )}
                </div>
                <h3 className="mt-4 text-base font-medium text-[#1f2f10]">
                    {userNotesLength === 0 ? 'No notes yet' : 'No notes found'}
                </h3>
                <p className="mt-2 max-w-md text-sm text-[#4c5c3c]">
                    {userNotesLength === 0 ? (
                        `${firstName || fullName} hasn't shared any notes just yet.`
                    ) : (
                        'Try adjusting your search or filter to find what you\'re looking for.'
                    )}
                </p>
                {(searchTerm || selectedSubject) && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-4 py-2 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10]"
                    >
                        Clear filters
                    </button>
                )}
            </div>
        )
    }

    return (
        <div className="w-full">
            {/* Mobile Layout */}
            <div className="block lg:hidden">
                <div 
                    className="w-full space-y-4"
                    style={{ minHeight: '500px' }}
                >
                    {displayedNotes.map((note) => {
                        const descriptorInfo = describeDocument(note)
                        const isPdf = isPDFUrl(note.fileUrl)
                        return (
                            <button
                                key={note.id}
                                type="button"
                                onClick={() => handleViewNote(note)}
                                className="group w-full overflow-hidden rounded-2xl border border-lime-100 bg-white text-left shadow-sm transition hover:border-[#90c639] hover:shadow-md active:scale-[0.98]"
                            >
                            <div className="flex gap-4 p-4">
                                {/* Thumbnail */}
                                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-lime-50 bg-[#f7fbe9]">
                                    {isPdf ? (
                                        <PDFThumbnail
                                            url={note.fileUrl}
                                            width={80}
                                            height={80}
                                            className="!h-full !w-full object-cover"
                                        />
                                    ) : (
                                        renderDocumentPlaceholder(note, 'mobile')
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex flex-1 flex-col gap-2 min-w-0">
                                    <h3 className="text-sm font-semibold text-[#1f2f10] transition group-hover:text-[#90c639] line-clamp-1">
                                        {toTitleCase(note.subject) || 'Untitled subject'}
                                    </h3>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center rounded-full border border-lime-100 bg-[#f3f8e7] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5f7050]">
                                            {note.semester || 'Not set'}
                                        </span>
                                        {!isPdf && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-lime-100 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5f7050]">
                                                <FileText className="h-3 w-3 text-[#7a8f5d]" />
                                                {descriptorInfo.singular}
                                            </span>
                                        )}
                                    </div>

                                    <span className="text-xs text-[#4c5c3c]">
                                        {toTitleCase(note.teacher || note.module || '') || 'Unknown'}
                                    </span>

                                    <p className="text-xs text-[#5f7050] line-clamp-2">{note.name}</p>

                                    <div className="mt-auto flex items-center justify-between text-xs text-[#5f7050]">
                                        <span className="text-[10px]">
                                            {note.uploadedAt?.toDate?.()?.toLocaleDateString('en-GB', {
                                                month: 'short',
                                                day: 'numeric',
                                            }) ??
                                            new Date().toLocaleDateString('en-GB', {
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[#90c639] font-medium">
                                            View
                                            <Sparkles className="h-3 w-3" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                            </button>
                        )
                    })}

                    {/* Load More Button for Mobile */}
                    {hasMoreNotes && (
                        <div className="mt-6 flex w-full justify-center">
                            <button
                                type="button"
                                onClick={loadMoreNotes}
                                disabled={isLoadingMore}
                                className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-6 py-3 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loadMoreLabel}
                                <BookOpen className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden lg:block">
                <div 
                    className="w-full"
                    style={{ minHeight: '500px' }}
                >
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 w-full">
                        {displayedNotes.map((note) => {
                            const descriptorInfo = describeDocument(note)
                            const isPdf = isPDFUrl(note.fileUrl)
                            return (
                                <button
                                    key={note.id}
                                    type="button"
                                    onClick={() => handleViewNote(note)}
                                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-lime-100 bg-white text-left shadow-sm transition hover:border-[#90c639] hover:shadow-md active:scale-[0.98]"
                                    style={{ minHeight: '380px' }}
                                >
                                    <div className="relative aspect-[4/3] w-full border-b border-lime-50 bg-[#f7fbe9]">
                                        {isPdf ? (
                                            <PDFThumbnail
                                                url={note.fileUrl}
                                                width={300}
                                                height={225}
                                                className="!h-full !w-full object-cover"
                                            />
                                        ) : (
                                            renderDocumentPlaceholder(note, 'desktop')
                                        )}
                                    </div>
                                    <div className="flex flex-1 flex-col gap-2 p-4">
                                        <h3 className="text-sm font-semibold text-[#1f2f10] transition group-hover:text-[#90c639] line-clamp-2">
                                            {toTitleCase(note.subject) || 'Untitled subject'}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex w-fit items-center rounded-full border border-lime-100 bg-[#f3f8e7] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#5f7050]">
                                                {note.semester || 'Not set'}
                                            </span>
                                            {!isPdf && (
                                                <span className="inline-flex items-center gap-1 rounded-full border border-lime-100 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5f7050]">
                                                    <FileText className="h-3.5 w-3.5 text-[#7a8f5d]" />
                                                    {descriptorInfo.singular}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#4c5c3c]">
                                            <span className="font-medium">Teacher:</span> {toTitleCase(note.teacher || note.module || '') || 'Unknown'}
                                        </p>
                                        <p className="text-xs text-[#5f7050] line-clamp-2 flex-1">{note.name}</p>
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
                            )
                        })}
                    </div>

                    {/* Load More Button for Desktop */}
                    {hasMoreNotes && (
                        <div className="mt-6 flex w-full justify-center">
                            <button
                                type="button"
                                onClick={loadMoreNotes}
                                disabled={isLoadingMore}
                                className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-white px-6 py-3 text-sm font-medium text-[#334125] shadow-sm transition hover:border-[#90c639] hover:text-[#1f2f10] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loadMoreLabel}
                                <BookOpen className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
    const describeDocument = (note: NoteData) => {
        const descriptor = resolveUploadDescriptorByUrl(note.fileUrl || '')
        const rawLabel = descriptor?.label ?? 'Document'
        const singularLabel = rawLabel.toLowerCase().endsWith('s') ? rawLabel.slice(0, -1) : rawLabel
        return {
            label: rawLabel,
            singular: singularLabel,
            lowercase: singularLabel.toLowerCase(),
        }
    }

    const renderDocumentPlaceholder = (note: NoteData, variant: 'mobile' | 'desktop') => {
        const { singular, lowercase } = describeDocument(note)
        const isMobile = variant === 'mobile'
        return (
            <div
                className={`flex h-full w-full ${isMobile ? 'flex-col gap-1 px-2 py-3' : 'flex-col gap-2 px-4 py-6'} items-center justify-center rounded-xl bg-white/70 text-center text-[#5f7050]`}
            >
                <FileText className={`${isMobile ? 'h-4 w-4' : 'h-6 w-6'} text-[#7a8f5d]`} />
                <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold uppercase tracking-wide`}>
                    {singular}
                </span>
                <span className={`${isMobile ? 'text-[9px]' : 'text-[11px]'} text-[#7a8f5d]`}>
                    Tap to open the {lowercase}
                </span>
            </div>
        )
    }
