import { useState, useEffect, useCallback } from 'react';
import { getPersonalizedFeed, getPersonalizedFeedWithFilters } from '@/lib/firebase/personalized-feed';
import { auth } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firebase/profiles';
import {
    shouldShowPersonalizedFeed,
    isProfileCompleteForPersonalization,
    trackPersonalizationEvent
} from '@/lib/personalized-feed/feature-flags';
import type { Note } from '@/lib/data/note-types';

interface UsePersonalizedFeedOptions {
    pageSize?: number;
    autoLoad?: boolean;
    filters?: any;
}

export const usePersonalizedFeed = (options: UsePersonalizedFeedOptions = {}) => {
    const { pageSize = 9, autoLoad = true, filters = {} } = options;

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [lastDocSnapshot, setLastDocSnapshot] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPersonalized, setIsPersonalized] = useState(false);

    // Check if user is authenticated and has profile
    const checkPersonalizationAvailable = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) {
            setIsPersonalized(false);
            trackPersonalizationEvent('personalization_unavailable', { reason: 'no_user' });
            return false;
        }

        try {
            // Check feature flag rollout
            if (!shouldShowPersonalizedFeed(user.uid)) {
                setIsPersonalized(false);
                trackPersonalizationEvent('personalization_unavailable', { reason: 'feature_flag' });
                return false;
            }

            // Check if user profile is complete enough
            const profile = await getUserProfile(user.uid);
            if (!profile || !isProfileCompleteForPersonalization(profile)) {
                setIsPersonalized(false);
                trackPersonalizationEvent('personalization_unavailable', {
                    reason: 'incomplete_profile',
                    hasProfile: !!profile,
                    profileData: profile ? {
                        hasMajor: !!profile.major,
                        hasSemester: !!profile.semester,
                        hasSection: !!profile.section
                    } : null
                });
                return false;
            }

            setIsPersonalized(true);
            trackPersonalizationEvent('personalization_available', {
                userId: user.uid,
                profileComplete: true
            });
            return true;
        } catch (error) {
            console.error('Error checking personalization:', error);
            setIsPersonalized(false);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            trackPersonalizationEvent('personalization_error', { error: errorMessage });
            return false;
        }
    }, []);

    // Load initial personalized feed
    const loadFeed = useCallback(async (reset = false) => {
        try {
            setLoading(true);
            setError(null);

            const canPersonalize = await checkPersonalizationAvailable();

            if (!canPersonalize) {
                // Fall back to regular feed logic
                setNotes([]);
                setHasMore(false);
                return;
            }

            const hasFilters = Object.values(filters).some(value =>
                value && value !== '' && value !== null && value !== undefined
            );

            const result = hasFilters
                ? await getPersonalizedFeedWithFilters(filters, { pageSize })
                : await getPersonalizedFeed({ pageSize });

            if (reset) {
                setNotes(result.notes);
            } else {
                setNotes(prev => [...prev, ...result.notes]);
            }

            setLastDocSnapshot(result.lastDocSnapshot);
            setHasMore(result.hasMore);

        } catch (error: any) {
            console.error('Error loading personalized feed:', error);
            setError(error.message);
            setNotes([]);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [filters, pageSize, checkPersonalizationAvailable]);

    // Load more notes
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore || !isPersonalized) return;

        try {
            setLoadingMore(true);
            setError(null);

            const hasFilters = Object.values(filters).some(value =>
                value && value !== '' && value !== null && value !== undefined
            );

            const result = hasFilters
                ? await getPersonalizedFeedWithFilters(filters, {
                    pageSize,
                    lastDocSnapshot
                })
                : await getPersonalizedFeed({
                    pageSize,
                    lastDocSnapshot
                });

            setNotes(prev => [...prev, ...result.notes]);
            setLastDocSnapshot(result.lastDocSnapshot);
            setHasMore(result.hasMore);

        } catch (error: any) {
            console.error('Error loading more notes:', error);
            setError(error.message);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore, hasMore, isPersonalized, filters, pageSize, lastDocSnapshot]);

    // Refresh feed
    const refresh = useCallback(() => {
        setLastDocSnapshot(null);
        setHasMore(true);
        loadFeed(true);
    }, [loadFeed]);

    // Auto-load on mount and filter changes
    useEffect(() => {
        if (autoLoad) {
            refresh();
        }
    }, [autoLoad, filters, refresh]);

    // Listen to auth changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                checkPersonalizationAvailable();
            } else {
                setIsPersonalized(false);
                setNotes([]);
                setHasMore(false);
            }
        });

        return unsubscribe;
    }, [checkPersonalizationAvailable]);

    return {
        notes,
        loading,
        loadingMore,
        hasMore,
        error,
        isPersonalized,
        loadMore,
        refresh,
        setError
    };
};