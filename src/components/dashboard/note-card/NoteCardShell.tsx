import React, { useMemo } from 'react'
import { Header } from './Header'
import { MetadataChips } from './MetadataChips'
import { ContributorBadge } from './ContributorBadge'
import { OptimizedPreviewPane } from './OptimizedPreviewPane'
import { ActionBarOptimized } from './ActionBarOptimized'
import { getVariantStyles } from './variantConfig'
import {
  Note,
  FilterState,
  HandlerCallbacks,
  ProfileData,
  CredibilityData,
  BadgeState,
  DerivedNoteData,
  Variant
} from './types'
import {
  getMaterialTypeValue,
  handleMaterialFilterToggle,
  getBadgeClasses
} from '../utils/noteFormatting'
import { formatAura } from '@/lib/aura'

interface NoteCardShellProps {
  note: Note
  filters: FilterState
  handlers?: HandlerCallbacks
  profileData: ProfileData
  savedNotes: Record<string, boolean>
  admin: boolean
  user: any
  isNoteSaving?: (noteId: string) => boolean
  variant: Variant
  className?: string
}

export const NoteCardShell: React.FC<NoteCardShellProps> = ({
  note,
  filters,
  handlers,
  profileData,
  savedNotes,
  admin,
  user,
  isNoteSaving,
  variant,
  className = ''
}) => {
  // Provide default handlers if none are provided
  const defaultHandlers: HandlerCallbacks = {
    handleViewNote: () => {},
    handleSaveNote: () => {},
    handleVoteScoreUpdate: () => {},
    handleReportUpdate: () => {},
    handleDelete: () => {},
    handleShare: () => {}
  }

  const safeHandlers = handlers || defaultHandlers

  // Memoize all derived calculations
  const derivedData = useMemo(() => {
    const noteSection = note.section?.toString().toUpperCase() || ''
    const materialTypeValue = getMaterialTypeValue(note.materialType)
    const sequenceValue = note.materialSequence?.toString() || ''
    const materialDisplay = materialTypeValue && sequenceValue 
      ? `${materialTypeValue} ${sequenceValue}` 
      : materialTypeValue || 'Not specified'

    const isSemesterActive = filters.semesterFilter === note.semester && !!note.semester
    const isSectionActive = filters.sectionFilter === noteSection && !!noteSection
    const isMaterialActive =
      filters.materialTypeFilter === materialTypeValue &&
      (!!materialTypeValue &&
        (!['assignment', 'quiz'].includes(materialTypeValue) || filters.materialSequenceFilter === sequenceValue))

    const { base: badgeBase, active: badgeActive } = getBadgeClasses()
    const contributorUserId = typeof note.uploadedBy === 'string' ? note.uploadedBy : ''
    const auraDetails = contributorUserId ? profileData.profileAura[contributorUserId] : undefined
    const auraBorderClass = auraDetails?.borderClass ?? 'ring-1 ring-slate-200 ring-offset-2 ring-offset-white'
    const auraScoreLabel = auraDetails ? formatAura(auraDetails.aura) : null
    const saveCount = Math.max(0, Number(note.saveCount ?? 0))

    return {
      noteSection,
      materialDisplay,
      auraDetails,
      auraBorderClass,
      auraScoreLabel,
      saveCount,
      badgeState: {
        isSemesterActive,
        isSectionActive,
        isMaterialActive,
        badgeBase,
        badgeActive
      }
    }
  }, [note, filters, profileData])

  const styles = useMemo(() => getVariantStyles(variant), [variant])

  const handleMaterialFilterToggleCallback = () => {
    handleMaterialFilterToggle(
      note,
      filters.materialTypeFilter,
      filters.materialSequenceFilter,
      filters.setMaterialTypeFilter,
      filters.setMaterialSequenceFilter
    )
  }
  return (
    <div className={className}>
      {/* Responsive container that adapts based on screen size */}
      {variant === 'mobile' && (
        <>
          {/* Header with Title and Vibe Score */}
          <div className="p-4 pb-3 border-b border-gray-100">
            <Header
              note={note}
              filters={filters}
              noteName={note.name}
              variant="mobile"
              onViewNote={safeHandlers.handleViewNote}
            />
            <MetadataChips
              note={note}
              filters={filters}
              noteSection={derivedData.noteSection}
              materialDisplay={derivedData.materialDisplay}
              handleMaterialFilterToggle={handleMaterialFilterToggleCallback}
              badgeState={derivedData.badgeState}
              variant="mobile"
            />
          </div>

          {/* Preview Image */}
          <OptimizedPreviewPane
            note={note}
            handleViewNote={safeHandlers.handleViewNote}
            variant="mobile"
            priority={false}
          />

          {/* Contributor Info */}
          <div className="px-4 py-3 bg-white border-b border-gray-100">
            <ContributorBadge
              note={note}
              profileData={profileData}
              auraBorderClass={derivedData.auraBorderClass}
              auraDetails={derivedData.auraDetails}
              auraScoreLabel={derivedData.auraScoreLabel}
              variant="mobile"
            />
          </div>

          {/* Action Buttons */}
          <ActionBarOptimized
            note={note}
            savedNotes={savedNotes}
            admin={admin}
            user={user}
            handlers={safeHandlers}
            variant="mobile"
            isNoteSaving={isNoteSaving}
          />
        </>
      )}

      {(variant === 'tablet' || variant === 'desktop') && (
        <div className={variant === 'tablet' ? 'p-5' : 'p-6'}>
          <div className={`flex ${styles.layout.direction === 'row' ? 'gap-4' : ''}`}>
            {/* Content Section */}
            <div className={styles.layout.direction === 'row' ? 'flex-1' : ''}>
              {/* Header */}
          <div className={styles.layout.direction === 'column' ? 'mb-3' : ''}>
            <Header
              note={note}
              filters={filters}
              noteName={note.name}
              variant={variant}
              onViewNote={safeHandlers.handleViewNote}
            />
          </div>

              {/* Badges */}
              <div className={styles.layout.direction === 'column' ? 'mb-4' : ''}>
                <MetadataChips
                  note={note}
                  filters={filters}
                  noteSection={derivedData.noteSection}
                  materialDisplay={derivedData.materialDisplay}
                  handleMaterialFilterToggle={handleMaterialFilterToggleCallback}
                  badgeState={derivedData.badgeState}
                  variant={variant}
                />
              </div>

              {/* Contributor Info */}
              {variant === 'tablet' && (
                <div className="mb-4">
                  <ContributorBadge
                    note={note}
                    profileData={profileData}
                    auraBorderClass={derivedData.auraBorderClass}
                    auraDetails={derivedData.auraDetails}
                    auraScoreLabel={derivedData.auraScoreLabel}
                    variant="tablet"
                  />
                </div>
              )}

              {/* Action Buttons for tablet */}
              {variant === 'tablet' && (
                <ActionBarOptimized
                  note={note}
                  savedNotes={savedNotes}
                  admin={admin}
                  user={user}
                  handlers={safeHandlers}
                  variant="desktop"
                  isNoteSaving={isNoteSaving}
                />
              )}

              {/* Contributor Badge for desktop */}
              {variant === 'desktop' && (
                <ContributorBadge
                  note={note}
                  profileData={profileData}
                  auraBorderClass={derivedData.auraBorderClass}
                  auraDetails={derivedData.auraDetails}
                  auraScoreLabel={derivedData.auraScoreLabel}
                  variant="desktop"
                />
              )}
            </div>

            {/* Preview Image Section */}
            <OptimizedPreviewPane
              note={note}
              handleViewNote={safeHandlers.handleViewNote}
              variant={variant}
              priority={false}
            />
          </div>

          {/* Action Bar for desktop */}
          {variant === 'desktop' && (
            <ActionBarOptimized
              note={note}
              savedNotes={savedNotes}
              admin={admin}
              user={user}
              handlers={safeHandlers}
              variant="desktop"
              isNoteSaving={isNoteSaving}
            />
          )}
        </div>
      )}
    </div>
  )
}
