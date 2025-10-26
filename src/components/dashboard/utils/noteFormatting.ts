import { toTitleCase, normalizeForStorage } from '@/lib/utils'
import { getCredibilityBadge } from '../constants'
import { Note } from '../note-card/types'

export const formatMaterialType = (value: string) => {
  if (!value) return 'Not specified'
  return toTitleCase(value.replace(/-/g, ' '))
}

export const getMaterialTypeValue = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return normalizeForStorage(value)
}

export const buildMaterialDisplay = (note: Note) => {
  const typeValue = getMaterialTypeValue(note.materialType)
  if (!typeValue) return 'Not specified'

  const sequenceValue = note.materialSequence ?? ''
  if ((typeValue === 'assignment' || typeValue === 'quiz') && sequenceValue) {
    return `${formatMaterialType(typeValue)} ${sequenceValue}`
  }
  return formatMaterialType(typeValue)
}

export const handleMaterialFilterToggle = (
  note: Note,
  materialTypeFilter: string,
  materialSequenceFilter: string,
  setMaterialTypeFilter: (value: string) => void,
  setMaterialSequenceFilter: (value: string) => void
) => {
  const typeValue = getMaterialTypeValue(note.materialType)
  if (!typeValue) return

  const sequenceValue = (note.materialSequence ?? '').toString()
  const requiresSequence = typeValue === 'assignment' || typeValue === 'quiz'
  const sequenceMatch = requiresSequence ? sequenceValue === materialSequenceFilter : materialSequenceFilter === ''
  const isActive = materialTypeFilter === typeValue && sequenceMatch

  if (isActive) {
    setMaterialTypeFilter('')
    setMaterialSequenceFilter('')
  } else {
    setMaterialTypeFilter(typeValue)
    setMaterialSequenceFilter(requiresSequence ? sequenceValue : '')
  }
}

export const getCredibilityData = (note: Note) => {
  const credibilityScoreRaw = typeof note.credibilityScore === 'number' ? note.credibilityScore : 0
  const credibilityScoreValue = Math.round(credibilityScoreRaw)
  const credibilityBadge = getCredibilityBadge(credibilityScoreValue)
  const credibilityDisplayValue = credibilityScoreValue > 0 ? `+${credibilityScoreValue}` : `${credibilityScoreValue}`

  return { credibilityScoreValue, credibilityDisplayValue, credibilityBadge }
}

export const getBadgeClasses = () => ({
  base: 'rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-[#90c639] hover:bg-[#90c639]/10',
  active: 'border-[#90c639] bg-[#90c639]/15 text-[#1f3f1f] shadow-sm'
})