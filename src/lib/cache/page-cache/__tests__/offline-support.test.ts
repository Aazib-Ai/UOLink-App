
import { CacheManager, PageType, ContentType } from '../cache-manager';
import { NavigationGuard } from '../navigation-guard';
import { StateManager } from '../state-manager';
import { CacheEntry } from '../types';
import * as fc from 'fast-check';

/**
 * Mock navigator.storage
 */
const mockStorageEstimate = jest.fn();
Object.defineProperty(global, 'navigator', {
    value: {
        storage: {
            estimate: mockStorageEstimate,
        },
        onLine: true,
    },
    writable: true,
});

describe('Offline Support and Storage Quota', () => {
    let cacheManager: CacheManager;
    let stateManager: StateManager;
    let navigationGuard: NavigationGuard;

    beforeEach(() => {
        cacheManager = new CacheManager({
            enablePersistence: false, // Use memory only for fast tests
            maxMemoryBytes: 10 * 1024 * 1024,
            defaultTTL: 100, // Short TTL for testing expiration
        });
        stateManager = new StateManager();
        navigationGuard = new NavigationGuard(cacheManager, stateManager, {
            enableBackgroundRefresh: false,
        });
        mockStorageEstimate.mockReset();
        // Default online
        cacheManager.setOfflineMode(false);
        navigationGuard.setOfflineMode(false);
    });

    /**
     * Requirement 6.1 - Offline cached page serving
     * Property 23: Offline cached page serving
     */
    test('Property 23: Offline cached page serving', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string(), // route
                fc.string(), // data
                async (route, data) => {
                    // Setup: Cache data and let it expire
                    const now = Date.now();
                    jest.spyOn(Date, 'now').mockReturnValue(now);

                    await cacheManager.set(
                        `page:${route}`,
                        data,
                        {
                            pageType: PageType.OTHER,
                            contentType: ContentType.GENERIC,
                            route: route
                        },
                        10 // 10ms TTL
                    );

                    // Advance time to expire content
                    jest.spyOn(Date, 'now').mockReturnValue(now + 200);

                    // Online check - should be expired
                    const onlineGuard = new NavigationGuard(cacheManager, stateManager);
                    onlineGuard.setOfflineMode(false);
                    // We need to bypass the public handleNavigation which does full logic
                    // and test internal logic or mock handleNavigation behaviour via public API behavior check.
                    // Since we can't easily spy on private methods, we check if handleNavigation returns cache used.

                    // Direct check on cache behavior via internal/private logic is hard in property tests without exposing internals.
                    // But we modified NavigationGuard to allow expired content if offline.

                    // Case 1: Online -> Should NOT use expired cache
                    const onlineResult = await onlineGuard.handleNavigation(route, 'prev');
                    if (onlineResult.usedCache) {
                        // If it used cache, it must be because it wasn't expired or logic failed. 
                        // But we advanced time. So it should return fresh/null.
                        // Actually handleNavigation returns usedCache=false if miss/expired.
                        expect(onlineResult.usedCache).toBe(false);
                    }

                    // Case 2: Offline -> Should USE expired cache
                    const offlineGuard = new NavigationGuard(cacheManager, stateManager);
                    offlineGuard.setOfflineMode(true);
                    cacheManager.setOfflineMode(true); // Enable offline mode in CacheManager to allow expired retrieval

                    const offlineResult = await offlineGuard.handleNavigation(route, 'prev');

                    return offlineResult.usedCache === true && offlineResult.pageData === data;
                }
            )
        );
    });

    /**
     * Requirement 6.2 - Offline uncached page handling
     * Property 24: Offline uncached page handling
     */
    test('Property 24: Offline uncached page handling', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string(), // route
                async (route) => {
                    // Ensure route is NOT in cache
                    await cacheManager.clear();

                    navigationGuard.setOfflineMode(true);

                    const result = await navigationGuard.handleNavigation(route, 'prev');

                    // Should return usedCache: false, which UI interprets as offline/error if offline
                    // The property holds if it correctly reports cache miss without crashing
                    return result.usedCache === false && result.pageData === null;
                }
            )
        );
    });

    /**
     * Requirement 6.3 - Online refresh of stale data
     * Property 25: Online refresh of stale data
     * (Retesting existing behavior in context of online/offline switching)
     */
    test('Property 25: Online refresh of stale data', async () => {
        // This is covered by "Background refresh for stale data" property, 
        // but here we verify switching back to online triggers standard behavior.
        // Since property tests are stateless/atomic usually, we test that IF online AND stale, refresh scheduled.
        await fc.assert(
            fc.asyncProperty(
                fc.string(), // route
                async (route) => {
                    const now = Date.now();
                    jest.spyOn(Date, 'now').mockReturnValue(now);

                    await cacheManager.set(
                        `page:${route}`,
                        'data',
                        { pageType: PageType.OTHER, contentType: ContentType.GENERIC, route },
                        10 * 60 * 1000 // 10 mins TTL (longer than stale threshold of 5 mins)
                    );

                    // Advance time to pass stale threshold (default 5 min in guard)
                    // Guard config default stale is 5 min (300000ms)
                    jest.spyOn(Date, 'now').mockReturnValue(now + 300001);

                    const guard = new NavigationGuard(cacheManager, stateManager, {
                        enableBackgroundRefresh: true,
                        staleThreshold: 300000
                    });
                    guard.setOfflineMode(false); // Online

                    // Mock refresh callback
                    const refreshCallback = jest.fn().mockResolvedValue('fresh');
                    guard.registerRefreshCallback(route, refreshCallback);

                    const result = await guard.handleNavigation(route, 'prev');

                    // Should use cache but schedule refresh
                    return result.usedCache === true && result.backgroundRefreshScheduled === true;
                }
            )
        );
    });

    /**
     * Requirement 6.4 - Cache integrity during extended offline
     * Property 26: Cache integrity during extended offline
     */
    test('Property 26: Cache integrity during extended offline', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string(),
                async (key) => {
                    cacheManager.setOfflineMode(true);

                    await cacheManager.set(key, 'data', {
                        pageType: PageType.OTHER,
                        contentType: ContentType.GENERIC,
                        route: key
                    });

                    // Force cleanup
                    await cacheManager.cleanup();

                    // Should still be there because offline mode skips cleanup
                    const entry = await cacheManager.get(key);
                    return entry !== null;
                }
            )
        );
    });

    /**
     * Requirement 6.5 - Storage quota monitoring
     * Property 27: Storage quota management
     */
    test('Property 27: Storage quota management', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 1000 }), // usage
                fc.integer({ min: 1001, max: 10000 }), // quota
                async (usage, quota) => {
                    mockStorageEstimate.mockResolvedValue({ usage, quota });

                    const result = await cacheManager.checkStorageQuota();

                    if (result === null) return false;

                    const expectedPercentage = (usage / quota) * 100;
                    return (
                        result.usage === usage &&
                        result.quota === quota &&
                        result.percentage === expectedPercentage
                    );
                }
            )
        );
    });
});
