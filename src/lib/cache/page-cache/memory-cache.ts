/**
 * In-memory cache with LRU eviction and tag-based invalidation
 * Supports Requirements 3.1, 3.2, 3.3, 3.4 - Memory management and cache eviction
 */

import {
    CacheEntry,
    CacheConfig,
    CacheStats,
    DEFAULT_CACHE_CONFIG,
    isExpired,
    isStale,
    calculatePriority,
    approximateSize,
} from './types';

/**
 * In-memory cache using Map with LRU eviction
 */
export class MemoryCache {
    private cache: Map<string, CacheEntry<any>>;
    private tagIndex: Map<string, Set<string>>;
    private config: CacheConfig;

    // Statistics
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        sets: 0,
        evictions: 0,
        hitRate: 0,
        memoryBytes: 0,
        entries: 0,
        staleEntries: 0,
    };

    constructor(config: Partial<CacheConfig> = {}) {
        this.cache = new Map();
        this.tagIndex = new Map();
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    }

    /**
     * Retrieve entry from memory cache
     */
    get<T>(key: string, ignoreExpiry: boolean = false): CacheEntry<T> | null {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }

        // Check if expired
        if (!ignoreExpiry && isExpired(entry)) {
            // Don't delete immediately to support offline fallback
            // this.delete(key); 
            this.stats.misses++;
            this.updateHitRate();
            return null;
        }

        // Update access metadata
        entry.metadata.lastAccessedAt = Date.now();
        entry.metadata.accessCount++;

        // Recalculate priority based on new access
        entry.priority = calculatePriority(
            entry.metadata.accessCount,
            entry.metadata.lastAccessedAt,
            this.config.priorityWeights
        );

        // Check if stale
        entry.stale = isStale(entry, this.config.staleTTL);

        this.stats.hits++;
        this.updateHitRate();

        return entry as CacheEntry<T>;
    }

    /**
     * Store entry in memory cache with automatic eviction
     */
    set<T>(key: string, entry: CacheEntry<T>): void {
        // Remove old entry if exists
        if (this.cache.has(key)) {
            this.delete(key);
        }

        // Calculate size if not provided
        if (!entry.sizeBytes) {
            entry.sizeBytes = approximateSize(entry.data);
        }

        // Add to cache
        this.cache.set(key, entry);
        this.stats.memoryBytes += entry.sizeBytes;
        this.stats.sets++;

        // Add to tag index
        if (entry.tags && entry.tags.length > 0) {
            for (const tag of entry.tags) {
                if (!this.tagIndex.has(tag)) {
                    this.tagIndex.set(tag, new Set());
                }
                this.tagIndex.get(tag)!.add(key);
            }
        }

        // Run cleanup if over memory limit
        if (this.stats.memoryBytes > this.config.maxMemoryBytes) {
            this.cleanup();
        }

        this.updateStats();
    }

    /**
     * Remove entry from cache
     */
    delete(key: string): void {
        const entry = this.cache.get(key);

        if (!entry) {
            return;
        }

        // Remove from cache
        this.cache.delete(key);
        this.stats.memoryBytes = Math.max(0, this.stats.memoryBytes - entry.sizeBytes);

        // Remove from tag index
        if (entry.tags && entry.tags.length > 0) {
            for (const tag of entry.tags) {
                const tagSet = this.tagIndex.get(tag);
                if (tagSet) {
                    tagSet.delete(key);
                    if (tagSet.size === 0) {
                        this.tagIndex.delete(tag);
                    }
                }
            }
        }

        this.updateStats();
    }

    /**
     * Clear all entries
     */
    clear(): void {
        this.cache.clear();
        this.tagIndex.clear();
        this.stats.memoryBytes = 0;
        this.updateStats();
    }

    /**
     * Get current memory usage
     */
    getSize(): number {
        return this.stats.memoryBytes;
    }

    /**
     * Invalidate entries by tags
     */
    invalidateByTags(tags: string[]): void {
        const keysToDelete = new Set<string>();

        for (const tag of tags) {
            const tagSet = this.tagIndex.get(tag);
            if (tagSet) {
                tagSet.forEach(key => keysToDelete.add(key));
            }
        }

        keysToDelete.forEach(key => this.delete(key));
    }

    /**
     * Run LRU eviction to meet memory limit
     * Supports Requirements 3.1, 3.2, 3.4 - Memory management and priority-based retention
     */
    cleanup(): void {
        const targetBytes = this.config.maxMemoryBytes * 0.8; // Reduce to 80% of max

        if (this.stats.memoryBytes <= targetBytes) {
            return;
        }

        // Convert cache entries to array for sorting
        const entries = Array.from(this.cache.entries());

        // Sort by priority (ascending) and last accessed time (ascending)
        // Lower priority and older access = first to evict
        entries.sort((a, b) => {
            const [, entryA] = a;
            const [, entryB] = b;

            // Priority difference
            const priorityDiff = entryA.priority - entryB.priority;
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            // If same priority, evict least recently accessed
            return entryA.metadata.lastAccessedAt - entryB.metadata.lastAccessedAt;
        });

        // Evict entries until we reach target
        let bytesToRemove = this.stats.memoryBytes - targetBytes;

        for (const [key, entry] of entries) {
            if (bytesToRemove <= 0) {
                break;
            }

            // Don't evict critical data (priority > 80)
            // Supports Requirement 3.5 - Critical data preservation
            if (entry.priority > 80) {
                continue;
            }

            this.delete(key);
            bytesToRemove -= entry.sizeBytes;
            this.stats.evictions++;
        }

        this.updateStats();
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Update hit rate calculation
     */
    private updateHitRate(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Update cache statistics
     */
    private updateStats(): void {
        this.stats.entries = this.cache.size;

        // Count stale entries
        let staleCount = 0;
        for (const entry of this.cache.values()) {
            if (isStale(entry, this.config.staleTTL)) {
                staleCount++;
            }
        }
        this.stats.staleEntries = staleCount;
    }

    /**
     * Get all keys in cache
     */
    getAllKeys(): string[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Check if key exists in cache
     */
    has(key: string): boolean {
        return this.cache.has(key);
    }

    /**
     * Get all entries (for debugging)
     */
    getAllEntries(): Map<string, CacheEntry<any>> {
        return new Map(this.cache);
    }

    /**
     * Clean up expired entries
     * Supports Requirement 3.3 - Stale cache marking
     */
    cleanupExpired(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt <= now) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.delete(key));
    }

    /**
     * Mark stale entries for background refresh
     * Supports Requirement 3.3 - Stale cache marking
     */
    markStaleEntries(): string[] {
        const staleKeys: string[] = [];

        for (const [key, entry] of this.cache.entries()) {
            if (isStale(entry, this.config.staleTTL)) {
                entry.stale = true;
                staleKeys.push(key);
            }
        }

        this.updateStats();
        return staleKeys;
    }

    /**
     * Get entries by tag
     */
    getEntriesByTag(tag: string): string[] {
        const tagSet = this.tagIndex.get(tag);
        return tagSet ? Array.from(tagSet) : [];
    }

    /**
     * Update cache configuration
     */
    updateConfig(config: Partial<CacheConfig>): void {
        this.config = { ...this.config, ...config };

        // Run cleanup if new memory limit is lower
        if (this.stats.memoryBytes > this.config.maxMemoryBytes) {
            this.cleanup();
        }
    }
}
