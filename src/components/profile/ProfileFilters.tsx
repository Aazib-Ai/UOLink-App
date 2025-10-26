'use client'

import React, { useEffect, useRef } from 'react'
import { Search, Filter } from 'lucide-react'
import { toTitleCase } from '@/lib/utils'

interface ProfileFiltersProps {
    searchTerm: string
    setSearchTerm: (term: string) => void
    selectedSubject: string
    setSelectedSubject: (subject: string) => void
    uniqueSubjects: string[]
    showSubjectDropdown: boolean
    setShowSubjectDropdown: (show: boolean) => void
    userNotesLength: number
}

export default function ProfileFilters({
    searchTerm,
    setSearchTerm,
    selectedSubject,
    setSelectedSubject,
    uniqueSubjects,
    showSubjectDropdown,
    setShowSubjectDropdown,
    userNotesLength
}: ProfileFiltersProps) {
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element
            if (showSubjectDropdown && !target.closest('.subject-dropdown')) {
                setShowSubjectDropdown(false)
            }
        }

        if (showSubjectDropdown) {
            document.addEventListener('click', handleClickOutside)
        }

        return () => {
            document.removeEventListener('click', handleClickOutside)
        }
    }, [showSubjectDropdown, setShowSubjectDropdown])

    return (
        <div className="space-y-3">
            {/* Search bar - always show but disabled if no notes */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a8f5d]" />
                <input
                    type="text"
                    placeholder={userNotesLength > 0 ? "Search notes by subject, name, or teacher..." : "No notes available to search"}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    disabled={userNotesLength === 0}
                    className={`w-full rounded-2xl border bg-[#f7fbe9] pl-10 pr-4 py-3 text-sm placeholder:text-[#7a8f5d] focus:outline-none focus:ring-1 focus:ring-[#90c639] transition-colors ${
                        userNotesLength === 0
                            ? 'border-lime-100 text-[#7a8f5d] cursor-not-allowed'
                            : 'border-lime-100 text-[#1f2f10] focus:border-[#90c639]'
                    }`}
                />
                {searchTerm && userNotesLength > 0 && (
                    <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a8f5d] hover:text-[#1f2f10]"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Subject filter - compact dropdown */}
            {uniqueSubjects.length > 1 && (
                <div className="relative subject-dropdown" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setShowSubjectDropdown(!showSubjectDropdown)}
                        className="inline-flex items-center gap-2 rounded-full border border-lime-100 bg-[#f7fbe9] px-4 py-2 text-sm font-medium text-[#5f7050] transition hover:border-[#90c639] hover:text-[#1f2f10]"
                    >
                        <Filter className="h-4 w-4" />
                        {selectedSubject ? toTitleCase(selectedSubject) : 'All subjects'}
                        <svg
                            className={`h-4 w-4 transition-transform ${showSubjectDropdown ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showSubjectDropdown && (
                        <div className="absolute top-full left-0 z-10 mt-2 w-56 rounded-2xl border border-lime-100 bg-white shadow-lg">
                            <div className="max-h-60 overflow-y-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSubject('')
                                        setShowSubjectDropdown(false)
                                    }}
                                    className={`w-full px-4 py-3 text-left text-sm transition hover:bg-[#f7fbe9] ${
                                        !selectedSubject
                                            ? 'bg-[#f7fbe9] text-[#90c639] font-medium'
                                            : 'text-[#334125]'
                                    }`}
                                >
                                    All subjects
                                </button>
                                {uniqueSubjects.map((subject) => (
                                    <button
                                        key={subject}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSubject(subject)
                                            setShowSubjectDropdown(false)
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm transition hover:bg-[#f7fbe9] ${
                                        selectedSubject === subject
                                            ? 'bg-[#f7fbe9] text-[#90c639] font-medium'
                                            : 'text-[#334125]'
                                    }`}
                                    >
                                        {toTitleCase(subject)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}