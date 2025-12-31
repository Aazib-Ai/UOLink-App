/**
 * useCachedPage - Hook for accessing cached page data with consistent lifecycle
 * Implements Requirements 7.3, 1.1
 * - Consistent component lifecycle (synchronous cache access)
 * - Immediate content display
 */

import { useState, useEffect, useRef } from 'react';
import { usePageCache } from '../page-cache-context';

interface CachedPageResult<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
}

export function useCachedPage<T>(key: string): CachedPageResult<T> {
    const { getCacheEntrySync, getCacheEntry, subscribeToUpdates } = usePageCache();

    // Initialize with synchronous cache if available
    const [data, setData] = useState<T | null>(() => {
        const entry = getCacheEntrySync<T>(key);
        return entry ? entry.data : null;
    });

    const [isLoading, setIsLoading] = useState<boolean>(() => {
        const entry = getCacheEntrySync<T>(key);
        return !entry;
    });

    const [error, setError] = useState<Error | null>(null);
    const prevKeyRef = useRef(key);

    useEffect(() => {
        let mounted = true;

        // Reset if key changed
        if (key !== prevKeyRef.current) {
            const syncEntry = getCacheEntrySync<T>(key);
            if (syncEntry) {
                setData(syncEntry.data);
                setIsLoading(false);
            } else {
                setData(null);
                setIsLoading(true);
            }
            prevKeyRef.current = key;
        }

        const fetchData = async () => {
            // Basic fetch from async cache (IDB) if needed
            // If we already have sync data (from useState init or key change above), 
            // we might only need to listen for updates or background refresh.
            // But checking IDB is safer if memory cache was empty but IDB has it.

            // Check if we need to fetch (if loading is true, or even if false to double check IDB?)
            // Generally if memory hit, we trust it. If memory miss, we check IDB.
            // isLoading tracks if we have any data.

            if (isLoading || !data) {
                try {
                    const entry = await getCacheEntry<T>(key);
                    if (mounted) {
                        if (entry) {
                            setData(entry.data);
                            setIsLoading(false);
                        } else {
                            // Still no data (cache miss)
                            // Consumer handles fetching fresh data usually?
                            // Or NavigationGuard handles it?
                            // This hook provides *cached* data.
                            setIsLoading(false);
                        }
                    }
                } catch (err) {
                    if (mounted) {
                        setError(err instanceof Error ? err : new Error(String(err)));
                        setIsLoading(false);
                    }
                }
            }
        };

        fetchData();

        // Subscribe to updates (e.g. background refresh)
        const unsubscribe = subscribeToUpdates(key, (newData) => {
            if (mounted) {
                setData(newData);
                setIsLoading(false);
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [key, getCacheEntry, getCacheEntrySync, subscribeToUpdates, isLoading, data]);

    return { data, isLoading, error };
}
