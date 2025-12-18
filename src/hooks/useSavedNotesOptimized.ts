import { useState, useEffect, useCallback } from 'react'
import { toggleSaveNote } from '@/lib/api/notes'
import { auth } from '@/lib/firebase'
import { useUserInteractions } from '@/contexts/UserInteractionsContext'

const SAVED_NOTES_STORAGE_KEY = 'uolink_saved_notes'

export const useSavedNotesOptimized = (applyNotePatch: (noteId: string, patch: Record<string, any>) => void) => {
    const interactions = useUserInteractions()

    // Initialize savedNotes from localStorage
    const [savedNotes, setSavedNotes] = useState<Record<string, boolean>>(() => {
        if (typeof window === 'undefined') return {}
        try {
            const stored = localStorage.getItem(SAVED_NOTES_STORAGE_KEY)
            return stored ? JSON.parse(stored) : {}
        } catch (error) {
            console.error('Error loading saved notes from localStorage:', error)
            return {}
        }
    })

    const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set())
    const [isInitialLoading, setIsInitialLoading] = useState(true)

    // Sync savedNotes to localStorage whenever it changes
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            localStorage.setItem(SAVED_NOTES_STORAGE_KEY, JSON.stringify(savedNotes))
        } catch (error) {
            console.error('Error saving notes to localStorage:', error)
        }
    }, [savedNotes])

    // Fetch saved notes from interaction context and merge with localStorage
    useEffect(() => {
        let isMounted = true

        const fetchSavedNotes = async () => {
            if (!auth.currentUser) {
                setIsInitialLoading(false)
                return
            }

            try {
                await interactions.ensureLoaded()
                const snap = interactions.getSnapshot()
                const ids = snap.savedIds

                if (!isMounted) return

                const serverSaved: Record<string, boolean> = {}
                for (const id of ids) {
                    serverSaved[id] = true
                }

                // Merge server data with localStorage data
                setSavedNotes(prev => {
                    const merged = { ...prev, ...serverSaved }
                    return merged
                })
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

            interactions.syncSavedFromServer(noteId, result.saved)

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
