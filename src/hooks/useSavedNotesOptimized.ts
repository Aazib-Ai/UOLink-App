import { useState, useEffect, useCallback } from 'react'
import { toggleSaveNote } from '@/lib/api/notes'
import { auth } from '@/lib/firebase'
import { fetchSavedNoteIdsEfficient } from '@/lib/firebase/saved-notes-index'

export const useSavedNotesOptimized = (applyNotePatch: (noteId: string, patch: Record<string, any>) => void) => {
    const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>({})
    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set())
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    // Fetch saved notes on mount - single read via index doc
    useEffect(() => {
        let isMounted = true

        const fetchSavedNotes = async () => {
            if (!auth.currentUser) {
                setIsInitialLoading(false)
                return
            }

            try {
                const userId = auth.currentUser.uid
                let localIds: string[] | null = null
                if (typeof window !== 'undefined') {
                    try {
                        const raw = window.localStorage.getItem(`savedNotes:${userId}`)
                        const parsed = raw ? JSON.parse(raw) : null
                        if (Array.isArray(parsed)) {
                            localIds = parsed as string[]
                            const localSaved: Record<string, boolean> = {}
                            for (const id of localIds) localSaved[id] = true
                            setSavedNotes(localSaved)
                        }
                    } catch {}
                }
                const ids = await fetchSavedNoteIdsEfficient(userId)

                if (!isMounted) return

                const saved: Record<string, boolean> = {}
                for (const id of ids) {
                    saved[id] = true
                }

                setSavedNotes(saved)
                if (typeof window !== 'undefined') {
                    try {
                        window.localStorage.setItem(`savedNotes:${userId}`, JSON.stringify(ids))
                    } catch {}
                }
            } catch (error) {
                console.error("Error fetching saved notes:", error)
            } finally {
                if (isMounted) {
                    setIsInitialLoading(false)
                }
            }
        }

        fetchSavedNotes()

        return () => {
            isMounted = false
        }
    }, [auth.currentUser?.uid])

    // Optimistic update function
    const applyOptimisticSave = useCallback((noteId: string, shouldSave: boolean) => {
        setSavedNotes(prev => {
            const updated = { ...prev }
            if (shouldSave) {
                updated[noteId] = true
            } else {
                delete updated[noteId]
            }
            return updated
        })
    }, [])

    // Revert optimistic update on error
    const revertOptimisticSave = useCallback((noteId: string, originalState: boolean) => {
        setSavedNotes(prev => {
            const updated = { ...prev }
            if (originalState) {
                updated[noteId] = true
            } else {
                delete updated[noteId]
            }
            return updated
        })
    }, [])

    // Handle save note with optimistic updates
    const handleSaveNote = useCallback(async (noteId: string) => {
        if (!auth.currentUser) {
            // Show a non-blocking notification instead of alert
            console.warn("Please log in to save notes!")
            return
        }

        // Prevent multiple simultaneous saves for the same note
        if (pendingSaves.has(noteId)) {
            console.log(`Save already in progress for note ${noteId}`)
            return
        }

        const wasAlreadySaved = savedNotes[noteId] || false
        const willBeSaved = !wasAlreadySaved

        console.log(`Toggling save for note ${noteId}: ${wasAlreadySaved} -> ${willBeSaved}`)

        // Add to pending saves
        setPendingSaves(prev => new Set(prev).add(noteId))

        // Apply optimistic update immediately
        applyOptimisticSave(noteId, willBeSaved)

        try {
            // Make the actual API call
            const result = await toggleSaveNote(noteId)
            console.log(`Server response for note ${noteId}:`, result)

            // Update note patch with server response
            const now = new Date()
            applyNotePatch(noteId, {
                saveCount: result.saveCount,
                credibilityScore: result.credibilityScore,
                lastInteractionAt: now,
                credibilityUpdatedAt: now,
            })

            // Ensure local state matches server response
            setSavedNotes(prev => {
                const updated = { ...prev }
                if (result.saved) {
                    updated[noteId] = true
                } else {
                    delete updated[noteId]
                }
                console.log(`Final state for note ${noteId}: ${result.saved}`)

                // Show success feedback
                if (typeof window !== 'undefined') {
                    const message = result.saved ? 'Note saved!' : 'Note unsaved!'
                    console.log(message)
                }

                return updated
            })

            try {
                const uid = auth.currentUser?.uid
                if (uid && typeof window !== 'undefined') {
                    const raw = window.localStorage.getItem(`savedNotes:${uid}`)
                    const parsed = raw ? JSON.parse(raw) : null
                    let ids = Array.isArray(parsed) ? (parsed as string[]) : []
                    const set = new Set(ids)
                    if (result.saved) set.add(noteId)
                    else set.delete(noteId)
                    ids = Array.from(set)
                    window.localStorage.setItem(`savedNotes:${uid}`, JSON.stringify(ids))
                }
            } catch {}

        } catch (error: any) {
            console.error("Error saving note:", error)

            // Revert optimistic update on error
            revertOptimisticSave(noteId, wasAlreadySaved)
            console.log(`Reverted note ${noteId} to original state: ${wasAlreadySaved}`)

            // Show a non-blocking error message
            const message = error?.message || "Error saving note. Please try again."
            console.warn(message)

        } finally {
            // Remove from pending saves
            setPendingSaves(prev => {
                const updated = new Set(prev)
                updated.delete(noteId)
                return updated
            })
        }
    }, [savedNotes, pendingSaves, applyNotePatch, applyOptimisticSave, revertOptimisticSave])

    // Check if a note is currently being saved
    const isNoteSaving = useCallback((noteId: string) => {
        return pendingSaves.has(noteId)
    }, [pendingSaves])

    return {
        savedNotes,
        handleSaveNote,
        isNoteSaving,
        isInitialLoading,
        // Deprecated - keeping for backward compatibility but always false
        savingNotes: false,
    }
}
