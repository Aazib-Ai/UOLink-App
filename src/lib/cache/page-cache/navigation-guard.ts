/**
 * NavigationGuard - Implements cache-first navigation with background refresh
 * Implements Requirements 1.1, 1.2, 1.3, 1.4
 * - Navigation interception logic
 * - Cache hit detection and immediate content display
 * - Background refresh scheduling for stale data
 * - Smooth transition management
 */

import { CacheManager, PageType, ContentType } from './cache-manager';
import { StateManager } from './state-manager';
import { CacheEntry, PageState, isStale } from './types';

/**
 * Navigation result type
 */
export interface NavigationResult {
    /** Whether cached content was used */
    usedCache: boolean;
    /** Whether a background refresh was scheduled */
    backgroundRefreshScheduled: boolean;
    /** The page data (from cache or fresh) */
    pageData: any;
    /** The restored page state */
    pageState: PageState | null;
    /** Time taken to display content (ms) */
    displayTime: number;
}

/**
 * Background refresh callback type
 */
export type BackgroundRefreshCallback = (route: string) => Promise<any>;

/**
 * Navigation guard configuration
 */
export interface NavigationGuardConfig {
    /** Threshold in ms to consider data stale (default: 5 minutes) */
    staleThreshold?: number;
    /** Whether to enable background refresh (default: true) */
    enableBackgroundRefresh?: boolean;
    /** Maximum time to wait for cache lookup (default: 50ms) */
    maxCacheLookupTime?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<NavigationGuardConfig> = {
    staleThreshold: 5 * 60 * 1000, // 5 minutes
    enableBackgroundRefresh: true,
    maxCacheLookupTime: 50,
};

/**
 * NavigationGuard handles cache-first page loading with background refresh
 */
export class NavigationGuard {
    private cacheManager: CacheManager;
    private stateManager: StateManager;
    private config: Required<NavigationGuardConfig>;
    private backgroundRefreshCallbacks: Map<string, BackgroundRefreshCallback> = new Map();
    private activeRefreshes: Set<string> = new Set();
    private currentRoute: string | null = null;

    constructor(
        cacheManager: CacheManager,
        stateManager: StateManager,
        config: NavigationGuardConfig = {}
    ) {
        this.cacheManager = cacheManager;
        this.stateManager = stateManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Handle navigation from one route to another
     * Requirement 1.1, 1.2, 1.3, 1.4 - Cache-first loading with state preservation
     */
    async handleNavigation(
        to: string,
        from: string,
        pageType: PageType = PageType.OTHER,
        contentType: ContentType = ContentType.GENERIC
    ): Promise<NavigationResult> {
        const startTime = performance.now();

        // Note: State capture should be done by the application layer before calling handleNavigation
        // This allows for proper integration with React/framework lifecycle

        // Try to get cached data
        const cacheKey = this.getCacheKey(to);
        const cachedEntry = await this.cacheManager.get<any>(cacheKey);

        let result: NavigationResult;

        if (cachedEntry && this.shouldUseCache(cachedEntry)) {
            // Cache hit - display immediately
            // Requirement 1.1 - Cache hit provides immediate content display
            result = await this.displayCachedContent(to, cachedEntry, startTime);

            // Schedule background refresh if data is stale
            // Requirement 1.4 - Background refresh for stale data
            if (this.isStale(cachedEntry)) {
                this.scheduleBackgroundRefresh(to, pageType, contentType);
                result.backgroundRefreshScheduled = true;
            }
        } else {
            // Cache miss - need to fetch fresh data
            result = {
                usedCache: false,
                backgroundRefreshScheduled: false,
                pageData: null,
                pageState: null,
                displayTime: performance.now() - startTime,
            };
        }

        // Update current route
        this.currentRoute = to;

        return result;
    }

    /**
     * Display cached content immediately
     * Requirement 1.1 - Immediate content display
     */
    private async displayCachedContent(
        route: string,
        entry: CacheEntry<any>,
        startTime: number
    ): Promise<NavigationResult> {
        // Restore page state
        // Requirement 1.2, 1.3 - State preservation and dashboard state persistence
        const pageState = this.stateManager.getState(route);
        if (pageState) {
            this.stateManager.restoreState(route, pageState);
        }

        const displayTime = performance.now() - startTime;

        return {
            usedCache: true,
            backgroundRefreshScheduled: false,
            pageData: entry.data,
            pageState,
            displayTime,
        };
    }

    /**
     * Determine if cached data should be used
     * Requirement 1.1 - Cache hit detection
     */
    private shouldUseCache(entry: CacheEntry<any>): boolean {
        // Don't use if expired
        if (entry.expiresAt <= Date.now()) {
            return false;
        }

        // Use cache even if stale (will trigger background refresh)
        return true;
    }

    /**
     * Check if cache entry is stale
     * Requirement 1.4 - Stale data detection
     */
    private isStale(entry: CacheEntry<any>): boolean {
        const age = Date.now() - entry.timestamp;
        return age > this.config.staleThreshold;
    }

    /**
     * Schedule background refresh for stale data
     * Requirement 1.4 - Background refresh scheduling
     */
    scheduleBackgroundRefresh(
        route: string,
        pageType: PageType = PageType.OTHER,
        contentType: ContentType = ContentType.GENERIC
    ): void {
        if (!this.config.enableBackgroundRefresh) {
            return;
        }

        // Don't schedule if already refreshing
        if (this.activeRefreshes.has(route)) {
            return;
        }

        // Get the callback for this route
        const callback = this.backgroundRefreshCallbacks.get(route);
        if (!callback) {
            return;
        }

        // Mark as active
        this.activeRefreshes.add(route);

        // Schedule refresh in next tick to not block current navigation
        setTimeout(async () => {
            try {
                const freshData = await callback(route);

                // Update cache with fresh data
                const cacheKey = this.getCacheKey(route);
                const currentState = this.stateManager.getState(route);

                await this.cacheManager.set(
                    cacheKey,
                    freshData,
                    {
                        pageType,
                        contentType,
                        route,
                        pageState: currentState || undefined,
                    }
                );
            } catch (error) {
                console.warn(`Background refresh failed for route: ${route}`, error);
            } finally {
                this.activeRefreshes.delete(route);
            }
        }, 0);
    }

    /**
     * Register a background refresh callback for a route
     */
    registerRefreshCallback(route: string, callback: BackgroundRefreshCallback): void {
        this.backgroundRefreshCallbacks.set(route, callback);
    }

    /**
     * Unregister a background refresh callback
     */
    unregisterRefreshCallback(route: string): void {
        this.backgroundRefreshCallbacks.delete(route);
    }

    /**
     * Cache fresh data after initial load
     */
    async cacheFreshData(
        route: string,
        data: any,
        pageType: PageType = PageType.OTHER,
        contentType: ContentType = ContentType.GENERIC
    ): Promise<void> {
        const cacheKey = this.getCacheKey(route);
        const pageState = this.stateManager.getState(route);

        await this.cacheManager.set(
            cacheKey,
            data,
            {
                pageType,
                contentType,
                route,
                pageState: pageState || undefined,
            }
        );
    }

    /**
     * Invalidate cache for a route
     */
    async invalidateRoute(route: string): Promise<void> {
        const cacheKey = this.getCacheKey(route);
        await this.cacheManager.invalidate(cacheKey);
        this.stateManager.clearState(route);
    }

    /**
     * Get cache key for a route
     */
    private getCacheKey(route: string): string {
        return `page:${route}`;
    }

    /**
     * Check if a route has cached data
     */
    async hasCachedData(route: string): Promise<boolean> {
        const cacheKey = this.getCacheKey(route);
        const entry = await this.cacheManager.get(cacheKey);
        return entry !== null && this.shouldUseCache(entry);
    }

    /**
     * Get current route (for testing)
     */
    getCurrentRoute(): string | null {
        return this.currentRoute;
    }

    /**
     * Check if a refresh is active for a route (for testing)
     */
    isRefreshActive(route: string): boolean {
        return this.activeRefreshes.has(route);
    }

    /**
     * Clear all navigation state
     */
    clear(): void {
        this.currentRoute = null;
        this.activeRefreshes.clear();
        this.backgroundRefreshCallbacks.clear();
    }
}
