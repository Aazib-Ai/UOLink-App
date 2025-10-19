'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface Note {
  id: string
  name: string
  subject: string
  semester: string
  teacher?: string
  section?: string
  materialType?: string
  materialSequence?: string | null
  contributorName: string
  contributorMajor?: string
  uploadedAt: any
  fileUrl?: string
  storageProvider?: string
  storageBucket?: string
  storageKey?: string
  fileSize?: number
  contentType?: string
  originalFileName?: string
  [key: string]: any
}

interface NotesContextType {
  notes: Note[]
  setNotes: (notes: Note[]) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  hasMore: boolean
  setHasMore: (hasMore: boolean) => void
  lastDocSnapshot: any
  setLastDocSnapshot: (snapshot: any) => void
}

const NotesContext = createContext<NotesContextType | undefined>(undefined)

export function useNotes() {
  const context = useContext(NotesContext)
  if (context === undefined) {
    throw new Error('useNotes must be used within a NotesContextProvider')
  }
  return context
}

interface NotesContextProviderProps {
  children: ReactNode
}

export function NotesContextProvider({ children }: NotesContextProviderProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [lastDocSnapshot, setLastDocSnapshot] = useState(null)

  const value: NotesContextType = {
    notes,
    setNotes,
    loading,
    setLoading,
    error,
    setError,
    currentPage,
    setCurrentPage,
    hasMore,
    setHasMore,
    lastDocSnapshot,
    setLastDocSnapshot
  }

  return (
    <NotesContext.Provider value={value}>
      {children}
    </NotesContext.Provider>
  )
}

export default NotesContext
