/**
 * CacheManager - Orchestrates memory and IndexedDB caches
 * Implements Requirements 3.1, 3.2, 3.3, 3.4, 8.1, 8.2
 * - LRU eviction algorithm for memory management
 * - Priority-based cache retention logic
 * - Page type and user content prioritization
 */

import { MemoryCache } from './memory-cache';
import { IndexedDBCache } from './indexeddb-wrapper';
import {
    CacheEntry,
    CacheConfig,
    CacheStats,
    PageState,
    DEFAULT_CACHE_CONFIG,
    approximateSize,
    isStale,
} from './types';
import {
    ConfigurationManager,
    FeatureFlag,
    MonitoringManager,
} from './config';

/**
 * Page type enumeration for priority calculation
 */
export enum PageType {
    DASHBOARD = 'dashboard',
    PROFILE = 'profile',
    TIMETABLE = 'timetable',
    SETTINGS = 'settings',
    PUBLIC_PROFILE = 'public-profile',
    OTHER = 'other',
}

/**
 * Content type for prioritization
 */
export enum ContentType {
    USER_GENERATED = 'user-generated', // User's own content
    PERSONALIZED = 'personalized',     // Personalized for user
    GENERIC = 'generic',                // Generic/public content
}

/**
 * Extended priority weights including page type and content type
 */
export interface ExtendedPriorityWeights {
    frequency: number;   // 0.3 - How often accessed
    recency: number;     // 0.2 - How recently accessed
    pageType: number;    // 0.3 - Type of page
    contentType: number; // 0.2 - Type of content
}

/**
 * Cache entry metadata with page and content type
 */
export interface CacheEntryMetadata {
    pageType: PageType;
    contentType: ContentType;
    route: string;
    pageState?: PageState;
}

/**
 * Default extended priority weights
 */
const DEFAULT_PRIORITY_WEIGHTS: ExtendedPriorityWeights = {
    frequency: 0.3,
    recency: 0.2,
    pageType: 0.3,
    contentType: 0.2,
};

/**
 * CacheManager coordinates memory and persistent caching with intelligent eviction
 */
export class CacheManager {
    private memoryCache: MemoryCache;
    private indexedDBCache: IndexedDBCache | null = null;
    private config: CacheConfig;
    private priorityWeights: ExtendedPriorityWeights;
    private recentRoutes: string[] = []; // Track recent navigation for priority
    private isOfflineMode: boolean = false;
    private configManager: ConfigurationManager | null = null;
    private monitoringManager: MonitoringManager | null = null;


    constructor(config: Partial<CacheConfig> = {}, configManager?: ConfigurationManager) {
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
        this.memoryCache = new MemoryCache(this.config);
        this.priorityWeights = DEFAULT_PRIORITY_WEIGHTS;
        this.configManager = configManager || null;

        // Get monitoring manager if config manager is available
        if (this.configManager) {
            this.monitoringManager = this.configManager.getMonitoringManager();
        }

        // Initialize IndexedDB if persistence is enabled (check feature flag if available)
        const persistenceEnabled = this.configManager
            ? this.configManager.isFeatureEnabledSync(FeatureFlag.INDEXEDDB_PERSISTENCE)
            : this.config.enablePersistence;

        if (persistenceEnabled) {
            this.indexedDBCache = new IndexedDBCache();
            this.indexedDBCache.init().catch(err => {
                console.error('Failed to initialize IndexedDB cache:', err);
                this.indexedDBCache = null;
            });
        }
    }

    /**
     * Set offline mode to adjust cache behavior
     * Supports Requirement 6.4 - Cache integrity during extended offline
     */
    setOfflineMode(isOffline: boolean): void {
        this.isOfflineMode = isOffline;
    }

    /**
     * Check storage quota usage
     * Supports Requirement 6.5 - Storage quota monitoring
     */
    async checkStorageQuota(): Promise<{ usage: number; quota: number; percentage: number } | null> {
        if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
            try {
                const estimate = await navigator.storage.estimate();
                if (estimate.usage !== undefined && estimate.quota !== undefined) {
                    return {
                        usage: estimate.usage,
                        quota: estimate.quota,
                        percentage: (estimate.usage / estimate.quota) * 100
                    };
                }
            } catch (error) {
                console.error('Failed to get storage estimate:', error);
            }
        }
        return null;
    }

    /**
     * Get cached data with fallback from memory to IndexedDB
     * Supports Requirement 5.2 - Cache-first data fetching
     */
    async get<T>(key: string): Promise<CacheEntry<T> | null> {
        // Try memory cache first
        const memoryEntry = this.memoryCache.get<T>(key, this.isOfflineMode);
        if (memoryEntry) {
            // Recalculate priority with extended weights if metadata includes page/content type
            if (memoryEntry.metadata.pageType && memoryEntry.metadata.contentType) {
                memoryEntry.priority = this.calculateExtendedPriority(
                    memoryEntry.metadata.pageType as PageType,
                    memoryEntry.metadata.contentType as ContentType,
                    memoryEntry.metadata.accessCount,
                    memoryEntry.metadata.lastAccessedAt
                );
            }
            return memoryEntry;
        }

        // Fallback to IndexedDB
        if (this.indexedDBCache) {
            const idbEntry = await this.indexedDBCache.get<T>(key, this.isOfflineMode);
            if (idbEntry) {
                // Promote to memory cache
                this.memoryCache.set(key, idbEntry);

                // Recalculate priority if metadata includes page/content type
                if (idbEntry.metadata.pageType && idbEntry.metadata.contentType) {
                    idbEntry.priority = this.calculateExtendedPriority(
                        idbEntry.metadata.pageType as PageType,
                        idbEntry.metadata.contentType as ContentType,
                        idbEntry.metadata.accessCount,
                        idbEntry.metadata.lastAccessedAt
                    );
                }
                return idbEntry;
            }
            return null;
        }

        return null;
    }

    /**
     * Get data synchronously from memory cache if available
     * Supports Requirement 7.3 - Consistent component lifecycle during cache restoration
     */
    getSync<T>(key: string): CacheEntry<T> | null {
        // Try memory cache
        const memoryEntry = this.memoryCache.get<T>(key, this.isOfflineMode);
        if (memoryEntry) {
            // Recalculate priority with extended weights if metadata includes page/content type
            if (memoryEntry.metadata.pageType && memoryEntry.metadata.contentType) {
                memoryEntry.priority = this.calculateExtendedPriority(
                    memoryEntry.metadata.pageType as PageType,
                    memoryEntry.metadata.contentType as ContentType,
                    memoryEntry.metadata.accessCount,
                    memoryEntry.metadata.lastAccessedAt
                );
            }
            return memoryEntry;
        }

        return null;
    }

    /**
     * Set cache entry with automatic persistence and priority calculation
     * Supports Requirements 3.1, 8.1, 8.2 - Memory management and prioritization
     */
    async set<T>(
        key: string,
        data: T,
        metadata: CacheEntryMetadata,
        ttl: number = this.config.defaultTTL
    ): Promise<void> {
        const now = Date.now();

        // Check if advanced priority calculation is enabled
        const useAdvancedPriority = this.configManager
            ? this.configManager.isFeatureEnabledSync(FeatureFlag.ADVANCED_PRIORITY)
            : true;

        // Calculate priority based on page type, content type, frequency, and recency
        const priority = useAdvancedPriority
            ? this.calculateExtendedPriority(
                metadata.pageType,
                metadata.contentType,
                1, // Initial access count
                now
            )
            : 50; // Default priority if feature is disabled

        // Create cache entry
        const entry: CacheEntry<T> = {
            data,
            timestamp: now,
            expiresAt: now + ttl,
            priority,
            sizeBytes: approximateSize(data),
            tags: this.generateTags(metadata),
            stale: false,
            metadata: {
                createdAt: now,
                lastAccessedAt: now,
                accessCount: 1,
                source: 'network',
                pageType: metadata.pageType,
                contentType: metadata.contentType,
            },
        };

        // Store in memory cache
        this.memoryCache.set(key, entry);

        // Store in IndexedDB for persistence (if feature enabled)
        const persistenceEnabled = this.configManager
            ? this.configManager.isFeatureEnabledSync(FeatureFlag.INDEXEDDB_PERSISTENCE)
            : true;

        if (this.indexedDBCache && persistenceEnabled) {
            await this.indexedDBCache.set(key, entry);
        }

        // Track recent routes for priority calculation
        this.updateRecentRoutes(metadata.route);

        // Report metrics to monitoring manager
        if (this.monitoringManager) {
            const stats = this.getStats();
            const quotaInfo = await this.checkStorageQuota();
            this.monitoringManager.recordMetric(stats, quotaInfo || undefined);
        }
    }

    /**
     * Invalidate cache entries by key or tags
     */
    async invalidate(keyOrTags: string | string[]): Promise<void> {
        if (typeof keyOrTags === 'string') {
            // Invalidate single key
            this.memoryCache.delete(keyOrTags);
            if (this.indexedDBCache) {
                await this.indexedDBCache.delete(keyOrTags);
            }
        } else {
            // Invalidate by tags
            this.memoryCache.invalidateByTags(keyOrTags);
            if (this.indexedDBCache) {
                await this.indexedDBCache.invalidateByTags(keyOrTags);
            }
        }
    }

    /**
     * Cleanup cache with LRU eviction and priority-based retention
     * Supports Requirements 3.1, 3.2, 3.3, 3.4 - Memory management
     */
    async cleanup(memoryPressure: boolean = false): Promise<void> {
        if (memoryPressure) {
            // Under memory pressure, reduce to 50% of max
            const targetBytes = this.config.maxMemoryBytes * 0.5;
            await this.evictToTarget(targetBytes);
        } else if (this.isOfflineMode) {
            // In offline mode, we preserve as much as possible, only cleaning up extremely old items if absolutely necessary
            // or valid "garbage". For now, we skip standard TTL cleanup for offline availability.
            // Requirement 6.4 - Cache integrity preservation
            return;
        } else {
            // Normal cleanup - use built-in memory cache cleanup
            this.memoryCache.cleanup();

            // Adaptive priority adjustment
            // Supports Requirement 8.4 - Adaptive priority based on usage patterns
            this.adaptPriorityWeights();
        }

        // Cleanup IndexedDB if needed
        if (this.indexedDBCache) {
            await this.indexedDBCache.cleanup();
        }

        // Mark stale entries for background refresh
        // Supports Requirement 3.3 - Stale cache marking
        this.markStaleEntries();
    }

    /**
     * Mark entries older than staleTTL as stale
     * Supports Requirement 3.3 - Stale cache marking
     */
    markStaleEntries(): string[] {
        return this.memoryCache.markStaleEntries();
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const stats = this.memoryCache.getStats();

        // Report to monitoring manager if available
        if (this.monitoringManager) {
            // Don't call recordMetric here to avoid recursion from set() method
            // Stats are already recorded in set() method
        }

        return stats;
    }

    /**
     * Set configuration manager
     */
    setConfigurationManager(manager: ConfigurationManager): void {
        this.configManager = manager;
        this.monitoringManager = manager.getMonitoringManager();

        // Listen to configuration changes
        manager.addListener((event) => {
            // Update config when it changes
            this.config = { ...this.config, ...event.newConfig };
            this.memoryCache.updateConfig(this.config);
        });
    }

    /**
     * Clear all caches
     */
    async clear(): Promise<void> {
        this.memoryCache.clear();
        if (this.indexedDBCache) {
            await this.indexedDBCache.clear();
        }
        this.recentRoutes = [];
    }

    /**
     * Calculate extended priority based on page type, content type, frequency, and recency
     * Supports Requirements 8.1, 8.2, 8.3 - Priority calculation and prioritization
     */
    private calculateExtendedPriority(
        pageType: PageType,
        contentType: ContentType,
        accessCount: number,
        lastAccessedAt: number
    ): number {
        const now = Date.now();
        const ageMs = now - lastAccessedAt;
        const ageHours = ageMs / (1000 * 60 * 60);

        // Frequency score (logarithmic scale, 0-100)
        const frequencyScore = Math.min(100, Math.log10(accessCount + 1) * 50);

        // Recency score (exponential decay, 0-100)
        const recencyScore = Math.max(0, 100 * Math.exp(-ageHours / 24));

        // Page type score (0-100)
        // Supports Requirement 8.1 - Page type prioritization
        const pageTypeScore = this.getPageTypeScore(pageType);

        // Content type score (0-100)
        // Supports Requirement 8.2 - User content prioritization
        const contentTypeScore = this.getContentTypeScore(contentType);

        // Weighted combination
        const priority =
            frequencyScore * this.priorityWeights.frequency +
            recencyScore * this.priorityWeights.recency +
            pageTypeScore * this.priorityWeights.pageType +
            contentTypeScore * this.priorityWeights.contentType;

        return Math.min(100, Math.max(0, priority));
    }

    /**
     * Get page type score for priority calculation
     * Supports Requirement 8.1 - Page type prioritization
     */
    private getPageTypeScore(pageType: PageType): number {
        switch (pageType) {
            case PageType.DASHBOARD:
                return 100; // Highest priority
            case PageType.PROFILE:
                return 90;
            case PageType.TIMETABLE:
                return 70;
            case PageType.SETTINGS:
                return 60;
            case PageType.PUBLIC_PROFILE:
                return 50;
            case PageType.OTHER:
            default:
                return 30;
        }
    }

    /**
     * Get content type score for priority calculation
     * Supports Requirement 8.2 - User content prioritization
     */
    private getContentTypeScore(contentType: ContentType): number {
        switch (contentType) {
            case ContentType.USER_GENERATED:
                return 100; // Highest priority
            case ContentType.PERSONALIZED:
                return 70;
            case ContentType.GENERIC:
            default:
                return 30;
        }
    }

    /**
     * Generate tags for cache entry based on metadata
     */
    private generateTags(metadata: CacheEntryMetadata): string[] {
        const tags: string[] = [];

        tags.push(`page:${metadata.pageType}`);
        tags.push(`content:${metadata.contentType}`);
        tags.push(`route:${metadata.route}`);

        return tags;
    }

    /**
     * Update recent routes for priority calculation
     * Supports Requirement 3.4 - Priority-based retention
     */
    private updateRecentRoutes(route: string): void {
        // Remove if already exists
        this.recentRoutes = this.recentRoutes.filter(r => r !== route);

        // Add to front
        this.recentRoutes.unshift(route);

        // Keep only last 3 routes (current + 2 recent)
        if (this.recentRoutes.length > 3) {
            this.recentRoutes = this.recentRoutes.slice(0, 3);
        }
    }

    /**
     * Check if a route is in recent routes
     */
    private isRecentRoute(route: string): boolean {
        return this.recentRoutes.includes(route);
    }

    /**
     * Evict entries to reach target memory size
     * Supports Requirements 3.2, 3.4 - Memory pressure response and priority retention
     */
    private async evictToTarget(targetBytes: number): Promise<void> {
        const currentSize = this.memoryCache.getSize();

        if (currentSize <= targetBytes) {
            return;
        }

        // Get all entries
        const entries = Array.from(this.memoryCache.getAllEntries().entries());

        // Sort by priority (ascending) and last accessed time (ascending)
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
        let bytesToRemove = currentSize - targetBytes;
        let evictedCount = 0;

        for (const [key, entry] of entries) {
            if (bytesToRemove <= 0) {
                break;
            }

            // Don't evict critical data (priority > 80) or unsaved changes
            // Supports Requirement 3.5 - Critical data preservation
            if (entry.priority > 80 || entry.metadata.hasUnsavedChanges) {
                continue;
            }

            // Check if this is a recent route
            const isRecent = entry.tags.some(tag => {
                if (tag.startsWith('route:')) {
                    const route = tag.substring(6);
                    return this.isRecentRoute(route);
                }
                return false;
            });

            // Don't evict recent routes (current + 2 most recent)
            // Supports Requirement 3.4 - Priority-based retention
            if (isRecent && this.recentRoutes.length <= 3) {
                continue;
            }

            this.memoryCache.delete(key);
            bytesToRemove -= entry.sizeBytes;
            evictedCount++;
        }
    }

    /**
     * Get recent routes (for testing)
     */
    getRecentRoutes(): string[] {
        return [...this.recentRoutes];
    }

    /**
     * Update priority weights (for testing and configuration)
     */
    updatePriorityWeights(weights: Partial<ExtendedPriorityWeights>): void {
        this.priorityWeights = { ...this.priorityWeights, ...weights };
        this.memoryCache.updateConfig({ priorityWeights: this.priorityWeights });
    }

    /**
     * Adapt priority weights based on cache performance
     * Supports Requirement 8.4 - Adaptive priority based on usage patterns
     */
    private adaptPriorityWeights(): void {
        // Check if adaptive caching is enabled
        const adaptiveEnabled = this.configManager
            ? this.configManager.isFeatureEnabledSync(FeatureFlag.ADAPTIVE_CACHING)
            : true;

        if (!adaptiveEnabled) {
            return;
        }

        const stats = this.memoryCache.getStats();

        // If hit rate is low, increase frequency weight to favor stable, popular items
        if (stats.hitRate < this.config.minHitRateForAdaptation && stats.entries > 10) {
            const newFrequency = Math.min(0.9, this.priorityWeights.frequency + 0.1);
            const newRecency = Math.max(0.1, 1 - newFrequency - this.priorityWeights.pageType - this.priorityWeights.contentType); // Rebalance

            this.updatePriorityWeights({
                frequency: newFrequency,
                recency: newRecency
            });
        }
    }
}
