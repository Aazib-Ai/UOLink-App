'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CacheManager, CacheEntryMetadata, PageType, ContentType } from './cache-manager';
import { StateManager } from './state-manager';
import { NavigationGuard } from './navigation-guard';
import { BackgroundRefreshManager } from './background-refresh-manager';
import { CacheEntry, DEFAULT_CACHE_CONFIG } from './types';

interface PageCacheContextType {
    cacheManager: CacheManager;
    stateManager: StateManager;
    navigationGuard: NavigationGuard;
    refreshManager: BackgroundRefreshManager;

    // Helper accessors
    getCacheEntry: <T>(key: string) => Promise<CacheEntry<T> | null>;
    setCacheEntry: <T>(key: string, data: T, metadata: CacheEntryMetadata) => Promise<void>;
    invalidateCache: (keyOrTags: string | string[]) => Promise<void>;

    // Notification system
    subscribeToUpdates: (key: string, callback: (data: any) => void) => () => void;

    // Error handling
    lastError: Error | null;
    clearError: () => void;
}

const PageCacheContext = createContext<PageCacheContextType | null>(null);

export function usePageCache() {
    const context = useContext(PageCacheContext);
    if (!context) {
        throw new Error('usePageCache must be used within a PageCacheProvider');
    }
    return context;
}

interface PageCacheProviderProps {
    children: React.ReactNode;
    config?: Partial<typeof DEFAULT_CACHE_CONFIG>;
}

export function PageCacheProvider({ children, config }: PageCacheProviderProps) {
    // Use refs for singleton instances within the provider lifecycle
    const cacheManagerRef = useRef<CacheManager | null>(null);
    const stateManagerRef = useRef<StateManager | null>(null);
    const navigationGuardRef = useRef<NavigationGuard | null>(null);
    const refreshManagerRef = useRef<BackgroundRefreshManager | null>(null);

    // Notification subscribers: Map<key, Set<callback>>
    const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

    const [lastError, setLastError] = useState<Error | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize managers on first mount
    if (!cacheManagerRef.current) {
        try {
            cacheManagerRef.current = new CacheManager(config);
            stateManagerRef.current = new StateManager();

            refreshManagerRef.current = new BackgroundRefreshManager(
                cacheManagerRef.current,
                stateManagerRef.current
            );

            // TODO: Hook up global refresh notifications if needed, likely via
            // modifying BackgroundRefreshManager to emit events or similar,
            // or by wrapping scheduleRefresh. For now, we instantiate it correctly.

            navigationGuardRef.current = new NavigationGuard(
                cacheManagerRef.current,
                stateManagerRef.current,
                {
                    enableBackgroundRefresh: true
                }
            );

        } catch (err) {
            console.error('Failed to initialize PageCacheProvider managers:', err);
            // We can't use setLastError here as we are in render phase/initialization
            // This will be caught by ErrorBoundary usually, or we can handle in useEffect
        }
    }

    // Effect to ensure proper initialization completion if async work needed
    useEffect(() => {
        setIsInitialized(true);
        return () => {
            // Cleanup if needed
            // refreshManagerRef.current?.stop();
        };
    }, []);

    const notifySubscribers = useCallback((key: string, data: any) => {
        const keySubscribers = subscribersRef.current.get(key);
        if (keySubscribers) {
            keySubscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error(`Error in subscriber callback for key ${key}:`, err);
                }
            });
        }
    }, []);

    const subscribeToUpdates = useCallback((key: string, callback: (data: any) => void) => {
        if (!subscribersRef.current.has(key)) {
            subscribersRef.current.set(key, new Set());
        }
        subscribersRef.current.get(key)!.add(callback);

        return () => {
            const subs = subscribersRef.current.get(key);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    subscribersRef.current.delete(key);
                }
            }
        };
    }, []);

    const getCacheEntry = useCallback(async <T,>(key: string) => {
        try {
            return await cacheManagerRef.current!.get<T>(key);
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
            return null;
        }
    }, []);

    const setCacheEntry = useCallback(async <T,>(key: string, data: T, metadata: CacheEntryMetadata) => {
        try {
            await cacheManagerRef.current!.set(key, data, metadata);
            notifySubscribers(key, data);
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
        }
    }, [notifySubscribers]);

    const invalidateCache = useCallback(async (keyOrTags: string | string[]) => {
        try {
            await cacheManagerRef.current!.invalidate(keyOrTags);
            // For invalidation, we might want to notify subscribers with null or special event
            // For now, let's just complete silently or maybe trigger a refresh if needed
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
        }
    }, []);

    const clearError = useCallback(() => {
        setLastError(null);
    }, []);

    // Safe guard access in value
    if (!cacheManagerRef.current || !stateManagerRef.current || !navigationGuardRef.current || !refreshManagerRef.current) {
        return null; // Or some loading state/error boundary
    }

    const value: PageCacheContextType = {
        cacheManager: cacheManagerRef.current,
        stateManager: stateManagerRef.current,
        navigationGuard: navigationGuardRef.current,
        refreshManager: refreshManagerRef.current,
        getCacheEntry,
        setCacheEntry,
        invalidateCache,
        subscribeToUpdates,
        lastError,
        clearError
    };

    return (
        <PageCacheContext.Provider value={value}>
            {children}
        </PageCacheContext.Provider>
    );
}
