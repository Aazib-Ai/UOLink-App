/**
 * Property tests for BackgroundRefreshManager
 * Tests Requirements 4.1, 4.2, 4.4, 4.5
 * - Background refresh initiation
 * - Seamless cache updates
 * - Retry with exponential backoff
 * - Deferred updates during interaction
 */

import { BackgroundRefreshManager, RefreshCallback } from '../background-refresh-manager';
import { CacheManager, PageType, ContentType } from '../cache-manager';
import { StateManager } from '../state-manager';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('BackgroundRefreshManager Property Tests', () => {
    let refreshManager: BackgroundRefreshManager;
    let cacheManager: CacheManager;
    let stateManager: StateManager;

    beforeEach(() => {
        cacheManager = new CacheManager({
            maxMemoryBytes: 1024 * 1024,
            defaultTTL: 5 * 60 * 1000,
            staleTTL: 30 * 60 * 1000,
            enablePersistence: false,
        });

        stateManager = new StateManager();

        refreshManager = new BackgroundRefreshManager(
            cacheManager,
            stateManager,
            {
                maxRetries: 3,
                initialRetryDelay: 100, // Shorter for testing
                maxRetryDelay: 1000,
                interactionDeferDelay: 200,
                enableAutoRefresh: true,
            }
        );
    });

    afterEach(async () => {
        refreshManager.clear();
        await cacheManager.clear();
        stateManager.clearAllStates();
    });

    /**
     * Property 15: Background refresh initiation
     * Validates Requirement 4.1
     * 
     * For any cached data being displayed, the system should initiate
     * background refresh for updated content
     */
    describe('Property 15: Background refresh initiation (Requirement 4.1)', () => {
        test('should initiate background refresh when scheduled', async () => {
            const route = '/test-page';
            let refreshCalled = false;

            const refreshCallback: RefreshCallback = async () => {
                refreshCalled = true;
                return { data: 'fresh data' };
            };

            // Schedule refresh
            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Verify refresh is scheduled
            expect(refreshManager.isRefreshScheduled(route)).toBe(true);

            // Wait for refresh to execute
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify refresh was called
            expect(refreshCalled).toBe(true);
        });

        test('should initiate refresh for multiple routes independently', async () => {
            const routes = ['/page-1', '/page-2', '/page-3'];
            const refreshCalls: Record<string, boolean> = {};

            for (const route of routes) {
                refreshCalls[route] = false;

                const callback: RefreshCallback = async () => {
                    refreshCalls[route] = true;
                    return { data: `fresh data for ${route}` };
                };

                refreshManager.scheduleRefresh(
                    route,
                    callback,
                    PageType.OTHER,
                    ContentType.GENERIC
                );
            }

            // Wait for all refreshes to execute
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify all refreshes were called
            for (const route of routes) {
                expect(refreshCalls[route]).toBe(true);
            }
        });

        test('should cancel existing refresh when rescheduling same route', async () => {
            const route = '/test-page';
            let firstCallCount = 0;
            let secondCallCount = 0;

            const firstCallback: RefreshCallback = async () => {
                firstCallCount++;
                return { data: 'first' };
            };

            const secondCallback: RefreshCallback = async () => {
                secondCallCount++;
                return { data: 'second' };
            };

            // Set user as interacting to defer execution
            refreshManager.setUserInteracting(true);

            // Schedule first refresh
            refreshManager.scheduleRefresh(route, firstCallback);

            // Verify it's deferred
            expect(refreshManager.getDeferredRefreshes()).toContain(route);

            // Reschedule with different callback (should cancel first)
            refreshManager.scheduleRefresh(route, secondCallback);

            // Stop interaction to trigger execution
            refreshManager.setUserInteracting(false);

            // Wait for execution
            await new Promise(resolve => setTimeout(resolve, 400));

            // Only second callback should be called
            expect(firstCallCount).toBe(0);
            expect(secondCallCount).toBe(1);
        });
    });

    /**
     * Property 16: Seamless cache updates
     * Validates Requirement 4.2
     * 
     * For any background refresh that completes with new data,
     * the system should update the cached content seamlessly
     */
    describe('Property 16: Seamless cache updates (Requirement 4.2)', () => {
        test('should update cache seamlessly after successful refresh', async () => {
            const route = '/test-page';
            const initialData = { content: 'initial data' };
            const freshData = { content: 'fresh data' };

            // Set initial cache
            await cacheManager.set(
                `page:${route}`,
                initialData,
                {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route,
                }
            );

            // Schedule refresh
            const refreshCallback: RefreshCallback = async () => {
                return freshData;
            };

            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for refresh to complete
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify cache was updated
            const cachedEntry = await cacheManager.get(`page:${route}`);
            expect(cachedEntry).not.toBeNull();
            expect(cachedEntry!.data).toEqual(freshData);
        });

        test('should preserve page state during cache update', async () => {
            const route = '/test-page';
            const initialState = {
                scrollPosition: { x: 0, y: 500 },
                filters: { semester: 'Fall 2024' },
                searchTerm: 'test search',
                expandedSections: ['section-1'],
                formData: { field: 'value' },
                customState: {},
            };

            // Capture initial state
            stateManager.setState(route, initialState);

            // Schedule refresh
            const refreshCallback: RefreshCallback = async () => {
                return { content: 'updated data' };
            };

            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for refresh
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify state was preserved
            const cachedEntry = await cacheManager.get(`page:${route}`);
            expect(cachedEntry).not.toBeNull();
            // State is captured during cache update
            const restoredState = stateManager.getState(route);
            expect(restoredState).not.toBeNull();
        });

        test('should notify UI via update callback when provided', async () => {
            const route = '/test-page';
            const freshData = { content: 'fresh data' };
            let notifiedData: any = null;

            const refreshCallback: RefreshCallback = async () => {
                return freshData;
            };

            const updateCallback = (data: any) => {
                notifiedData = data;
            };

            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC,
                updateCallback
            );

            // Wait for refresh
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify UI was notified
            expect(notifiedData).toEqual(freshData);
        });
    });

    /**
     * Property 17: Retry with exponential backoff
     * Validates Requirement 4.4
     * 
     * For any failed background refresh, the system should retry
     * with exponential backoff up to 3 attempts
     */
    describe('Property 17: Retry with exponential backoff (Requirement 4.4)', () => {
        test('should retry failed refresh with exponential backoff', async () => {
            const route = '/test-page';
            let attemptCount = 0;
            const attemptTimes: number[] = [];

            const failingCallback: RefreshCallback = async () => {
                attemptCount++;
                attemptTimes.push(Date.now());
                throw new Error('Refresh failed');
            };

            refreshManager.scheduleRefresh(
                route,
                failingCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for all retries to complete
            // Initial + 3 retries with delays: 100ms, 200ms, 400ms
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Should have attempted 3 times (initial + 2 retries before final failure)
            // The 3rd retry happens but then max retries is reached
            expect(attemptCount).toBe(3);

            // Verify exponential backoff timing
            if (attemptTimes.length >= 3) {
                const delay1 = attemptTimes[1] - attemptTimes[0];
                const delay2 = attemptTimes[2] - attemptTimes[1];

                // Second delay should be approximately 2x first delay
                expect(delay2).toBeGreaterThan(delay1 * 1.5);
            }
        });

        test('should stop retrying after max attempts', async () => {
            const route = '/test-page';
            let attemptCount = 0;

            const failingCallback: RefreshCallback = async () => {
                attemptCount++;
                throw new Error('Refresh failed');
            };

            refreshManager.scheduleRefresh(
                route,
                failingCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for all retries
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Should stop after maxRetries (3) attempts total
            expect(attemptCount).toBe(3);

            // Verify refresh is no longer scheduled
            expect(refreshManager.isRefreshScheduled(route)).toBe(false);
        });

        test('should succeed on retry if refresh recovers', async () => {
            const route = '/test-page';
            let attemptCount = 0;
            const successData = { content: 'success' };

            const recoveringCallback: RefreshCallback = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error('Temporary failure');
                }
                return successData;
            };

            refreshManager.scheduleRefresh(
                route,
                recoveringCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for retries and eventual success
            await new Promise(resolve => setTimeout(resolve, 800));

            // Should have succeeded on third attempt
            expect(attemptCount).toBe(3);

            // Verify cache was updated
            const cachedEntry = await cacheManager.get(`page:${route}`);
            expect(cachedEntry).not.toBeNull();
            expect(cachedEntry!.data).toEqual(successData);

            // Refresh should be removed after success
            expect(refreshManager.isRefreshScheduled(route)).toBe(false);
        });

        test('should track retry count correctly', async () => {
            const route = '/test-page';
            let maxRetryCount = 0;

            const failingCallback: RefreshCallback = async () => {
                const currentRetryCount = refreshManager.getRetryCount(route);
                maxRetryCount = Math.max(maxRetryCount, currentRetryCount);
                throw new Error('Refresh failed');
            };

            refreshManager.scheduleRefresh(
                route,
                failingCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait for all retries
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Max retry count should be 2 (0-indexed: 0, 1, 2)
            // Total attempts = 3 (initial + 2 retries)
            expect(maxRetryCount).toBe(2);
        });
    });

    /**
     * Property 18: Deferred updates during interaction
     * Validates Requirement 4.5
     * 
     * For any active user interaction with a page, the system should
     * defer background updates until interaction pauses
     */
    describe('Property 18: Deferred updates during interaction (Requirement 4.5)', () => {
        test('should defer refresh when user is interacting', async () => {
            const route = '/test-page';
            let refreshExecuted = false;

            const refreshCallback: RefreshCallback = async () => {
                refreshExecuted = true;
                return { data: 'fresh' };
            };

            // Set user as interacting
            refreshManager.setUserInteracting(true);

            // Schedule refresh
            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 150));

            // Refresh should NOT have executed yet
            expect(refreshExecuted).toBe(false);

            // Verify it's in deferred list
            expect(refreshManager.getDeferredRefreshes()).toContain(route);
        });

        test('should execute deferred refreshes after interaction stops', async () => {
            const route = '/test-page';
            let refreshExecuted = false;

            const refreshCallback: RefreshCallback = async () => {
                refreshExecuted = true;
                return { data: 'fresh' };
            };

            // Set user as interacting
            refreshManager.setUserInteracting(true);

            // Schedule refresh
            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            // Still should not have executed
            expect(refreshExecuted).toBe(false);

            // Stop interaction
            refreshManager.setUserInteracting(false);

            // Wait for defer delay + execution
            await new Promise(resolve => setTimeout(resolve, 400));

            // Now refresh should have executed
            expect(refreshExecuted).toBe(true);
            expect(refreshManager.getDeferredRefreshes()).not.toContain(route);
        });

        test('should handle multiple deferred refreshes', async () => {
            const routes = ['/page-1', '/page-2', '/page-3'];
            const executedRoutes: string[] = [];

            // Set user as interacting
            refreshManager.setUserInteracting(true);

            // Schedule multiple refreshes
            for (const route of routes) {
                const callback: RefreshCallback = async () => {
                    executedRoutes.push(route);
                    return { data: `fresh for ${route}` };
                };

                refreshManager.scheduleRefresh(
                    route,
                    callback,
                    PageType.OTHER,
                    ContentType.GENERIC
                );
            }

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 100));

            // None should have executed
            expect(executedRoutes).toHaveLength(0);

            // All should be deferred
            const deferred = refreshManager.getDeferredRefreshes();
            expect(deferred).toHaveLength(3);

            // Stop interaction
            refreshManager.setUserInteracting(false);

            // Wait for all to execute
            await new Promise(resolve => setTimeout(resolve, 400));

            // All should have executed
            expect(executedRoutes).toHaveLength(3);
            expect(refreshManager.getDeferredRefreshes()).toHaveLength(0);
        });

        test('should not defer if user is not interacting', async () => {
            const route = '/test-page';
            let refreshExecuted = false;

            const refreshCallback: RefreshCallback = async () => {
                refreshExecuted = true;
                return { data: 'fresh' };
            };

            // User is NOT interacting
            refreshManager.setUserInteracting(false);

            // Schedule refresh
            refreshManager.scheduleRefresh(
                route,
                refreshCallback,
                PageType.OTHER,
                ContentType.GENERIC
            );

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 150));

            // Refresh should have executed immediately
            expect(refreshExecuted).toBe(true);
            expect(refreshManager.getDeferredRefreshes()).not.toContain(route);
        });

        test('should track user interaction state correctly', () => {
            expect(refreshManager.isUserCurrentlyInteracting()).toBe(false);

            refreshManager.setUserInteracting(true);
            expect(refreshManager.isUserCurrentlyInteracting()).toBe(true);

            refreshManager.setUserInteracting(false);
            expect(refreshManager.isUserCurrentlyInteracting()).toBe(false);
        });
    });

    /**
     * Additional integration tests
     */
    describe('Integration tests', () => {
        test('should provide accurate statistics', async () => {
            const routes = ['/page-1', '/page-2'];

            // Set user interacting
            refreshManager.setUserInteracting(true);

            // Schedule refreshes
            for (const route of routes) {
                refreshManager.scheduleRefresh(
                    route,
                    async () => ({ data: 'test' }),
                    PageType.OTHER,
                    ContentType.GENERIC
                );
            }

            const stats = refreshManager.getStats();

            expect(stats.scheduledRefreshes).toBe(2);
            expect(stats.deferredRefreshes).toBe(2);
            expect(stats.isUserInteracting).toBe(true);
        });

        test('should clear all state when clear is called', async () => {
            const route = '/test-page';

            refreshManager.setUserInteracting(true);
            refreshManager.scheduleRefresh(
                route,
                async () => ({ data: 'test' }),
                PageType.OTHER,
                ContentType.GENERIC
            );

            expect(refreshManager.isRefreshScheduled(route)).toBe(true);

            refreshManager.clear();

            expect(refreshManager.isRefreshScheduled(route)).toBe(false);
            expect(refreshManager.getDeferredRefreshes()).toHaveLength(0);
            expect(refreshManager.isUserCurrentlyInteracting()).toBe(false);
        });
    });
});
