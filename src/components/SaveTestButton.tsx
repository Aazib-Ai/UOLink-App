'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'

interface SaveTestButtonProps {
  noteId: string
  initialSaved?: boolean
  onToggle: (noteId: string) => void
  isSaving?: boolean
}

export const SaveTestButton: React.FC<SaveTestButtonProps> = ({
  noteId,
  initialSaved = false,
  onToggle,
  isSaving = false
}) => {
  const [isSaved, setIsSaved] = useState(initialSaved)

  const handleClick = () => {
    console.log(`Test button clicked for note ${noteId}, current state: ${isSaved}`)
    setIsSaved(!isSaved) // Toggle local state immediately for testing
    onToggle(noteId)
  }

  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <button
        onClick={handleClick}
        disabled={isSaving}
        className={`flex items-center gap-2 px-3 py-2 rounded transition-all ${
          isSaved 
            ? 'bg-green-100 text-green-800 border-green-300' 
            : 'bg-gray-100 text-gray-600 border-gray-300'
        } ${isSaving ? 'opacity-50' : 'hover:scale-105'}`}
      >
        <Bookmark 
          size={16} 
          className={isSaved ? 'fill-current' : ''} 
        />
        <span className="text-sm font-medium">
          {isSaving ? 'Saving...' : (isSaved ? 'Saved' : 'Save')}
        </span>
      </button>
      <div className="text-xs text-gray-500">
        Note: {noteId} | State: {isSaved ? 'Saved' : 'Not saved'}
      </div>
    </div>
  )
}