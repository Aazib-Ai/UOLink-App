'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { CacheManager, CacheEntryMetadata, PageType, ContentType } from './cache-manager';
import { StateManager } from './state-manager';
import { NavigationGuard } from './navigation-guard';
import { BackgroundRefreshManager } from './background-refresh-manager';
import { CacheEntry, DEFAULT_CACHE_CONFIG, PageState } from './types';
import { usePathname } from 'next/navigation';
import {
    createCacheSetMessage,
    createCacheInvalidateMessage,
    createCacheWarmMessage,
    SWMessageType,
    isSWCacheMessage,
    SWPageCacheEntry,
} from './sw-types';
import {
    ConfigurationManager,
    initializeConfiguration,
    getConfigurationManager,
} from './config';

interface PageCacheContextType {
    cacheManager: CacheManager;
    stateManager: StateManager;
    navigationGuard: NavigationGuard;
    refreshManager: BackgroundRefreshManager;
    configManager: ConfigurationManager;

    // Helper accessors
    getCacheEntry: <T>(key: string) => Promise<CacheEntry<T> | null>;
    getCacheEntrySync: <T>(key: string) => CacheEntry<T> | null;
    setCacheEntry: <T>(key: string, data: T, metadata: CacheEntryMetadata) => Promise<void>;
    invalidateCache: (keyOrTags: string | string[]) => Promise<void>;

    // Notification system
    subscribeToUpdates: (key: string, callback: (data: any) => void) => () => void;

    // Error handling
    lastError: Error | null;
    clearError: () => void;

    // Offline & Storage
    isOffline: boolean;
    storageQuota: { usage: number; quota: number; percentage: number } | null;
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
    const configManagerRef = useRef<ConfigurationManager | null>(null);

    // Notification subscribers: Map<key, Set<callback>>
    const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

    const [lastError, setLastError] = useState<Error | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [storageQuota, setStorageQuota] = useState<{ usage: number; quota: number; percentage: number } | null>(null);

    const pathname = usePathname();
    const prevPathnameRef = useRef<string | null>(null);

    // Initialize managers on first mount
    if (!cacheManagerRef.current) {
        try {
            // Initialize configuration system first
            configManagerRef.current = getConfigurationManager();

            // Initialize cache manager with configuration
            cacheManagerRef.current = new CacheManager(config, configManagerRef.current);
            stateManagerRef.current = new StateManager();

            refreshManagerRef.current = new BackgroundRefreshManager(
                cacheManagerRef.current,
                stateManagerRef.current
            );

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

    // Handle navigation events for restoration
    useEffect(() => {
        if (pathname && navigationGuardRef.current) {
            const from = prevPathnameRef.current || '';
            // Use generic types roughly or update handleNavigation to be lenient?
            // It essentially just checks cache and restores state.
            navigationGuardRef.current.handleNavigation(pathname, from).catch(err => {
                console.warn('Navigation restoration failed:', err);
            });

            prevPathnameRef.current = pathname;
        }
    }, [pathname]);

    // Handle online/offline events
    useEffect(() => {
        const updateOnlineStatus = () => {
            const offline = !navigator.onLine;
            setIsOffline(offline);

            // Propagate to managers
            if (cacheManagerRef.current) {
                cacheManagerRef.current.setOfflineMode(offline);
            }
            if (navigationGuardRef.current) {
                navigationGuardRef.current.setOfflineMode(offline);
            }
        };

        // Initial check
        updateOnlineStatus();

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        return () => {
            window.removeEventListener('online', updateOnlineStatus);
            window.removeEventListener('offline', updateOnlineStatus);
        };
    }, []);

    // Check storage quota periodically
    useEffect(() => {
        const checkQuota = async () => {
            if (cacheManagerRef.current) {
                const quota = await cacheManagerRef.current.checkStorageQuota();
                setStorageQuota(quota);
            }
        };

        checkQuota();
        // Check every 5 minutes
        const interval = setInterval(checkQuota, 5 * 60 * 1000);
        return () => clearInterval(interval);
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

    // Service worker communication
    useEffect(() => {
        if (typeof window === 'undefined' || !navigator.serviceWorker) {
            return;
        }

        // Listen for messages from service worker
        const handleSWMessage = (event: MessageEvent) => {
            const message = event.data;

            if (!isSWCacheMessage(message)) {
                return;
            }

            console.log('Received message from SW:', message.type);

            switch (message.type) {
                case SWMessageType.CACHE_UPDATED:
                    // Service worker updated cache, notify subscribers
                    notifySubscribers(message.key, null);
                    break;

                case SWMessageType.CACHE_WARM_COMPLETE:
                    console.log('Cache warming complete:', message);
                    break;

                case SWMessageType.CACHE_WARM_FAILED:
                    console.error('Cache warming failed:', message);
                    break;
            }
        };

        navigator.serviceWorker.addEventListener('message', handleSWMessage);

        // Request cache warming on mount
        navigator.serviceWorker.ready.then(registration => {
            if (registration.active) {
                registration.active.postMessage(createCacheWarmMessage(['/dashboard', '/profile', '/timetable']));
            }
        }).catch(error => {
            console.error('Service worker not ready:', error);
        });

        return () => {
            navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        };
    }, [notifySubscribers]);

    // Initialize configuration system async
    useEffect(() => {
        const initConfig = async () => {
            if (configManagerRef.current) {
                try {
                    await configManagerRef.current.initialize();

                    // Start monitoring
                    const monitoringManager = configManagerRef.current.getMonitoringManager();
                    monitoringManager.startMonitoring(60000); // Every minute

                    // Listen for rollback events
                    monitoringManager.addEventListener((event) => {
                        if (event.type === 'rollback') {
                            console.warn('Cache system rollback triggered:', event.data);

                            // Handle rollback action
                            const action = event.data.action;
                            if (action === 'clear_cache' && cacheManagerRef.current) {
                                cacheManagerRef.current.clear().catch(console.error);
                            }
                        }
                    });

                    setIsInitialized(true);
                } catch (error) {
                    console.error('Failed to initialize configuration:', error);
                    setLastError(error instanceof Error ? error : new Error(String(error)));
                }
            }
        };

        initConfig();

        return () => {
            // Stop monitoring on cleanup
            if (configManagerRef.current) {
                const monitoringManager = configManagerRef.current.getMonitoringManager();
                monitoringManager.stopMonitoring();
            }
        };
    }, []);

    // Effect to ensure proper initialization completion if async work needed
    useEffect(() => {
        setIsInitialized(true);
        return () => {
            // Cleanup if needed
            // refreshManagerRef.current?.stop();
        };
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

    const getCacheEntrySync = useCallback(<T,>(key: string) => {
        try {
            return cacheManagerRef.current!.getSync<T>(key);
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
            return null;
        }
    }, []);

    const setCacheEntry = useCallback(async <T,>(key: string, data: T, metadata: CacheEntryMetadata) => {
        try {
            await cacheManagerRef.current!.set(key, data, metadata);
            notifySubscribers(key, data);

            // Sync with service worker
            if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
                const pageState = stateManagerRef.current?.captureState(metadata.route) || {
                    scrollPosition: { x: 0, y: 0 },
                    filters: {},
                    searchTerm: '',
                    expandedSections: [],
                    formData: {},
                    customState: {},
                };

                const entry = await cacheManagerRef.current!.get<T>(key);
                if (entry) {
                    const swCacheEntry: SWPageCacheEntry = {
                        pageData: data,
                        pageState,
                        route: metadata.route,
                        entry,
                    };

                    navigator.serviceWorker.ready.then(registration => {
                        if (registration.active) {
                            registration.active.postMessage(createCacheSetMessage(key, swCacheEntry));
                        }
                    }).catch(error => {
                        console.error('Failed to sync with service worker:', error);
                    });
                }
            }
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
        }
    }, [notifySubscribers]);

    const invalidateCache = useCallback(async (keyOrTags: string | string[]) => {
        try {
            await cacheManagerRef.current!.invalidate(keyOrTags);

            // Sync invalidation with service worker
            if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
                navigator.serviceWorker.ready.then(registration => {
                    if (registration.active) {
                        registration.active.postMessage(createCacheInvalidateMessage(keyOrTags));
                    }
                }).catch(error => {
                    console.error('Failed to sync invalidation with service worker:', error);
                });
            }
        } catch (err) {
            setLastError(err instanceof Error ? err : new Error(String(err)));
        }
    }, []);

    const clearError = useCallback(() => {
        setLastError(null);
    }, []);

    // Safe guard access in value
    if (!cacheManagerRef.current || !stateManagerRef.current || !navigationGuardRef.current || !refreshManagerRef.current || !configManagerRef.current) {
        return null; // Or some loading state/error boundary
    }

    const value: PageCacheContextType = {
        cacheManager: cacheManagerRef.current,
        stateManager: stateManagerRef.current,
        navigationGuard: navigationGuardRef.current,
        refreshManager: refreshManagerRef.current,
        configManager: configManagerRef.current,
        getCacheEntry,
        getCacheEntrySync,
        setCacheEntry,
        invalidateCache,
        subscribeToUpdates,
        lastError,
        clearError,
        isOffline,
        storageQuota
    };

    return (
        <PageCacheContext.Provider value={value}>
            {children}
        </PageCacheContext.Provider>
    );
}
