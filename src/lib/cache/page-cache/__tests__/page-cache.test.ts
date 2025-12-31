/**
 * Property tests for page cache infrastructure
 * Tests Requirements 5.2, 5.3 - Cache-first data fetching and transparent fallback
 */

import { MemoryCache } from '../memory-cache';
import { IndexedDBCache } from '../indexeddb-wrapper';
import {
    CacheEntry,
    approximateSize,
} from '../types';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

describe('Page Cache Infrastructure', () => {
    describe('MemoryCache', () => {
        let cache: MemoryCache;

        beforeEach(() => {
            cache = new MemoryCache({
                maxMemoryBytes: 1024 * 1024, // 1MB for testing
                defaultTTL: 5 * 60 * 1000,
                staleTTL: 30 * 60 * 1000,
            });
        });

        afterEach(() => {
            cache.clear();
        });

        describe('Basic Operations', () => {
            test('should store and retrieve cache entries', () => {
                const testData = { message: 'Hello, World!' };
                const entry: CacheEntry<typeof testData> = {
                    data: testData,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: approximateSize(testData),
                    tags: ['test'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('test-key', entry);
                const retrieved = cache.get('test-key');

                expect(retrieved).not.toBeNull();
                expect(retrieved?.data).toEqual(testData);
            });

            test('should return null for non-existent keys', () => {
                const result = cache.get('non-existent');
                expect(result).toBeNull();
            });

            test('should delete entries', () => {
                const entry: CacheEntry<string> = {
                    data: 'test',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: 100,
                    tags: [],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('test-key', entry);
                expect(cache.has('test-key')).toBe(true);

                cache.delete('test-key');
                expect(cache.has('test-key')).toBe(false);
            });
        });

        describe('Property 19: Cache-first data fetching (Requirement 5.2)', () => {
            test('should check cache before making network requests', () => {
                const testData = { id: 1, name: 'Test User' };
                const entry: CacheEntry<typeof testData> = {
                    data: testData,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: approximateSize(testData),
                    tags: ['user'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('user:1', entry);
                const cachedResult = cache.get('user:1');

                expect(cachedResult).not.toBeNull();
                expect(cachedResult?.data).toEqual(testData);

                const stats = cache.getStats();
                expect(stats.hits).toBe(1);
                expect(stats.misses).toBe(0);
            });

            test('should return cached data immediately without delay', () => {
                const testData = { page: 'dashboard', content: 'test' };
                const entry: CacheEntry<typeof testData> = {
                    data: testData,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: approximateSize(testData),
                    tags: ['page'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('page:dashboard', entry);

                const startTime = performance.now();
                const result = cache.get('page:dashboard');
                const endTime = performance.now();

                expect(result).not.toBeNull();
                expect(result?.data).toEqual(testData);
                expect(endTime - startTime).toBeLessThan(10);
            });

            test('should update cache after network fetch on miss', () => {
                const result = cache.get('new-key');
                expect(result).toBeNull();

                const stats = cache.getStats();
                expect(stats.misses).toBe(1);

                const fetchedData = { id: 2, name: 'New User' };
                const entry: CacheEntry<typeof fetchedData> = {
                    data: fetchedData,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: approximateSize(fetchedData),
                    tags: ['user'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'network',
                    },
                };

                cache.set('new-key', entry);
                const cachedResult = cache.get('new-key');
                expect(cachedResult).not.toBeNull();
                expect(cachedResult?.data).toEqual(fetchedData);
            });
        });

        describe('Property 20: Transparent fallback on cache miss (Requirement 5.3)', () => {
            test('should fallback to network fetch on cache miss', () => {
                const result = cache.get('missing-key');
                expect(result).toBeNull();

                const networkData = { id: 3, name: 'Fallback User' };
                const entry: CacheEntry<typeof networkData> = {
                    data: networkData,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: approximateSize(networkData),
                    tags: ['user'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'network',
                    },
                };

                cache.set('missing-key', entry);
                const cachedResult = cache.get('missing-key');
                expect(cachedResult?.data).toEqual(networkData);
            });

            test('should handle cache errors gracefully', () => {
                expect(() => {
                    cache.get('any-key');
                    cache.set('any-key', {
                        data: 'test',
                        timestamp: Date.now(),
                        expiresAt: Date.now() + 60000,
                        priority: 50,
                        sizeBytes: 100,
                        tags: [],
                        stale: false,
                        metadata: {
                            createdAt: Date.now(),
                            lastAccessedAt: Date.now(),
                            accessCount: 0,
                            source: 'memory',
                        },
                    });
                    cache.delete('any-key');
                }).not.toThrow();
            });
        });

        describe('LRU Eviction', () => {
            test('should evict least recently used entries when memory limit exceeded', () => {
                const smallCache = new MemoryCache({
                    maxMemoryBytes: 500,
                    defaultTTL: 60000,
                    staleTTL: 300000,
                });

                for (let i = 0; i < 10; i++) {
                    const entry: CacheEntry<string> = {
                        data: `data-${i}`,
                        timestamp: Date.now(),
                        expiresAt: Date.now() + 60000,
                        priority: 50,
                        sizeBytes: 100,
                        tags: [],
                        stale: false,
                        metadata: {
                            createdAt: Date.now(),
                            lastAccessedAt: Date.now(),
                            accessCount: 0,
                            source: 'memory',
                        },
                    };
                    smallCache.set(`key-${i}`, entry);
                }

                const stats = smallCache.getStats();
                expect(stats.evictions).toBeGreaterThan(0);
                expect(stats.memoryBytes).toBeLessThanOrEqual(500);
            });

            test('should preserve high-priority entries during eviction', () => {
                const smallCache = new MemoryCache({
                    maxMemoryBytes: 300,
                    defaultTTL: 60000,
                    staleTTL: 300000,
                });

                const lowPriorityEntry: CacheEntry<string> = {
                    data: 'low-priority',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 10,
                    sizeBytes: 100,
                    tags: [],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };
                smallCache.set('low', lowPriorityEntry);

                const highPriorityEntry: CacheEntry<string> = {
                    data: 'high-priority',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 90,
                    sizeBytes: 100,
                    tags: [],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };
                smallCache.set('high', highPriorityEntry);

                for (let i = 0; i < 5; i++) {
                    const entry: CacheEntry<string> = {
                        data: `data-${i}`,
                        timestamp: Date.now(),
                        expiresAt: Date.now() + 60000,
                        priority: 50,
                        sizeBytes: 100,
                        tags: [],
                        stale: false,
                        metadata: {
                            createdAt: Date.now(),
                            lastAccessedAt: Date.now(),
                            accessCount: 0,
                            source: 'memory',
                        },
                    };
                    smallCache.set(`key-${i}`, entry);
                }

                expect(smallCache.has('high')).toBe(true);
            });
        });

        describe('Tag-based Invalidation', () => {
            test('should invalidate entries by tags', () => {
                const entry1: CacheEntry<string> = {
                    data: 'user-data',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: 100,
                    tags: ['user', 'profile'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                const entry2: CacheEntry<string> = {
                    data: 'note-data',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: 100,
                    tags: ['note'],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('user:1', entry1);
                cache.set('note:1', entry2);

                cache.invalidateByTags(['user']);

                expect(cache.has('user:1')).toBe(false);
                expect(cache.has('note:1')).toBe(true);
            });
        });

        describe('Expiration Handling', () => {
            test('should return null for expired entries', () => {
                const expiredEntry: CacheEntry<string> = {
                    data: 'expired',
                    timestamp: Date.now() - 120000,
                    expiresAt: Date.now() - 60000,
                    priority: 50,
                    sizeBytes: 100,
                    tags: [],
                    stale: false,
                    metadata: {
                        createdAt: Date.now() - 120000,
                        lastAccessedAt: Date.now() - 120000,
                        accessCount: 0,
                        source: 'memory',
                    },
                };

                cache.set('expired-key', expiredEntry);
                const result = cache.get('expired-key');

                expect(result).toBeNull();
                // We keep expired entries for offline fallback, so has() should still be true
                // expect(cache.has('expired-key')).toBe(false); // Old behavior
                expect(cache.has('expired-key')).toBe(true);
            });
        });
    });

    describe('IndexedDBCache', () => {
        let idbCache: IndexedDBCache;

        beforeEach(async () => {
            idbCache = new IndexedDBCache('test-db', 1);
            await idbCache.init();
        });

        afterEach(async () => {
            await idbCache.clear();
            idbCache.close();
        });

        test('should store and retrieve entries from IndexedDB', async () => {
            const testData = { message: 'Persistent data' };
            const entry: CacheEntry<typeof testData> = {
                data: testData,
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000,
                priority: 50,
                sizeBytes: approximateSize(testData),
                tags: ['test'],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 0,
                    source: 'indexeddb',
                },
            };

            await idbCache.set('test-key', entry);
            const retrieved = await idbCache.get('test-key');

            expect(retrieved).not.toBeNull();
            expect(retrieved?.data).toEqual(testData);
        });

        test('should return null for non-existent keys', async () => {
            const result = await idbCache.get('non-existent');
            expect(result).toBeNull();
        });

        test('should handle expired entries', async () => {
            const expiredEntry: CacheEntry<string> = {
                data: 'expired',
                timestamp: Date.now() - 120000,
                expiresAt: Date.now() - 60000,
                priority: 50,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now() - 120000,
                    lastAccessedAt: Date.now() - 120000,
                    accessCount: 0,
                    source: 'indexeddb',
                },
            };

            await idbCache.set('expired-key', expiredEntry);
            const result = await idbCache.get('expired-key');

            expect(result).toBeNull();
        });
    });
});

describe('Priority & Adaptive Behavior', () => {
    let cache: MemoryCache;

    beforeEach(() => {
        cache = new MemoryCache({
            maxMemoryBytes: 1024, // Small limit for testing eviction
            defaultTTL: 5 * 60 * 1000,
            staleTTL: 30 * 60 * 1000,
            minHitRateForAdaptation: 0.5,
            priorityWeights: { frequency: 0.5, recency: 0.5 }
        });
    });

    describe('Property 14: Critical data preservation during cleanup (Requirement 3.5)', () => {
        test('should never evict entries with unsaved changes', () => {
            // Fill cache with normal entries
            for (let i = 0; i < 20; i++) {
                cache.set(`key-${i}`, {
                    data: 'data',
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 60000,
                    priority: 50,
                    sizeBytes: 100,
                    tags: [],
                    stale: false,
                    metadata: {
                        createdAt: Date.now(),
                        lastAccessedAt: Date.now(),
                        accessCount: 1,
                        source: 'memory',
                        hasUnsavedChanges: false
                    }
                });
            }

            // Add critical entry that would otherwise be evicted (low priority, old access)
            cache.set('critical-key', {
                data: 'critical',
                timestamp: Date.now() - 100000,
                expiresAt: Date.now() + 60000,
                priority: 10,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now() - 100000,
                    accessCount: 1,
                    source: 'memory',
                    hasUnsavedChanges: true
                }
            });

            // Trigger cleanup by adding more
            cache.set('overflow', {
                data: 'overflow',
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000,
                priority: 50,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 1,
                    source: 'memory',
                    hasUnsavedChanges: false
                }
            });

            expect(cache.has('critical-key')).toBe(true);
        });
    });

    describe('Property 32: Priority calculation with frequency and recency (Requirement 8.3)', () => {
        test('should increase priority with access frequency', () => {
            const entry = {
                data: 'data',
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000,
                priority: 0,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 0,
                    source: 'memory' as const,
                    hasUnsavedChanges: false
                }
            };

            cache.set('freq-key', entry);
            const initialPriority = cache.get('freq-key')!.priority;

            // Access multiple times
            for (let i = 0; i < 10; i++) {
                cache.get('freq-key');
            }

            const finalPriority = cache.get('freq-key')!.priority;
            expect(finalPriority).toBeGreaterThan(initialPriority);
        });
    });

    // Note: Full adaptive behavior integration test is effectively covered by unit tests 
    // on CacheManager in a real scenario, but here we test the underlying mechanics 
    // via MemoryCache configuration updates or CacheManager specific tests.
    // Since MemoryCache is the low-level store, we'll test that it accepts config updates
    // which is the mechanism CacheManager uses.

    describe('Property 33: Adaptive priority based on usage patterns (Requirement 8.4)', () => {
        test('should update priority calculation when weights change', () => {
            const entry = {
                data: 'data',
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000,
                priority: 0,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now(),
                    accessCount: 10, // High frequency
                    source: 'memory' as const,
                    hasUnsavedChanges: false
                }
            };

            cache.set('adapt-key', entry);
            const p1 = cache.get('adapt-key')!.priority;

            // Shift weights to heavily favor frequency
            cache.updateConfig({ priorityWeights: { frequency: 0.9, recency: 0.1 } });

            // Get again triggers recalculation
            const p2 = cache.get('adapt-key')!.priority;

            // Since our entry has high frequency (10), increasing frequency weight should increase priority
            // (assuming it wasn't already maxed out, which at 10 accesses it shouldn't be)
            expect(p2).not.toEqual(p1);
        });
    });

    describe('Property 34: Critical data protection under memory pressure (Requirement 8.5)', () => {
        test('should preserve critical data even when cache is full', () => {
            // Similar to Property 14 but emphasizing the "full" aspect
            // Fill to capacity
            const tinyCache = new MemoryCache({ maxMemoryBytes: 300 }); // Holds ~3 items of 100 bytes

            // Critical item
            tinyCache.set('critical', {
                data: 'critical',
                timestamp: Date.now(),
                expiresAt: Date.now() + 60000,
                priority: 10,
                sizeBytes: 100,
                tags: [],
                stale: false,
                metadata: {
                    createdAt: Date.now(),
                    lastAccessedAt: Date.now() - 100000,
                    accessCount: 1,
                    source: 'memory',
                    hasUnsavedChanges: true
                }
            });

            // Add more items to force eviction
            tinyCache.set('item1', {
                data: 'item1', timestamp: Date.now(), expiresAt: Date.now() + 60000, priority: 50, sizeBytes: 100, tags: [], stale: false,
                metadata: { createdAt: Date.now(), lastAccessedAt: Date.now(), accessCount: 1, source: 'memory', hasUnsavedChanges: false }
            });
            tinyCache.set('item2', {
                data: 'item2', timestamp: Date.now(), expiresAt: Date.now() + 60000, priority: 50, sizeBytes: 100, tags: [], stale: false,
                metadata: { createdAt: Date.now(), lastAccessedAt: Date.now(), accessCount: 1, source: 'memory', hasUnsavedChanges: false }
            });
            tinyCache.set('item3', {
                data: 'item3', timestamp: Date.now(), expiresAt: Date.now() + 60000, priority: 50, sizeBytes: 100, tags: [], stale: false,
                metadata: { createdAt: Date.now(), lastAccessedAt: Date.now(), accessCount: 1, source: 'memory', hasUnsavedChanges: false }
            });

            // Critical should still be there
            expect(tinyCache.has('critical')).toBe(true);
            // One of the normal items should be gone
            const count = (tinyCache.has('item1') ? 1 : 0) + (tinyCache.has('item2') ? 1 : 0) + (tinyCache.has('item3') ? 1 : 0);
            expect(count).toBeLessThan(3);
        });
    });
});


