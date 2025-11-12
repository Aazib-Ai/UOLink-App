import { useCallback, useState } from 'react';
import { adjustAura } from '@/lib/api/aura'
import { getAuraLeaderboard } from '@/lib/firebase/aura'

export const useAuraApi = () => {
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
            console.error('Aura API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        adjustUserAura: useCallback((userId: string, auraDelta: number) =>
            handleAsync(() => adjustAura(userId, auraDelta)), [handleAsync]),

        getAuraLeaderboard: useCallback((limitCount?: number) =>
            handleAsync(() => getAuraLeaderboard(limitCount)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};
