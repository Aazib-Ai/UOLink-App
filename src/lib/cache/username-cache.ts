/**
 * Username lookup caching service
 * Provides in-memory caching for username-to-profile mappings to improve performance
 */

import type { UserProfile } from '../data/types';

interface CacheEntry {
    profile: UserProfile | null;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    expiresAt?: number | null;
}

interface CacheStats {
    hits: number;
    misses: number;
    entries: number;
    hitRate: number;
}

class UsernameLookupCache {
    private cache = new Map<string, CacheEntry>();
    private readonly maxSize: number;
    private readonly ttlMs: number;
    private stats = { hits: 0, misses: 0 };

    constructor(maxSize = 1000, ttlMinutes = 30) {
        this.maxSize = maxSize;
        this.ttlMs = ttlMinutes * 60 * 1000;

        // Clean up expired entries every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Get cached profile for username
     */
    get(username: string): UserProfile | null | undefined {
        const normalizedUsername = username.toLowerCase().trim();
        const entry = this.cache.get(normalizedUsername);

        if (!entry) {
            this.stats.misses++;
            return undefined; // Cache miss
        }

        // Check global TTL expiry
        if (Date.now() - entry.timestamp > this.ttlMs) {
            this.cache.delete(normalizedUsername);
            this.stats.misses++;
            return undefined; // Expired
        }

        // Check per-entry expiry (e.g., alias expiry)
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(normalizedUsername);
            this.stats.misses++;
            return undefined; // Expired by alias TTL
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        this.stats.hits++;

        return entry.profile;
    }

    /**
     * Cache profile for username
     */
    set(username: string, profile: UserProfile | null, opts?: { expiresAt?: number | Date | null }): void {
        const normalizedUsername = username.toLowerCase().trim();

        // Ensure cache doesn't exceed max size
        if (this.cache.size >= this.maxSize && !this.cache.has(normalizedUsername)) {
            this.evictLeastRecentlyUsed();
        }

        const expiresAtTs = opts?.expiresAt instanceof Date
            ? opts?.expiresAt.getTime()
            : (typeof opts?.expiresAt === 'number' ? opts?.expiresAt : null);

        const entry: CacheEntry = {
            profile,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now(),
            expiresAt: expiresAtTs ?? null
        };

        this.cache.set(normalizedUsername, entry);
    }

    /**
     * Invalidate cache entry for username
     */
    invalidate(username: string): void {
        const normalizedUsername = username.toLowerCase().trim();
        this.cache.delete(normalizedUsername);
    }

    /**
     * Invalidate cache entries for user profile
     * This handles cases where a user changes their username
     */
    invalidateByUserId(userId: string): void {
        const entriesToDelete: string[] = [];

        for (const [username, entry] of this.cache.entries()) {
            if (entry.profile?.id === userId) {
                entriesToDelete.push(username);
            }
        }

        entriesToDelete.forEach(username => this.cache.delete(username));
    }

    /**
     * Warm cache with popular profiles
     */
    warmCache(profiles: Array<{ username: string; profile: UserProfile }>): void {
        profiles.forEach(({ username, profile }) => {
            this.set(username, profile);
        });
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? this.stats.hits / (this.stats.hits + this.stats.misses)
            : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            entries: this.cache.size,
            hitRate: Math.round(hitRate * 100) / 100
        };
    }

    /**
     * Get most accessed usernames for analytics
     */
    getMostAccessed(limit = 10): Array<{ username: string; accessCount: number; profile: UserProfile | null }> {
        const entries = Array.from(this.cache.entries())
            .map(([username, entry]) => ({
                username,
                accessCount: entry.accessCount,
                profile: entry.profile
            }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);

        return entries;
    }

    /**
     * Remove expired entries from cache
     */
    private cleanup(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [username, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.ttlMs) {
                expiredKeys.push(username);
            }
        }

        expiredKeys.forEach(key => this.cache.delete(key));

        if (expiredKeys.length > 0) {
            console.log(`[UsernameCache] Cleaned up ${expiredKeys.length} expired entries`);
        }
    }

    /**
     * Evict least recently used entry to make room for new entries
     */
    private evictLeastRecentlyUsed(): void {
        let oldestKey: string | null = null;
        let oldestTime = Date.now();

        for (const [username, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = username;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}

// Export singleton instance
export const usernameCache = new UsernameLookupCache();

// Export class for testing
export { UsernameLookupCache };
