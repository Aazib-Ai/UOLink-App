/**
 * Core TypeScript interfaces for page caching system
 * Supports Requirements 5.1, 5.2 - Cache infrastructure and data fetching
 */

/**
 * Metadata for cache entries
 */
export interface CacheMetadata {
  /** When the entry was created */
  createdAt: number;
  /** When the entry was last accessed */
  lastAccessedAt: number;
  /** Number of times this entry has been accessed */
  accessCount: number;
  /** Source of the cached data (e.g., 'network', 'indexeddb', 'memory') */
  source: 'network' | 'indexeddb' | 'memory';
  /** Page type for priority calculation (optional for backward compatibility) */
  pageType?: string;
  /** Content type for priority calculation (optional for backward compatibility) */
  contentType?: string;
  /** Critical flag: True if the page has unsaved user input */
  hasUnsavedChanges?: boolean;
}

/**
 * Generic cache entry with data, metadata, and expiration
 */
export interface CacheEntry<T = any> {
  /** The cached content */
  data: T;
  /** When the entry was cached (timestamp in ms) */
  timestamp: number;
  /** Expiration timestamp (ms) */
  expiresAt: number;
  /** Cache retention priority (0-100, higher = more important) */
  priority: number;
  /** Approximate size in bytes for memory management */
  sizeBytes: number;
  /** Tags for cache invalidation */
  tags: string[];
  /** Whether data needs refresh */
  stale: boolean;
  /** Additional metadata */
  metadata: CacheMetadata;
}

/**
 * UI state preservation for pages
 * Supports Requirements 2.1-2.5 - State persistence
 */
export interface PageState {
  /** Scroll coordinates */
  scrollPosition: {
    x: number;
    y: number;
  };
  /** Active filter selections */
  filters: Record<string, any>;
  /** Search input value */
  searchTerm: string;
  /** Collapsed/expanded UI elements by ID */
  expandedSections: string[];
  /** Unsaved form inputs */
  formData: Record<string, any>;
  /** Page-specific custom state */
  customState: Record<string, any>;
}

/**
 * Complete page cache with data and state
 */
export interface PageCacheEntry {
  /** The page's data payload */
  pageData: any;
  /** UI state */
  pageState: PageState;
  /** Page route identifier */
  route: string;
  /** Cache entry metadata */
  entry: CacheEntry<any>;
}

/**
 * Configuration options for cache system
 * Supports Requirements 3.1, 3.2 - Memory management
 */
export interface CacheConfig {
  /** Memory limit in bytes (default: 50MB) */
  maxMemoryBytes: number;
  /** Persistent storage limit in bytes (default: 100MB) */
  maxIndexedDBBytes: number;
  /** Default time-to-live in ms (default: 5 minutes) */
  defaultTTL: number;
  /** When to mark as stale in ms (default: 30 minutes) */
  staleTTL: number;
  /** Use IndexedDB for persistence */
  enablePersistence: boolean;
  /** Priority calculation weights */
  priorityWeights: {
    /** Weight for access frequency (0-1) */
    frequency: number;
    /** Weight for recency (0-1) */
    recency: number;
  };
  /** Minimum hit rate below which adaptation triggers (default: 0.3) */
  minHitRateForAdaptation: number;
  /** Number of evictions per minute considered thrashing (default: 50) */
  thrashingThreshold: number;
}

/**
 * Cache statistics for monitoring
 * Supports Requirements 3.1, 3.2, 3.3 - Performance monitoring
 */
export interface CacheStats {
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of cache sets */
  sets: number;
  /** Number of evictions due to memory pressure */
  evictions: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Current memory usage in bytes */
  memoryBytes: number;
  /** Number of entries in cache */
  entries: number;
  /** Number of stale entries */
  staleEntries: number;
  /** Number of repeated evictions indicating thrashing */
  thrashingCount: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxMemoryBytes: 50 * 1024 * 1024, // 50MB
  maxIndexedDBBytes: 100 * 1024 * 1024, // 100MB
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  staleTTL: 30 * 60 * 1000, // 30 minutes
  enablePersistence: true,
  priorityWeights: {
    frequency: 0.6,
    recency: 0.4,
  },
  minHitRateForAdaptation: 0.3,
  thrashingThreshold: 50,
};

/**
 * Create an empty page state
 */
export function createEmptyPageState(): PageState {
  return {
    scrollPosition: { x: 0, y: 0 },
    filters: {},
    searchTerm: '',
    expandedSections: [],
    formData: {},
    customState: {},
  };
}

/**
 * Calculate approximate size of an object in bytes
 */
export function approximateSize(value: any): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

/**
 * Check if a cache entry is expired
 */
export function isExpired(entry: CacheEntry<any>): boolean {
  return entry.expiresAt <= Date.now();
}

/**
 * Check if a cache entry is stale
 */
export function isStale(entry: CacheEntry<any>, staleTTL: number): boolean {
  return entry.stale || (Date.now() - entry.timestamp) > staleTTL;
}

/**
 * Calculate priority for a cache entry based on frequency and recency
 * Supports Requirements 8.3 - Priority calculation
 */
export function calculatePriority(
  accessCount: number,
  lastAccessedAt: number,
  weights: { frequency: number; recency: number }
): number {
  const now = Date.now();
  const ageMs = now - lastAccessedAt;
  const ageHours = ageMs / (1000 * 60 * 60);

  // Normalize frequency (logarithmic scale)
  const frequencyScore = Math.min(100, Math.log10(accessCount + 1) * 50);

  // Normalize recency (exponential decay)
  const recencyScore = Math.max(0, 100 * Math.exp(-ageHours / 24));

  // Weighted combination
  const priority =
    frequencyScore * weights.frequency +
    recencyScore * weights.recency;

  return Math.min(100, Math.max(0, priority));
}
