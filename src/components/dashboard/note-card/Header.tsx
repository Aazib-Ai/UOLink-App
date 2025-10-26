import { Flame, Skull } from 'lucide-react'
import { toTitleCase } from '@/lib/utils'
import { getCredibilityData } from '../utils/noteFormatting'
import { Note, FilterState, Variant } from './types'

interface HeaderProps {
  note: Note
  filters: FilterState
  noteName: string
  variant: Variant
}

const renderCredibilityIcon = (iconType: 'flame' | 'skull' | null) => {
  if (iconType === 'flame') {
    return <Flame className="h-3 w-3" aria-hidden="true" />
  }
  if (iconType === 'skull') {
    return <Skull className="h-3 w-3" aria-hidden="true" />
  }
  return null
}

export const Header: React.FC<HeaderProps> = ({
  note,
  filters,
  noteName,
  variant
}) => {
  const credibilityData = getCredibilityData(note)

  const handleSubjectClick = () => {
    if (filters.subjectFilter === note.subject) {
      filters.setSubjectFilter("")
    } else {
      filters.setSubjectFilter(note.subject)
    }
  }

  const handleTeacherClick = () => {
    const teacherValue = note.teacher || ''
    if (!teacherValue) return

    if (filters.teacherFilter === teacherValue) {
      filters.setTeacherFilter("")
    } else {
      filters.setTeacherFilter(teacherValue)
    }
  }

  const titleClass = variant === 'desktop'
    ? 'text-xl font-bold'
    : 'text-lg font-bold'

  return (
    <div className={variant === 'desktop' ? '' : 'mb-3'}>
      <div className={`flex items-start justify-between ${variant === 'desktop' ? 'gap-2' : 'mb-2'}`}>
        <h1
          onClick={handleSubjectClick}
          className={`cursor-pointer transition-colors duration-300 hover:text-[#90c639] pr-2 ${titleClass}`}
        >
          {toTitleCase(note.subject) || "unknown"}
        </h1>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold flex-shrink-0 ${credibilityData.credibilityBadge.classes}`}
          title="Credibility Score"
        >
          {credibilityData.credibilityBadge.icon && <span>{renderCredibilityIcon(credibilityData.credibilityBadge.icon)}</span>}
          <span>{credibilityData.credibilityDisplayValue}</span>
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-2">
        Teacher:{" "}
        <span
          onClick={handleTeacherClick}
          className="cursor-pointer text-gray-800 transition-colors duration-300 hover:text-green-500"
        >
          {toTitleCase(note.teacher || '') || "Unknown"}
        </span>
      </p>

      <p className="text-xs text-gray-500 line-clamp-2">
        {variant === 'desktop' ? 'Details: ' : ''}{noteName}
      </p>
    </div>
  )
}