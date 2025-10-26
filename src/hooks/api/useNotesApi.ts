import { useCallback, useState } from 'react';
import {
    addNote,
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    voteOnNote,
    toggleSaveNote,
} from '../../lib/firebase/notes';
import { VoteOnNoteResult, ToggleSaveNoteResult, NotesQueryResult } from '../../lib/data/types';

export const useNotesApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAsync = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await asyncFn();
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            console.error('Notes API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        addNote: useCallback((noteData: any) =>
            handleAsync(() => addNote(noteData)), [handleAsync]),

        getNotes: useCallback(() =>
            handleAsync(() => getNotes()), [handleAsync]),

        getNotesWithPagination: useCallback((pageSize?: number, lastDocSnapshot?: any, filters?: any) =>
            handleAsync(() => getNotesWithPagination(pageSize, lastDocSnapshot, filters)), [handleAsync]),

        getInitialNotes: useCallback(() =>
            handleAsync(() => getInitialNotes()), [handleAsync]),

        searchNotes: useCallback((searchTerm: string, pageSize?: number, lastDocSnapshot?: any) =>
            handleAsync(() => searchNotes(searchTerm, pageSize, lastDocSnapshot)), [handleAsync]),

        getFilterOptions: useCallback(() =>
            handleAsync(() => getFilterOptions()), [handleAsync]),

        getTotalNotesCount: useCallback(() =>
            handleAsync(() => getTotalNotesCount()), [handleAsync]),

        getAllNotesWithFilters: useCallback((filters?: any, searchTerm?: string) =>
            handleAsync(() => getAllNotesWithFilters(filters, searchTerm)), [handleAsync]),

        voteOnNote: useCallback((noteId: string, voteType: 'up' | 'down'): Promise<VoteOnNoteResult | null> =>
            handleAsync(() => voteOnNote(noteId, voteType)), [handleAsync]),

        toggleSaveNote: useCallback((noteId: string): Promise<ToggleSaveNoteResult | null> =>
            handleAsync(() => toggleSaveNote(noteId)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};