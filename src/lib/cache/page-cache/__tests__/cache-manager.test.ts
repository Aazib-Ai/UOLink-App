/**
 * Property tests for CacheManager
 * Tests Requirements 3.1, 3.2, 3.3, 3.4, 8.1, 8.2
 * - Cache size management
 * - Memory pressure response
 * - Stale cache marking
 * - Priority-based retention
 * - Page type prioritization
 * - User content prioritization
 */

import { CacheManager, PageType, ContentType, CacheEntryMetadata } from '../cache-manager';
import { CacheConfig } from '../types';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('CacheManager Property Tests', () => {
    let cacheManager: CacheManager;

    beforeEach(() => {
        cacheManager = new CacheManager({
            maxMemoryBytes: 1024 * 1024, // 1MB for testing
            defaultTTL: 5 * 60 * 1000,
            staleTTL: 30 * 60 * 1000,
            enablePersistence: false, // Disable for faster tests
        });
    });

    afterEach(async () => {
        await cacheManager.clear();
    });

    /**
     * Property 10: Cache size management
     * Validates Requirement 3.1
     * 
     * For any cache that reaches maxMemoryBytes in size,
     * the system should automatically remove least recently used pages
     */
    describe('Property 10: Cache size management (Requirement 3.1)', () => {
        test('should automatically evict LRU entries when cache reaches size limit', async () => {
            const maxSize = 1024 * 1024; // 1MB
            const entrySize = 100 * 1024; // 100KB each
            const numEntries = 15; // Total 1.5MB, exceeds limit

            // Add entries until we exceed the limit
            for (let i = 0; i < numEntries; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize), // Approximate size
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/page-${i}`,
                };

                await cacheManager.set(`key-${i}`, data, metadata);

                // Small delay to ensure different access times
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const stats = cacheManager.getStats();

            // Cache should have evicted entries to stay within limit
            expect(stats.memoryBytes).toBeLessThanOrEqual(maxSize);
            expect(stats.evictions).toBeGreaterThan(0);

            // Earlier entries should be evicted (LRU)
            const firstEntry = await cacheManager.get('key-0');
            expect(firstEntry).toBeNull();

            // Recent entries should still exist
            const lastEntry = await cacheManager.get(`key-${numEntries - 1}`);
            expect(lastEntry).not.toBeNull();
        });

        test('should maintain cache size within limits across multiple operations', async () => {
            const maxSize = 1024 * 1024;
            const iterations = 50;

            for (let i = 0; i < iterations; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(50 * 1024), // 50KB
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/page-${i}`,
                };

                await cacheManager.set(`key-${i}`, data, metadata);

                const stats = cacheManager.getStats();
                expect(stats.memoryBytes).toBeLessThanOrEqual(maxSize);
            }
        });
    });

    /**
     * Property 11: Memory pressure response
     * Validates Requirement 3.2
     * 
     * For any low memory condition, the system should reduce cache size
     * by 50% using LRU eviction
     */
    describe('Property 11: Memory pressure response (Requirement 3.2)', () => {
        test('should reduce cache to 50% of max size under memory pressure', async () => {
            const maxSize = 1024 * 1024; // 1MB
            const entrySize = 100 * 1024; // 100KB

            // Fill cache to near capacity
            for (let i = 0; i < 9; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/page-${i}`,
                };

                await cacheManager.set(`key-${i}`, data, metadata);
            }

            const beforeStats = cacheManager.getStats();
            expect(beforeStats.memoryBytes).toBeGreaterThan(maxSize * 0.7);

            // Trigger memory pressure cleanup
            await cacheManager.cleanup(true);

            const afterStats = cacheManager.getStats();

            // Should reduce to approximately 50% of max
            expect(afterStats.memoryBytes).toBeLessThanOrEqual(maxSize * 0.5);
            expect(afterStats.memoryBytes).toBeGreaterThan(0);
        });

        test('should use LRU eviction during memory pressure', async () => {
            const entrySize = 100 * 1024;

            // Add entries with different access times
            for (let i = 0; i < 10; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/page-${i}`,
                };

                await cacheManager.set(`key-${i}`, data, metadata);
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // Access some entries to make them more recent
            await cacheManager.get('key-8');
            await cacheManager.get('key-9');

            // Trigger memory pressure
            await cacheManager.cleanup(true);

            // Recently accessed entries should be retained
            const recentEntry1 = await cacheManager.get('key-8');
            const recentEntry2 = await cacheManager.get('key-9');
            expect(recentEntry1).not.toBeNull();
            expect(recentEntry2).not.toBeNull();

            // Older entries should be evicted
            const oldEntry = await cacheManager.get('key-0');
            expect(oldEntry).toBeNull();
        });
    });

    /**
     * Property 12: Stale cache marking
     * Validates Requirement 3.3
     * 
     * For any page not visited for 30 minutes, the system should mark
     * that page's cache as eligible for cleanup
     */
    describe('Property 12: Stale cache marking (Requirement 3.3)', () => {
        test('should mark entries older than staleTTL as stale', async () => {
            const staleTTL = 30 * 60 * 1000; // 30 minutes
            const shortTTL = 1000; // 1 second for testing

            const testManager = new CacheManager({
                maxMemoryBytes: 1024 * 1024,
                defaultTTL: 60000,
                staleTTL: shortTTL, // Short stale TTL for testing
                enablePersistence: false,
            });

            // Add entry
            const metadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/test-page',
            };

            await testManager.set('test-key', { data: 'test' }, metadata);

            // Wait for entry to become stale
            await new Promise(resolve => setTimeout(resolve, shortTTL + 100));

            // Mark stale entries
            const staleKeys = testManager.markStaleEntries();

            expect(staleKeys).toContain('test-key');

            const stats = testManager.getStats();
            expect(stats.staleEntries).toBeGreaterThan(0);

            await testManager.clear();
        });

        test('should not mark recently accessed entries as stale', async () => {
            const shortTTL = 1000;

            const testManager = new CacheManager({
                maxMemoryBytes: 1024 * 1024,
                defaultTTL: 60000,
                staleTTL: shortTTL,
                enablePersistence: false,
            });

            const metadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/test-page',
            };

            await testManager.set('test-key', { data: 'test' }, metadata);

            // Access the entry to update lastAccessedAt
            await testManager.get('test-key');

            // Mark stale entries immediately
            const staleKeys = testManager.markStaleEntries();

            // Should not be marked as stale since it was just accessed
            expect(staleKeys).not.toContain('test-key');

            await testManager.clear();
        });
    });

    /**
     * Property 13: Priority-based cache retention
     * Validates Requirement 3.4
     * 
     * For any memory pressure situation, the system should prioritize
     * keeping the current page and most recent 2 pages in cache
     */
    describe('Property 13: Priority-based cache retention (Requirement 3.4)', () => {
        test('should retain current page and 2 most recent pages during memory pressure', async () => {
            const entrySize = 150 * 1024; // 150KB

            // Add multiple pages
            for (let i = 0; i < 10; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/page-${i}`,
                };

                await cacheManager.set(`page-${i}`, data, metadata);
            }

            // Get recent routes (last 3 should be page-9, page-8, page-7)
            const recentRoutes = cacheManager.getRecentRoutes();
            expect(recentRoutes).toHaveLength(3);
            expect(recentRoutes).toContain('/page-9');
            expect(recentRoutes).toContain('/page-8');
            expect(recentRoutes).toContain('/page-7');

            // Trigger memory pressure
            await cacheManager.cleanup(true);

            // Recent pages should be retained
            const page9 = await cacheManager.get('page-9');
            const page8 = await cacheManager.get('page-8');
            const page7 = await cacheManager.get('page-7');

            expect(page9).not.toBeNull();
            expect(page8).not.toBeNull();
            expect(page7).not.toBeNull();

            // Older pages should be evicted
            const page0 = await cacheManager.get('page-0');
            expect(page0).toBeNull();
        });

        test('should prioritize high-priority entries over low-priority ones', async () => {
            const entrySize = 150 * 1024;

            // Add low priority entries
            for (let i = 0; i < 5; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/low-${i}`,
                };

                await cacheManager.set(`low-${i}`, data, metadata);
            }

            // Add high priority entries (dashboard, profile)
            const highPriorityData = {
                id: 'high',
                content: 'x'.repeat(entrySize),
            };

            await cacheManager.set('dashboard', highPriorityData, {
                pageType: PageType.DASHBOARD,
                contentType: ContentType.USER_GENERATED,
                route: '/dashboard',
            });

            await cacheManager.set('profile', highPriorityData, {
                pageType: PageType.PROFILE,
                contentType: ContentType.USER_GENERATED,
                route: '/profile',
            });

            // Trigger memory pressure
            await cacheManager.cleanup(true);

            // High priority entries should be retained
            const dashboard = await cacheManager.get('dashboard');
            const profile = await cacheManager.get('profile');

            expect(dashboard).not.toBeNull();
            expect(profile).not.toBeNull();
        });
    });

    /**
     * Property 30: Page type prioritization
     * Validates Requirement 8.1
     * 
     * For any multiple cached pages, the system should prioritize
     * dashboard and profile pages over less frequently accessed pages
     */
    describe('Property 30: Page type prioritization (Requirement 8.1)', () => {
        test('should prioritize dashboard and profile pages during eviction', async () => {
            const entrySize = 150 * 1024;

            // Add various page types
            const pageTypes = [
                { key: 'dashboard', type: PageType.DASHBOARD, route: '/dashboard' },
                { key: 'profile', type: PageType.PROFILE, route: '/profile' },
                { key: 'timetable', type: PageType.TIMETABLE, route: '/timetable' },
                { key: 'settings', type: PageType.SETTINGS, route: '/settings' },
                { key: 'other1', type: PageType.OTHER, route: '/other1' },
                { key: 'other2', type: PageType.OTHER, route: '/other2' },
                { key: 'other3', type: PageType.OTHER, route: '/other3' },
            ];

            for (const page of pageTypes) {
                const data = {
                    id: page.key,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: page.type,
                    contentType: ContentType.GENERIC,
                    route: page.route,
                };

                await cacheManager.set(page.key, data, metadata);
            }

            // Trigger memory pressure to force eviction
            await cacheManager.cleanup(true);

            // Dashboard and profile should be retained
            const dashboard = await cacheManager.get('dashboard');
            const profile = await cacheManager.get('profile');

            expect(dashboard).not.toBeNull();
            expect(profile).not.toBeNull();

            // Lower priority pages should be evicted first
            const stats = cacheManager.getStats();
            expect(stats.evictions).toBeGreaterThan(0);
        });

        test('should assign higher priority scores to dashboard and profile pages', async () => {
            const dashboardMetadata: CacheEntryMetadata = {
                pageType: PageType.DASHBOARD,
                contentType: ContentType.GENERIC,
                route: '/dashboard',
            };

            const otherMetadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/other',
            };

            await cacheManager.set('dashboard', { data: 'test' }, dashboardMetadata);
            await cacheManager.set('other', { data: 'test' }, otherMetadata);

            const dashboardEntry = await cacheManager.get('dashboard');
            const otherEntry = await cacheManager.get('other');

            expect(dashboardEntry).not.toBeNull();
            expect(otherEntry).not.toBeNull();

            // Dashboard should have higher priority
            expect(dashboardEntry!.priority).toBeGreaterThan(otherEntry!.priority);
        });
    });

    /**
     * Property 31: User content prioritization
     * Validates Requirement 8.2
     * 
     * For any limited cache space condition, the system should preserve
     * user-generated content and personalized data over generic content
     */
    describe('Property 31: User content prioritization (Requirement 8.2)', () => {
        test('should preserve user-generated content over generic content during eviction', async () => {
            const entrySize = 150 * 1024;

            // Add generic content
            for (let i = 0; i < 5; i++) {
                const data = {
                    id: i,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/generic-${i}`,
                };

                await cacheManager.set(`generic-${i}`, data, metadata);
            }

            // Add user-generated content
            const userContent = {
                id: 'user',
                content: 'x'.repeat(entrySize),
            };

            await cacheManager.set('user-notes', userContent, {
                pageType: PageType.OTHER,
                contentType: ContentType.USER_GENERATED,
                route: '/my-notes',
            });

            await cacheManager.set('user-profile', userContent, {
                pageType: PageType.PROFILE,
                contentType: ContentType.USER_GENERATED,
                route: '/my-profile',
            });

            // Trigger memory pressure
            await cacheManager.cleanup(true);

            // User-generated content should be retained
            const userNotes = await cacheManager.get('user-notes');
            const userProfile = await cacheManager.get('user-profile');

            expect(userNotes).not.toBeNull();
            expect(userProfile).not.toBeNull();

            // Generic content should be evicted first
            const stats = cacheManager.getStats();
            expect(stats.evictions).toBeGreaterThan(0);
        });

        test('should assign higher priority to user-generated and personalized content', async () => {
            const userMetadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.USER_GENERATED,
                route: '/user-content',
            };

            const personalizedMetadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.PERSONALIZED,
                route: '/personalized',
            };

            const genericMetadata: CacheEntryMetadata = {
                pageType: PageType.OTHER,
                contentType: ContentType.GENERIC,
                route: '/generic',
            };

            await cacheManager.set('user', { data: 'test' }, userMetadata);
            await cacheManager.set('personalized', { data: 'test' }, personalizedMetadata);
            await cacheManager.set('generic', { data: 'test' }, genericMetadata);

            const userEntry = await cacheManager.get('user');
            const personalizedEntry = await cacheManager.get('personalized');
            const genericEntry = await cacheManager.get('generic');

            expect(userEntry).not.toBeNull();
            expect(personalizedEntry).not.toBeNull();
            expect(genericEntry).not.toBeNull();

            // User-generated should have highest priority
            expect(userEntry!.priority).toBeGreaterThan(personalizedEntry!.priority);
            expect(personalizedEntry!.priority).toBeGreaterThan(genericEntry!.priority);
        });

        test('should retain personalized content over generic during limited space', async () => {
            const entrySize = 150 * 1024;

            // Add entries in specific order to avoid recent routes protection
            // Add generic content first
            for (let i = 1; i <= 3; i++) {
                const data = {
                    id: `generic${i}`,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.GENERIC,
                    route: `/generic-${i}`,
                };

                await cacheManager.set(`generic${i}`, data, metadata);
            }

            // Then add personalized content
            for (let i = 1; i <= 2; i++) {
                const data = {
                    id: `personalized${i}`,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.PERSONALIZED,
                    route: `/personalized-${i}`,
                };

                await cacheManager.set(`personalized${i}`, data, metadata);
            }

            // Finally add user-generated content (will be in recent routes)
            for (let i = 1; i <= 2; i++) {
                const data = {
                    id: `user${i}`,
                    content: 'x'.repeat(entrySize),
                };

                const metadata: CacheEntryMetadata = {
                    pageType: PageType.OTHER,
                    contentType: ContentType.USER_GENERATED,
                    route: `/user-${i}`,
                };

                await cacheManager.set(`user${i}`, data, metadata);
            }

            // Trigger memory pressure
            await cacheManager.cleanup(true);

            // User-generated content should be retained (highest priority)
            const user1 = await cacheManager.get('user1');
            const user2 = await cacheManager.get('user2');

            expect(user1).not.toBeNull();
            expect(user2).not.toBeNull();

            // Count retained entries by type
            const personalizedCount = (await cacheManager.get('personalized1') ? 1 : 0) +
                (await cacheManager.get('personalized2') ? 1 : 0);
            const genericCount = (await cacheManager.get('generic1') ? 1 : 0) +
                (await cacheManager.get('generic2') ? 1 : 0) +
                (await cacheManager.get('generic3') ? 1 : 0);

            // Personalized content should have better retention than generic
            // because it has higher priority (70 vs 30)
            expect(personalizedCount).toBeGreaterThan(genericCount);
        });
    });
});
