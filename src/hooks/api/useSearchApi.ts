import { useCallback, useState } from 'react';
import {
    searchNotes,
    getNotes,
    getFilterOptions,
} from '../../lib/firebase/search';
import { NotesQueryResult } from '../../lib/data/types';

export const useSearchApi = () => {
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
            console.error('Search API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        searchNotes: useCallback((searchTerm: string, pageSize?: number, lastDocSnapshot?: any): Promise<NotesQueryResult | null> =>
            handleAsync(() => searchNotes(searchTerm, pageSize, lastDocSnapshot)), [handleAsync]),

        getNotes: useCallback(() =>
            handleAsync(() => getNotes()), [handleAsync]),

        getFilterOptions: useCallback(() =>
            handleAsync(() => getFilterOptions()), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};