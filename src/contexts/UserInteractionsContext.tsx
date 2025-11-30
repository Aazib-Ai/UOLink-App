'use client'

import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { fetchInteractionIndexEfficient } from '@/lib/firebase/saved-notes-index'
import { useAuth } from '@/contexts/AuthContext'

type Vote = 'up' | 'down' | null

interface InteractionState {
  saved: Set<string>
  up: Set<string>
  down: Set<string>
}

interface Ctx {
  isLoaded: boolean
  ensureLoaded: () => Promise<void>
  isSaved: (noteId: string) => boolean
  userVote: (noteId: string) => Vote
  optimisticSave: (noteId: string, shouldSave: boolean) => void
  optimisticVote: (noteId: string, nextVote: Vote) => void
  syncSavedFromServer: (noteId: string, saved: boolean) => void
  syncVoteFromServer: (noteId: string, nextVote: Vote) => void
  prefetchForNotes: (noteIds: string[]) => Promise<void>
  getSnapshot: () => { savedIds: string[]; votesUp: string[]; votesDown: string[] }
}

const UserInteractionsContext = createContext<Ctx | undefined>(undefined)

export function useUserInteractions() {
  const ctx = useContext(UserInteractionsContext)
  if (!ctx) throw new Error('useUserInteractions must be used within UserInteractionsProvider')
  return ctx
}

export function UserInteractionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<InteractionState>({ saved: new Set(), up: new Set(), down: new Set() })
  const loadingRef = useRef<Promise<void> | null>(null)

  const ensureLoaded = async () => {
    if (!user) return
    if (loaded) return
    if (loadingRef.current) return loadingRef.current
    const p = (async () => {
      let local = { saved: [] as string[], up: [] as string[], down: [] as string[] }
      if (typeof window !== 'undefined') {
        try {
          const raw = window.localStorage.getItem(`interactionIndex:${user.uid}`)
          const parsed = raw ? JSON.parse(raw) : null
          if (parsed && Array.isArray(parsed.saved) && Array.isArray(parsed.up) && Array.isArray(parsed.down)) {
            local = parsed
            setState({ saved: new Set(local.saved), up: new Set(local.up), down: new Set(local.down) })
          }
        } catch {}
      }
      const idx = await fetchInteractionIndexEfficient(user.uid)
      setState({ saved: new Set(idx.saved), up: new Set(idx.up), down: new Set(idx.down) })
      setLoaded(true)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(`interactionIndex:${user.uid}`, JSON.stringify(idx))
        } catch {}
      }
    })()
    loadingRef.current = p
    await p
    loadingRef.current = null
  }

  const isSaved = (noteId: string) => state.saved.has(noteId)
  const userVote = (noteId: string): Vote => {
    if (state.up.has(noteId)) return 'up'
    if (state.down.has(noteId)) return 'down'
    return null
  }

  const optimisticSave = (noteId: string, shouldSave: boolean) => {
    setState(prev => {
      const next: InteractionState = { saved: new Set(prev.saved), up: new Set(prev.up), down: new Set(prev.down) }
      if (shouldSave) next.saved.add(noteId)
      else next.saved.delete(noteId)
      return next
    })
    if (typeof window !== 'undefined' && user) {
      try {
        const raw = window.localStorage.getItem(`interactionIndex:${user.uid}`)
        const parsed = raw ? JSON.parse(raw) : { saved: [], up: [], down: [] }
        const set = new Set<string>(Array.isArray(parsed.saved) ? parsed.saved : [])
        if (shouldSave) set.add(noteId)
        else set.delete(noteId)
        parsed.saved = Array.from(set)
        window.localStorage.setItem(`interactionIndex:${user.uid}`, JSON.stringify(parsed))
      } catch {}
    }
  }

  const optimisticVote = (noteId: string, nextVote: Vote) => {
    setState(prev => {
      const next: InteractionState = { saved: new Set(prev.saved), up: new Set(prev.up), down: new Set(prev.down) }
      next.up.delete(noteId)
      next.down.delete(noteId)
      if (nextVote === 'up') next.up.add(noteId)
      else if (nextVote === 'down') next.down.add(noteId)
      return next
    })
    if (typeof window !== 'undefined' && user) {
      try {
        const raw = window.localStorage.getItem(`interactionIndex:${user.uid}`)
        const parsed = raw ? JSON.parse(raw) : { saved: [], up: [], down: [] }
        const upSet = new Set<string>(Array.isArray(parsed.up) ? parsed.up : [])
        const downSet = new Set<string>(Array.isArray(parsed.down) ? parsed.down : [])
        upSet.delete(noteId)
        downSet.delete(noteId)
        if (nextVote === 'up') upSet.add(noteId)
        else if (nextVote === 'down') downSet.add(noteId)
        parsed.up = Array.from(upSet)
        parsed.down = Array.from(downSet)
        window.localStorage.setItem(`interactionIndex:${user.uid}`, JSON.stringify(parsed))
      } catch {}
    }
  }

  const syncSavedFromServer = (noteId: string, saved: boolean) => {
    optimisticSave(noteId, saved)
  }

  const syncVoteFromServer = (noteId: string, nextVote: Vote) => {
    optimisticVote(noteId, nextVote)
  }

  const prefetchForNotes = async (_noteIds: string[]) => {
    await ensureLoaded()
  }

  const value = useMemo<Ctx>(() => ({
    isLoaded: loaded,
    ensureLoaded,
    isSaved,
    userVote,
    optimisticSave,
    optimisticVote,
    syncSavedFromServer,
    syncVoteFromServer,
    prefetchForNotes,
    getSnapshot: () => ({ savedIds: Array.from(state.saved), votesUp: Array.from(state.up), votesDown: Array.from(state.down) }),
  }), [loaded, state, user])

  return (
    <UserInteractionsContext.Provider value={value}>{children}</UserInteractionsContext.Provider>
  )
}

export default UserInteractionsContext
