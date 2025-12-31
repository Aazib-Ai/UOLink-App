/**
 * IndexedDB wrapper for persistent page caching
 * Supports Requirements 6.1, 6.4, 6.5 - Offline support and storage management
 */

import {
    CacheEntry,
    CacheConfig,
    DEFAULT_CACHE_CONFIG,
    isExpired,
    approximateSize,
} from './types';

const DB_NAME = 'uolink-page-cache';
const DB_VERSION = 1;
const STORE_NAME = 'page-cache';

/**
 * IndexedDB wrapper for persistent cache storage
 */
export class IndexedDBCache {
    private db: IDBDatabase | null = null;
    private dbName: string;
    private version: number;
    private config: CacheConfig;
    private initPromise: Promise<void> | null = null;

    constructor(
        dbName: string = DB_NAME,
        version: number = DB_VERSION,
        config: Partial<CacheConfig> = {}
    ) {
        this.dbName = dbName;
        this.version = version;
        this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    }

    /**
     * Initialize database connection and create object stores
     */
    async init(): Promise<void> {
        // Return existing initialization promise if already initializing
        if (this.initPromise) {
            return this.initPromise;
        }

        // Return immediately if already initialized
        if (this.db) {
            return Promise.resolve();
        }

        this.initPromise = new Promise((resolve, reject) => {
            // Check if IndexedDB is supported
            if (typeof indexedDB === 'undefined') {
                console.warn('IndexedDB not supported, cache persistence disabled');
                resolve();
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });

                    // Create indexes for efficient queries
                    store.createIndex('timestamp', 'entry.timestamp', { unique: false });
                    store.createIndex('expiresAt', 'entry.expiresAt', { unique: false });
                    store.createIndex('priority', 'entry.priority', { unique: false });
                    store.createIndex('tags', 'entry.tags', { unique: false, multiEntry: true });
                }
            };
        });

        return this.initPromise;
    }

    /**
     * Ensure database is initialized before operations
     */
    private async ensureInit(): Promise<void> {
        if (!this.db) {
            await this.init();
        }
    }

    /**
     * Get a transaction for the object store
     */
    private getTransaction(mode: IDBTransactionMode): IDBObjectStore | null {
        if (!this.db) {
            return null;
        }
        const transaction = this.db.transaction([STORE_NAME], mode);
        return transaction.objectStore(STORE_NAME);
    }

    /**
     * Retrieve cached entry by key
     */
    async get<T>(key: string, ignoreExpiry: boolean = false): Promise<CacheEntry<T> | null> {
        await this.ensureInit();

        if (!this.db) {
            return null;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readonly');
            if (!store) {
                resolve(null);
                return;
            }

            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;

                if (!result) {
                    resolve(null);
                    return;
                }

                const entry = result.entry as CacheEntry<T>;

                // Check if expired
                if (!ignoreExpiry && isExpired(entry)) {
                    // Don't delete immediately to support offline fallback
                    // this.delete(key).catch(console.error);
                    resolve(null);
                    return;
                }

                // Update last accessed time
                entry.metadata.lastAccessedAt = Date.now();
                entry.metadata.accessCount += 1;

                // Update entry asynchronously
                this.set(key, entry).catch(console.error);

                resolve(entry);
            };

            request.onerror = () => {
                console.error('Failed to get from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Store cache entry
     */
    async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
        await this.ensureInit();

        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readwrite');
            if (!store) {
                resolve();
                return;
            }

            const request = store.put({ key, entry });

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to set in IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Remove cache entry
     */
    async delete(key: string): Promise<void> {
        await this.ensureInit();

        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readwrite');
            if (!store) {
                resolve();
                return;
            }

            const request = store.delete(key);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to delete from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Clear all cached data
     */
    async clear(): Promise<void> {
        await this.ensureInit();

        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readwrite');
            if (!store) {
                resolve();
                return;
            }

            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                console.error('Failed to clear IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Get all cache keys
     */
    async getAllKeys(): Promise<string[]> {
        await this.ensureInit();

        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readonly');
            if (!store) {
                resolve([]);
                return;
            }

            const request = store.getAllKeys();

            request.onsuccess = () => {
                resolve(request.result as string[]);
            };

            request.onerror = () => {
                console.error('Failed to get keys from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Calculate total storage usage
     */
    async getSize(): Promise<number> {
        await this.ensureInit();

        if (!this.db) {
            return 0;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readonly');
            if (!store) {
                resolve(0);
                return;
            }

            const request = store.getAll();

            request.onsuccess = () => {
                const entries = request.result;
                const totalSize = entries.reduce((sum, item) => {
                    return sum + (item.entry?.sizeBytes || 0);
                }, 0);
                resolve(totalSize);
            };

            request.onerror = () => {
                console.error('Failed to calculate size:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Remove entries to meet size limit using LRU eviction
     * Supports Requirement 3.1, 3.2 - Memory management and LRU eviction
     */
    async cleanup(maxBytes: number = this.config.maxIndexedDBBytes): Promise<void> {
        await this.ensureInit();

        if (!this.db) {
            return;
        }

        const currentSize = await this.getSize();

        if (currentSize <= maxBytes) {
            return;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readwrite');
            if (!store) {
                resolve();
                return;
            }

            const request = store.getAll();

            request.onsuccess = async () => {
                const entries = request.result;

                // Sort by priority (ascending) and last accessed time (ascending)
                // Lower priority and older access time = first to evict
                entries.sort((a, b) => {
                    const priorityDiff = a.entry.priority - b.entry.priority;
                    if (priorityDiff !== 0) return priorityDiff;

                    return a.entry.metadata.lastAccessedAt - b.entry.metadata.lastAccessedAt;
                });

                let bytesToRemove = currentSize - maxBytes;
                const keysToDelete: string[] = [];

                // Collect keys to delete
                for (const item of entries) {
                    if (bytesToRemove <= 0) break;

                    keysToDelete.push(item.key);
                    bytesToRemove -= item.entry.sizeBytes || 0;
                }

                // Delete entries
                for (const key of keysToDelete) {
                    await this.delete(key);
                }

                resolve();
            };

            request.onerror = () => {
                console.error('Failed to cleanup IndexedDB:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Invalidate entries by tags
     */
    async invalidateByTags(tags: string[]): Promise<void> {
        await this.ensureInit();

        if (!this.db || tags.length === 0) {
            return;
        }

        return new Promise((resolve, reject) => {
            const store = this.getTransaction('readwrite');
            if (!store) {
                resolve();
                return;
            }

            const request = store.getAll();

            request.onsuccess = async () => {
                const entries = request.result;
                const keysToDelete: string[] = [];

                // Find entries with matching tags
                for (const item of entries) {
                    const entryTags = item.entry?.tags || [];
                    const hasMatchingTag = tags.some(tag => entryTags.includes(tag));

                    if (hasMatchingTag) {
                        keysToDelete.push(item.key);
                    }
                }

                // Delete entries
                for (const key of keysToDelete) {
                    await this.delete(key);
                }

                resolve();
            };

            request.onerror = () => {
                console.error('Failed to invalidate by tags:', request.error);
                reject(request.error);
            };
        });
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initPromise = null;
        }
    }
}
