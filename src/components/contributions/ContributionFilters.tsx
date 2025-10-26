'use client'

import { Search } from 'lucide-react'

interface SubjectOption {
  key: string
  label: string
}

interface ContributionFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  filterSubject: string
  onSubjectFilterChange: (value: string) => void
  sortBy: 'recent' | 'name' | 'subject'
  onSortChange: (value: 'recent' | 'name' | 'subject') => void
  subjectOptions: SubjectOption[]
  onClearFilters: () => void
  hasActiveFilters: boolean
}

export default function ContributionFilters({
  searchTerm,
  onSearchChange,
  filterSubject,
  onSubjectFilterChange,
  sortBy,
  onSortChange,
  subjectOptions,
  onClearFilters,
  hasActiveFilters
}: ContributionFiltersProps) {
  const searchTermLower = searchTerm.trim().toLowerCase()
  const subjectFilterLabel = filterSubject
    ? subjectOptions.find(option => option.key === filterSubject)?.label || filterSubject
    : ''

  return (
    <section className="mt-10">
      <div className="rounded-2xl border border-amber-200/70 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by title, subject, or teacher"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full rounded-xl border border-amber-200 bg-white/90 px-9 py-2 text-sm text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={filterSubject}
              onChange={(event) => onSubjectFilterChange(event.target.value)}
              className="rounded-xl border border-amber-200 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
            >
              <option value="">All subjects</option>
              {subjectOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as 'recent' | 'name' | 'subject')}
              className="rounded-xl border border-amber-200 bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition focus:border-[#90c639] focus:outline-none focus:ring-2 focus:ring-[#90c639]/20"
            >
              <option value="recent">Most recent</option>
              <option value="name">Alphabetical</option>
              <option value="subject">By subject</option>
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-[#90c639]/30 bg-[#f4fbe8] px-4 py-2 text-sm font-semibold text-[#335013] transition hover:bg-[#e8f6d1]"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Active:</span>
            {searchTermLower && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f4fbe8] px-3 py-1 font-medium text-[#365316]">
                Search "{searchTerm}"
              </span>
            )}
            {filterSubject && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f4fbe8] px-3 py-1 font-medium text-[#365316]">
                Subject {subjectFilterLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}