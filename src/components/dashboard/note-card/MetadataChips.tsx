'use client'

import { getChipText } from './variantConfig'
import { Note, FilterState, BadgeState, Variant } from './types'

interface MetadataChipsProps {
  note: Note
  filters: FilterState
  noteSection: string
  materialDisplay: string
  handleMaterialFilterToggle: () => void
  badgeState: BadgeState
  variant: Variant
}

export const MetadataChips: React.FC<MetadataChipsProps> = ({
  note,
  filters,
  noteSection,
  materialDisplay,
  handleMaterialFilterToggle,
  badgeState,
  variant
}) => {
  const handleSemesterClick = () => {
    if (!note.semester) return
    if (filters.semesterFilter === note.semester) {
      filters.setSemesterFilter("")
    } else {
      filters.setSemesterFilter(note.semester)
    }
  }

  const handleSectionClick = () => {
    if (filters.sectionFilter === noteSection) {
      filters.setSectionFilter("")
    } else {
      filters.setSectionFilter(noteSection)
    }
  }

  const chipText = getChipText(variant, note)
  const gapClass = variant === 'mobile' ? 'gap-1.5' : 'gap-2'
  const marginClass = variant === 'desktop' ? 'mb-4' : 'mb-3'

  return (
    <div className={`flex flex-wrap ${gapClass} ${marginClass}`}>
      {/* Semester Chip */}
      <button
        type="button"
        onClick={handleSemesterClick}
        className={`${badgeState.badgeBase} ${badgeState.isSemesterActive ? badgeState.badgeActive : ''} ${variant !== 'desktop' ? 'text-xs px-2 py-1' : ''}`}
      >
        {chipText.semester}
      </button>

      {/* Section Chip */}
      {noteSection ? (
        <button
          type="button"
          onClick={handleSectionClick}
          className={`${badgeState.badgeBase} ${badgeState.isSectionActive ? badgeState.badgeActive : ''} ${variant !== 'desktop' ? 'text-xs px-2 py-1' : ''}`}
        >
          {chipText.section}
        </button>
      ) : (
        <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
          {variant === 'desktop' ? 'Section TBD' : 'Sec TBD'}
        </span>
      )}

      {/* Material Type Chip */}
      {materialDisplay && materialDisplay !== 'Not specified' ? (
        <button
          type="button"
          onClick={handleMaterialFilterToggle}
          className={`${badgeState.badgeBase} ${badgeState.isMaterialActive ? badgeState.badgeActive : ''} ${variant !== 'desktop' ? 'text-xs px-2 py-1' : ''}`}
        >
          {chipText.material}
        </button>
      ) : (
        <span className="rounded-full border border-dashed border-gray-300 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-400">
          {variant === 'desktop' ? 'Material tagged soon' : 'Type TBD'}
        </span>
      )}
    </div>
  )
}
