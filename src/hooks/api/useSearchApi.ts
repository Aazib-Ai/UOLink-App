import { useCallback, useState } from 'react';
import { getNotes } from '../../lib/firebase/search';
import { searchNotesDeduped, getFilterOptionsDeduped } from '../../lib/firebase/request-deduplication';
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
            handleAsync(() => searchNotesDeduped(searchTerm, pageSize, lastDocSnapshot)), [handleAsync]),

        getNotes: useCallback(() =>
            handleAsync(() => getNotes()), [handleAsync]),

        getFilterOptions: useCallback(() =>
            handleAsync(() => getFilterOptionsDeduped()), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};
