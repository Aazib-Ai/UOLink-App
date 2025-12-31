/**
 * Property tests for NavigationGuard
 * Tests Requirements 1.1, 1.2, 1.3, 1.4
 * - Property 1: Cache hit provides immediate content display
 * - Property 2: Navigation preserves page state
 * - Property 3: Dashboard state persistence
 * - Property 4: Background refresh for stale data
 */

import { NavigationGuard, NavigationResult } from '../navigation-guard';
import { CacheManager, PageType, ContentType } from '../cache-manager';
import { StateManager } from '../state-manager';
import { CacheEntry, PageState, approximateSize } from '../types';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('NavigationGuard', () => {
    let navigationGuard: NavigationGuard;
    let cacheManager: CacheManager;
    let stateManager: StateManager;

    beforeEach(() => {
        cacheManager = new CacheManager({
            maxMemoryBytes: 10 * 1024 * 1024, // 10MB for testing
            defaultTTL: 30 * 60 * 1000, // 30 minutes
            staleTTL: 30 * 60 * 1000,
            enablePersistence: false, // Disable for faster tests
        });

        stateManager = new StateManager({
            enableLocalStorage: false,
            maxStates: 20,
        });

        navigationGuard = new NavigationGuard(cacheManager, stateManager, {
            staleThreshold: 5 * 60 * 1000, // 5 minutes
            enableBackgroundRefresh: true,
            maxCacheLookupTime: 50,
        });
    });

    afterEach(async () => {
        await cacheManager.clear();
        stateManager.clearAllStates();
        navigationGuard.clear();
    });

    describe('Property 1: Cache hit provides immediate content display (Requirement 1.1)', () => {
        /**
         * Feature: pwa-page-caching, Property 1: Cache hit provides immediate content display
         * For any previously visited page route, navigating to that route should display
         * cached content immediately without showing loading indicators
         */

        test('should display cached content immediately for previously visited pages', async () => {
            const route = '/dashboard';
            const pageData = {
                notes: [
                    { id: '1', title: 'Note 1', content: 'Content 1' },
                    { id: '2', title: 'Note 2', content: 'Content 2' },
                ],
                totalCount: 2,
            };

            // Simulate initial visit - cache the data
            await navigationGuard.cacheFreshData(
                route,
                pageData,
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Navigate to the cached route
            const result = await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Verify cache was used
            expect(result.usedCache).toBe(true);
            expect(result.pageData).toEqual(pageData);
            expect(result.displayTime).toBeLessThan(50); // Should be very fast
        });

        test('should display cached content without loading indicators (immediate response)', async () => {
            const routes = ['/dashboard', '/profile', '/timetable'];
            const pageTypes = [PageType.DASHBOARD, PageType.PROFILE, PageType.TIMETABLE];

            for (let i = 0; i < routes.length; i++) {
                const route = routes[i];
                const pageType = pageTypes[i];
                const pageData = { page: route, data: `Data for ${route}` };

                // Cache the data
                await navigationGuard.cacheFreshData(
                    route,
                    pageData,
                    pageType,
                    ContentType.PERSONALIZED
                );

                // Navigate and measure time
                const startTime = performance.now();
                const result = await navigationGuard.handleNavigation(
                    route,
                    '/',
                    pageType,
                    ContentType.PERSONALIZED
                );
                const endTime = performance.now();

                // Verify immediate display (no loading indicator needed)
                expect(result.usedCache).toBe(true);
                expect(result.pageData).toEqual(pageData);
                expect(endTime - startTime).toBeLessThan(50);
                expect(result.displayTime).toBeLessThan(50);
            }
        });

        test('should return cache miss for never-visited pages', async () => {
            const result = await navigationGuard.handleNavigation(
                '/never-visited',
                '/',
                PageType.OTHER,
                ContentType.GENERIC
            );

            expect(result.usedCache).toBe(false);
            expect(result.pageData).toBeNull();
        });

        test('should handle multiple cached pages efficiently', async () => {
            const pages = [
                { route: '/dashboard', type: PageType.DASHBOARD },
                { route: '/profile', type: PageType.PROFILE },
                { route: '/timetable', type: PageType.TIMETABLE },
                { route: '/settings', type: PageType.SETTINGS },
            ];

            // Cache all pages
            for (const page of pages) {
                await navigationGuard.cacheFreshData(
                    page.route,
                    { page: page.route },
                    page.type,
                    ContentType.PERSONALIZED
                );
            }

            // Navigate to each and verify immediate display
            for (const page of pages) {
                const result = await navigationGuard.handleNavigation(
                    page.route,
                    '/',
                    page.type,
                    ContentType.PERSONALIZED
                );

                expect(result.usedCache).toBe(true);
                expect(result.displayTime).toBeLessThan(50);
            }
        });
    });

    describe('Property 2: Navigation preserves page state (Requirement 1.2)', () => {
        /**
         * Feature: pwa-page-caching, Property 2: Navigation preserves page state
         * For any navigation between dashboard, timetable, and profile pages,
         * scroll positions and filter states should be preserved across the navigation
         */

        test('should preserve scroll position across navigation', async () => {
            const route1 = '/dashboard';
            const route2 = '/profile';

            // Set up initial state for route1
            const state1: PageState = {
                scrollPosition: { x: 0, y: 500 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };
            stateManager.setState(route1, state1);

            // Cache data for both routes
            await navigationGuard.cacheFreshData(
                route1,
                { page: 'dashboard' },
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );
            await navigationGuard.cacheFreshData(
                route2,
                { page: 'profile' },
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );

            // Navigate from route1 to route2
            await navigationGuard.handleNavigation(
                route2,
                route1,
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );

            // Navigate back to route1
            const result = await navigationGuard.handleNavigation(
                route1,
                route2,
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Verify state was preserved
            expect(result.usedCache).toBe(true);
            expect(result.pageState).not.toBeNull();
            expect(result.pageState?.scrollPosition).toEqual({ x: 0, y: 500 });
        });

        test('should preserve filter state across navigation', async () => {
            const route = '/dashboard';
            const filters = {
                titleFilter: 'test',
                semesterFilter: 'Fall 2024',
                subjectFilter: 'CS',
            };

            const state: PageState = {
                scrollPosition: { x: 0, y: 0 },
                filters,
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            };
            stateManager.setState(route, state);

            await navigationGuard.cacheFreshData(
                route,
                { notes: [] },
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Navigate away and back
            await navigationGuard.handleNavigation(
                '/profile',
                route,
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );

            const result = await navigationGuard.handleNavigation(
                route,
                '/profile',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            expect(result.pageState?.filters).toEqual(filters);
        });

        test('should preserve combined scroll and filter state', async () => {
            const route = '/dashboard';
            const state: PageState = {
                scrollPosition: { x: 0, y: 750 },
                filters: {
                    titleFilter: 'important',
                    semesterFilter: 'Spring 2024',
                },
                searchTerm: 'search term',
                expandedSections: ['section1', 'section2'],
                formData: {},
                customState: {},
            };
            stateManager.setState(route, state);

            await navigationGuard.cacheFreshData(
                route,
                { notes: [] },
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Navigate through multiple pages
            await navigationGuard.handleNavigation(
                '/profile',
                route,
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );
            await navigationGuard.handleNavigation(
                '/timetable',
                '/profile',
                PageType.TIMETABLE,
                ContentType.PERSONALIZED
            );

            // Navigate back to original route
            const result = await navigationGuard.handleNavigation(
                route,
                '/timetable',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Verify all state was preserved
            expect(result.pageState?.scrollPosition).toEqual({ x: 0, y: 750 });
            expect(result.pageState?.filters).toEqual({
                titleFilter: 'important',
                semesterFilter: 'Spring 2024',
            });
            expect(result.pageState?.searchTerm).toBe('search term');
            expect(result.pageState?.expandedSections).toEqual(['section1', 'section2']);
        });
    });

    describe('Property 3: Dashboard state persistence (Requirement 1.3)', () => {
        /**
         * Feature: pwa-page-caching, Property 3: Dashboard state persistence
         * For any dashboard state (notes and filters), navigating away and returning
         * should restore the exact same state
         */

        test('should restore exact dashboard state after navigation', async () => {
            const dashboardRoute = '/dashboard';
            const dashboardData = {
                notes: [
                    { id: '1', title: 'Note 1', semester: 'Fall 2024' },
                    { id: '2', title: 'Note 2', semester: 'Spring 2024' },
                    { id: '3', title: 'Note 3', semester: 'Fall 2024' },
                ],
                totalCount: 3,
            };

            const dashboardState: PageState = {
                scrollPosition: { x: 0, y: 300 },
                filters: {
                    semesterFilter: 'Fall 2024',
                    titleFilter: 'Note',
                },
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {
                    sortMode: 'date',
                    viewMode: 'grid',
                },
            };

            // Set up dashboard
            stateManager.setState(dashboardRoute, dashboardState);
            await navigationGuard.cacheFreshData(
                dashboardRoute,
                dashboardData,
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Navigate away
            await navigationGuard.handleNavigation(
                '/profile',
                dashboardRoute,
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );

            // Navigate back to dashboard
            const result = await navigationGuard.handleNavigation(
                dashboardRoute,
                '/profile',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Verify exact state restoration
            expect(result.usedCache).toBe(true);
            expect(result.pageData).toEqual(dashboardData);
            expect(result.pageState?.scrollPosition).toEqual({ x: 0, y: 300 });
            expect(result.pageState?.filters).toEqual({
                semesterFilter: 'Fall 2024',
                titleFilter: 'Note',
            });
            expect(result.pageState?.customState).toEqual({
                sortMode: 'date',
                viewMode: 'grid',
            });
        });

        test('should preserve dashboard state across multiple navigation cycles', async () => {
            const dashboardRoute = '/dashboard';
            const profileRoute = '/profile';
            const dashboardData = { notes: [], totalCount: 0 };
            const profileData = { user: 'test' };
            const dashboardState: PageState = {
                scrollPosition: { x: 0, y: 1000 },
                filters: { semesterFilter: 'All' },
                searchTerm: 'important',
                expandedSections: ['filters', 'notes'],
                formData: {},
                customState: {},
            };

            stateManager.setState(dashboardRoute, dashboardState);
            await navigationGuard.cacheFreshData(
                dashboardRoute,
                dashboardData,
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Cache profile page data as well
            await navigationGuard.cacheFreshData(
                profileRoute,
                profileData,
                PageType.PROFILE,
                ContentType.USER_GENERATED
            );

            // Multiple navigation cycles
            for (let i = 0; i < 3; i++) {
                await navigationGuard.handleNavigation(
                    profileRoute,
                    dashboardRoute,
                    PageType.PROFILE,
                    ContentType.USER_GENERATED
                );

                const result = await navigationGuard.handleNavigation(
                    dashboardRoute,
                    profileRoute,
                    PageType.DASHBOARD,
                    ContentType.USER_GENERATED
                );

                // State should be preserved in each cycle
                expect(result.pageState?.scrollPosition).toEqual({ x: 0, y: 1000 });
                expect(result.pageState?.filters).toEqual({ semesterFilter: 'All' });
                expect(result.pageState?.searchTerm).toBe('important');
            }
        });
    });

    describe('Property 4: Background refresh for stale data (Requirement 1.4)', () => {
        /**
         * Feature: pwa-page-caching, Property 4: Background refresh for stale data
         * For any cached data older than 5 minutes, displaying that data should trigger
         * a background refresh while showing the cached content
         */

        test('should trigger background refresh for stale data', async () => {
            const route = '/dashboard';
            const staleData = { notes: [], timestamp: 'old' };
            const freshData = { notes: [], timestamp: 'new' };

            // Create a stale cache entry (older than 5 minutes)
            const staleTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
            await cacheManager.set(
                `page:${route}`,
                staleData,
                {
                    pageType: PageType.DASHBOARD,
                    contentType: ContentType.USER_GENERATED,
                    route,
                },
                30 * 60 * 1000 // Still valid, just stale
            );

            // Manually set timestamp to make it stale
            const cacheKey = `page:${route}`;
            const entry = await cacheManager.get(cacheKey);
            if (entry) {
                entry.timestamp = staleTimestamp;
                // Re-cache with old timestamp
                const memCache = (cacheManager as any).memoryCache;
                memCache.set(cacheKey, entry);
            }

            // Register refresh callback
            let refreshCalled = false;
            navigationGuard.registerRefreshCallback(route, async () => {
                refreshCalled = true;
                return freshData;
            });

            // Navigate to the route with stale data
            const result = await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Should use cached data immediately
            expect(result.usedCache).toBe(true);
            expect(result.pageData).toEqual(staleData);

            // Should schedule background refresh
            expect(result.backgroundRefreshScheduled).toBe(true);

            // Wait for background refresh to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify refresh was called
            expect(refreshCalled).toBe(true);
        });

        test('should not trigger background refresh for fresh data', async () => {
            const route = '/dashboard';
            const freshData = { notes: [], timestamp: 'fresh' };

            // Cache fresh data (less than 5 minutes old)
            await navigationGuard.cacheFreshData(
                route,
                freshData,
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Register refresh callback
            let refreshCalled = false;
            navigationGuard.registerRefreshCallback(route, async () => {
                refreshCalled = true;
                return freshData;
            });

            // Navigate to the route
            const result = await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Should use cached data
            expect(result.usedCache).toBe(true);

            // Should NOT schedule background refresh
            expect(result.backgroundRefreshScheduled).toBe(false);

            // Wait to ensure no refresh happens
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify refresh was not called
            expect(refreshCalled).toBe(false);
        });

        test('should update cache after background refresh completes', async () => {
            const route = '/dashboard';
            const staleData = { notes: [], version: 1 };
            const freshData = { notes: [{ id: '1', title: 'New Note' }], version: 2 };

            // Create stale cache entry
            const staleTimestamp = Date.now() - (6 * 60 * 1000);
            await cacheManager.set(
                `page:${route}`,
                staleData,
                {
                    pageType: PageType.DASHBOARD,
                    contentType: ContentType.USER_GENERATED,
                    route,
                },
                30 * 60 * 1000
            );

            // Make it stale
            const cacheKey = `page:${route}`;
            const entry = await cacheManager.get(cacheKey);
            if (entry) {
                entry.timestamp = staleTimestamp;
                const memCache = (cacheManager as any).memoryCache;
                memCache.set(cacheKey, entry);
            }

            // Register refresh callback
            navigationGuard.registerRefreshCallback(route, async () => {
                return freshData;
            });

            // Navigate to trigger refresh
            await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            // Wait for background refresh
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify cache was updated
            const updatedEntry = await cacheManager.get(cacheKey);
            expect(updatedEntry?.data).toEqual(freshData);
        });

        test('should not block UI while refreshing stale data', async () => {
            const route = '/dashboard';
            const staleData = { notes: [] };

            // Create stale cache entry
            const staleTimestamp = Date.now() - (6 * 60 * 1000);
            await cacheManager.set(
                `page:${route}`,
                staleData,
                {
                    pageType: PageType.DASHBOARD,
                    contentType: ContentType.USER_GENERATED,
                    route,
                },
                30 * 60 * 1000
            );

            const cacheKey = `page:${route}`;
            const entry = await cacheManager.get(cacheKey);
            if (entry) {
                entry.timestamp = staleTimestamp;
                const memCache = (cacheManager as any).memoryCache;
                memCache.set(cacheKey, entry);
            }

            // Register slow refresh callback
            navigationGuard.registerRefreshCallback(route, async () => {
                await new Promise(resolve => setTimeout(resolve, 500));
                return { notes: [] };
            });

            // Navigate and measure time
            const startTime = performance.now();
            const result = await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );
            const endTime = performance.now();

            // Navigation should complete quickly (not wait for refresh)
            expect(endTime - startTime).toBeLessThan(100);
            expect(result.usedCache).toBe(true);
            expect(result.displayTime).toBeLessThan(100);
        });
    });

    describe('Additional NavigationGuard functionality', () => {
        test('should track current route', async () => {
            const route = '/dashboard';
            await navigationGuard.cacheFreshData(
                route,
                {},
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            await navigationGuard.handleNavigation(
                route,
                '/',
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            expect(navigationGuard.getCurrentRoute()).toBe(route);
        });

        test('should invalidate route cache and state', async () => {
            const route = '/dashboard';
            await navigationGuard.cacheFreshData(
                route,
                { data: 'test' },
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            stateManager.setState(route, {
                scrollPosition: { x: 0, y: 100 },
                filters: {},
                searchTerm: '',
                expandedSections: [],
                formData: {},
                customState: {},
            });

            await navigationGuard.invalidateRoute(route);

            const hasCached = await navigationGuard.hasCachedData(route);
            const state = stateManager.getState(route);

            expect(hasCached).toBe(false);
            expect(state).toBeNull();
        });

        test('should check if route has cached data', async () => {
            const route = '/dashboard';

            expect(await navigationGuard.hasCachedData(route)).toBe(false);

            await navigationGuard.cacheFreshData(
                route,
                {},
                PageType.DASHBOARD,
                ContentType.USER_GENERATED
            );

            expect(await navigationGuard.hasCachedData(route)).toBe(true);
        });
    });
});
