import { useCallback, useState } from 'react';
import { getAuraLeaderboard } from '../../lib/firebase/profiles';
import { getUserProfileDeduped } from '../../lib/firebase/request-deduplication';
import { getUserByUsernameOnly } from '../../lib/firebase/profile-resolver';
import { UserProfile } from '../../lib/data/types';

export const useProfilesApi = () => {
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
            console.error('Profiles API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        getAuraLeaderboard: useCallback((limitCount?: number) =>
            handleAsync(() => getAuraLeaderboard(limitCount)), [handleAsync]),

        getUserProfile: useCallback((userId: string): Promise<UserProfile | null> =>
            handleAsync(() => getUserProfileDeduped(userId)), [handleAsync]),

        getUserProfileByName: useCallback((identifier: string): Promise<UserProfile | null> =>
            handleAsync(() => getUserByUsernameOnly(identifier)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};
