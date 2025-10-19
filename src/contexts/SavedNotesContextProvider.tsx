'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface SavedNote {
  id: string
  [key: string]: any
}

interface SavedNotesContextType {
  savedNotes: SavedNote[]
  setSavedNotes: (notes: SavedNote[]) => void
  addToSaved: (note: SavedNote) => void
  removeFromSaved: (noteId: string) => void
  isSaved: (noteId: string) => boolean
}

const SavedNotesContext = createContext<SavedNotesContextType | undefined>(undefined)

export function useSavedNotes() {
  const context = useContext(SavedNotesContext)
  if (context === undefined) {
    throw new Error('useSavedNotes must be used within a SavedNotesContextProvider')
  }
  return context
}

interface SavedNotesContextProviderProps {
  children: ReactNode
}

export function SavedNotesContextProvider({ children }: SavedNotesContextProviderProps) {
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([])

  const addToSaved = (note: SavedNote) => {
    setSavedNotes(prev => {
      if (prev.find(n => n.id === note.id)) {
        return prev
      }
      return [...prev, note]
    })
  }

  const removeFromSaved = (noteId: string) => {
    setSavedNotes(prev => prev.filter(note => note.id !== noteId))
  }

  const isSaved = (noteId: string) => {
    return savedNotes.some(note => note.id === noteId)
  }

  const value: SavedNotesContextType = {
    savedNotes,
    setSavedNotes,
    addToSaved,
    removeFromSaved,
    isSaved
  }

  return (
    <SavedNotesContext.Provider value={value}>
      {children}
    </SavedNotesContext.Provider>
  )
}

export default SavedNotesContext