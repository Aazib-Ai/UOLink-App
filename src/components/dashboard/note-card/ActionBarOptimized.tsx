'use client'

import { useCallback } from 'react'
import { Bookmark, Trash } from 'lucide-react'
import { Note, HandlerCallbacks } from './types'
import VoteButtonOptimized from '../../VoteButtonOptimized'
import ReportButton from '../../ReportButton'

interface ActionBarProps {
  note: Note
  savedNotes: Record<string, boolean>
  handlers: HandlerCallbacks
  admin: boolean
  user: any
  variant?: 'mobile' | 'desktop'
  isNoteSaving?: (noteId: string) => boolean
}

export const ActionBarOptimized: React.FC<ActionBarProps> = ({
  note,
  savedNotes,
  handlers,
  admin,
  user,
  variant = 'desktop',
  isNoteSaving = () => false
}) => {
  const isSaved = savedNotes[note.id] || false
  const isSaving = isNoteSaving(note.id)

  const handleScoreUpdate = useCallback((result: any) => {
    handlers.handleVoteScoreUpdate(note.id, {
      upvotes: result.upvotes,
      downvotes: result.downvotes,
      credibilityScore: result.credibilityScore
    })
  }, [handlers.handleVoteScoreUpdate, note.id])

  const handleSaveClick = useCallback((event: React.MouseEvent) => {
    // Prevent any default behavior and event bubbling
    event.preventDefault()
    event.stopPropagation()
    
    console.log(`Save button clicked - noteId: ${note.id}, isSaved: ${isSaved}, isSaving: ${isSaving}`)
    
    if (!isSaving) {
      handlers.handleSaveNote(note.id)
    }
  }, [handlers.handleSaveNote, note.id, isSaved, isSaving])

  const handleReportUpdate = useCallback((noteId: string, reportCount: number, hasReported: boolean) => {
    console.log(`Report updated - noteId: ${noteId}, reportCount: ${reportCount}, hasReported: ${hasReported}`)
    handlers.handleReportUpdate(noteId, reportCount, hasReported)
  }, [handlers.handleReportUpdate])

  return (
    <div className={`flex items-center justify-between ${variant === 'mobile' ? 'px-4 py-3' : 'px-6 py-4'} border-t border-gray-100`}>
      <div className="flex items-center gap-3">
        <VoteButtonOptimized
          noteId={note.id}
          initialUpvotes={note.upvoteCount || 0}
          initialDownvotes={note.downvoteCount || 0}
          size={variant === 'mobile' ? 'sm' : 'md'}
          onScoreUpdate={handleScoreUpdate}
        />

        <div className="relative">
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={isSaving}
            className={`group relative transition-all duration-200 ${
              isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'
            }`}
            aria-label={isSaved ? 'Remove from saved notes' : 'Save note'}
            title={isSaved ? 'Click to unsave' : 'Click to save'}
          >
            {isSaved ? (
              // Saved state: Filled green bookmark
              <Bookmark
                size={variant === 'desktop' ? 20 : 18}
                className="fill-[#90c639] text-[#90c639] transition-all duration-300 drop-shadow-sm"
              />
            ) : (
              // Unsaved state: Black outline bookmark
              <Bookmark
                size={variant === 'desktop' ? 20 : 18}
                className="text-black transition-all duration-300 hover:fill-[#90c639] hover:text-[#90c639]"
                style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }}
              />
            )}
            
            {/* Visual feedback for saved state */}
            {isSaved && !isSaving && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#90c639] rounded-full" />
            )}
          </button>
          
          {/* Loading indicator for save operations */}
          {isSaving && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-ping" />
          )}
          
          {/* Tooltip for better UX */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            {isSaved ? 'Click to unsave' : 'Click to save'}
          </div>
        </div>

        <ReportButton 
          noteId={note.id} 
          size={variant === 'mobile' ? 'sm' : 'md'} 
          onReportUpdate={handleReportUpdate}
        />
      </div>

      {admin && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handlers.handleDelete(note.id, note.name, note.subject)
          }}
          className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
        >
          <Trash size={14} />
          Delete
        </button>
      )}
    </div>
  )
}
