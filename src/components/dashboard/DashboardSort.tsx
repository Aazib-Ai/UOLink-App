'use client'

import { SORT_OPTIONS, SortMode } from './constants'

interface DashboardSortProps {
  sortMode: SortMode
  setSortMode: (mode: SortMode) => void
  notesCount: number
}

export const DashboardSort: React.FC<DashboardSortProps> = ({
  sortMode,
  setSortMode,
  notesCount,
}) => {
  if (notesCount === 0) return null

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-gray-700">Sort by</p>
      <div className="flex gap-2">
        {SORT_OPTIONS.map((option) => {
          const isActive = sortMode === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSortMode(option.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#90c639]/40 ${
                isActive
                  ? 'border-[#90c639] bg-[#90c639] text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-[#90c639] hover:text-[#90c639]'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
