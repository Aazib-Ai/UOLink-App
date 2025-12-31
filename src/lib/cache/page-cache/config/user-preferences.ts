/**
 * User Preferences System for PWA Page Caching
 * Allows users to customize cache behavior through persisted preferences
 * Requirements: 3.1, 3.2, 4.4
 */

import { CacheConfig, DEFAULT_CACHE_CONFIG } from '../types';

/**
 * User-customizable cache preferences
 */
export interface UserCachePreferences {
    /** Enable/disable caching entirely */
    cacheEnabled: boolean;
    /** Maximum cache size in MB */
    maxCacheSizeMB: number;
    /** Default TTL in minutes */
    defaultTTLMinutes: number;
    /** When to mark cache as stale (minutes) */
    staleTTLMinutes: number;
    /** Enable IndexedDB persistence */
    persistenceEnabled: boolean;
    /** Enable background refresh */
    backgroundRefreshEnabled: boolean;
    /** Enable offline support */
    offlineEnabled: boolean;
    /** Performance vs. freshness (0 = fresh, 100 = fast) */
    performanceVsFreshness: number;
    /** Enable monitoring */
    monitoringEnabled: boolean;
    /** Auto-clear old cache */
    autoClearEnabled: boolean;
    /** Last updated timestamp */
    lastUpdated: number;
}

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: UserCachePreferences = {
    cacheEnabled: true,
    maxCacheSizeMB: 50,
    defaultTTLMinutes: 5,
    staleTTLMinutes: 30,
    persistenceEnabled: true,
    backgroundRefreshEnabled: true,
    offlineEnabled: true,
    performanceVsFreshness: 75, // Favor performance
    monitoringEnabled: true,
    autoClearEnabled: true,
    lastUpdated: Date.now(),
};

/**
 * Validation constraints for preferences
 */
const PREFERENCE_CONSTRAINTS = {
    maxCacheSizeMB: { min: 10, max: 500 },
    defaultTTLMinutes: { min: 1, max: 60 },
    staleTTLMinutes: { min: 5, max: 1440 }, // Up to 24 hours
    performanceVsFreshness: { min: 0, max: 100 },
};

/**
 * Storage interface for user preferences
 */
export interface PreferenceStorage {
    load(): Promise<UserCachePreferences | null>;
    save(preferences: UserCachePreferences): Promise<void>;
    clear(): Promise<void>;
}

/**
 * LocalStorage implementation of preference storage (sync, limited size)
 */
export class LocalStoragePreferenceStorage implements PreferenceStorage {
    private readonly key = 'uolink_cache_preferences';

    async load(): Promise<UserCachePreferences | null> {
        try {
            const data = localStorage.getItem(this.key);
            if (!data) {
                return null;
            }
            return JSON.parse(data) as UserCachePreferences;
        } catch (error) {
            console.warn('Failed to load preferences from localStorage:', error);
            return null;
        }
    }

    async save(preferences: UserCachePreferences): Promise<void> {
        try {
            localStorage.setItem(this.key, JSON.stringify(preferences));
        } catch (error) {
            console.error('Failed to save preferences to localStorage:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            localStorage.removeItem(this.key);
        } catch (error) {
            console.warn('Failed to clear preferences from localStorage:', error);
        }
    }
}

/**
 * IndexedDB implementation of preference storage (async, larger capacity)
 */
export class IndexedDBPreferenceStorage implements PreferenceStorage {
    private readonly dbName = 'UolinkCachePreferences';
    private readonly storeName = 'preferences';
    private readonly version = 1;
    private readonly key = 'userPreferences';

    private async getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    }

    async load(): Promise<UserCachePreferences | null> {
        try {
            const db = await this.getDB();
            const transaction = db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.get(this.key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to load preferences from IndexedDB:', error);
            return null;
        }
    }

    async save(preferences: UserCachePreferences): Promise<void> {
        try {
            const db = await this.getDB();
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.put(preferences, this.key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error('Failed to save preferences to IndexedDB:', error);
            throw error;
        }
    }

    async clear(): Promise<void> {
        try {
            const db = await this.getDB();
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);

            return new Promise((resolve, reject) => {
                const request = store.delete(this.key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn('Failed to clear preferences from IndexedDB:', error);
        }
    }
}

/**
 * User preferences manager
 */
export class UserPreferencesManager {
    private preferences: UserCachePreferences;
    private storage: PreferenceStorage;
    private listeners: Array<(preferences: UserCachePreferences) => void> = [];

    constructor(storage: PreferenceStorage = new IndexedDBPreferenceStorage()) {
        this.preferences = { ...DEFAULT_USER_PREFERENCES };
        this.storage = storage;
    }

    /**
     * Initialize preferences from storage
     */
    async initialize(): Promise<void> {
        try {
            const stored = await this.storage.load();
            if (stored) {
                this.preferences = this.validateAndSanitize(stored);
            }
        } catch (error) {
            console.warn('Failed to initialize preferences, using defaults:', error);
        }
    }

    /**
     * Get current preferences
     */
    getPreferences(): UserCachePreferences {
        return { ...this.preferences };
    }

    /**
     * Update preferences (partial update)
     */
    async updatePreferences(updates: Partial<UserCachePreferences>): Promise<void> {
        const updated = { ...this.preferences, ...updates, lastUpdated: Date.now() };
        this.preferences = this.validateAndSanitize(updated);

        try {
            await this.storage.save(this.preferences);
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to save preferences:', error);
            throw error;
        }
    }

    /**
     * Reset preferences to defaults
     */
    async resetToDefaults(): Promise<void> {
        this.preferences = { ...DEFAULT_USER_PREFERENCES, lastUpdated: Date.now() };

        try {
            await this.storage.save(this.preferences);
            this.notifyListeners();
        } catch (error) {
            console.error('Failed to reset preferences:', error);
            throw error;
        }
    }

    /**
     * Export preferences as JSON
     */
    exportPreferences(): string {
        return JSON.stringify(this.preferences, null, 2);
    }

    /**
     * Import preferences from JSON
     */
    async importPreferences(json: string): Promise<void> {
        try {
            const imported = JSON.parse(json) as UserCachePreferences;
            await this.updatePreferences(imported);
        } catch (error) {
            console.error('Failed to import preferences:', error);
            throw new Error('Invalid preference format');
        }
    }

    /**
     * Convert preferences to CacheConfig
     */
    toCacheConfig(): Partial<CacheConfig> {
        return {
            maxMemoryBytes: this.preferences.maxCacheSizeMB * 1024 * 1024,
            defaultTTL: this.preferences.defaultTTLMinutes * 60 * 1000,
            staleTTL: this.preferences.staleTTLMinutes * 60 * 1000,
            enablePersistence: this.preferences.persistenceEnabled,
        };
    }

    /**
     * Add a listener for preference changes
     */
    addListener(listener: (preferences: UserCachePreferences) => void): () => void {
        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Validate and sanitize preferences
     */
    private validateAndSanitize(preferences: UserCachePreferences): UserCachePreferences {
        const sanitized = { ...preferences };

        // Clamp numeric values
        sanitized.maxCacheSizeMB = this.clamp(
            sanitized.maxCacheSizeMB,
            PREFERENCE_CONSTRAINTS.maxCacheSizeMB.min,
            PREFERENCE_CONSTRAINTS.maxCacheSizeMB.max
        );

        sanitized.defaultTTLMinutes = this.clamp(
            sanitized.defaultTTLMinutes,
            PREFERENCE_CONSTRAINTS.defaultTTLMinutes.min,
            PREFERENCE_CONSTRAINTS.defaultTTLMinutes.max
        );

        sanitized.staleTTLMinutes = this.clamp(
            sanitized.staleTTLMinutes,
            PREFERENCE_CONSTRAINTS.staleTTLMinutes.min,
            PREFERENCE_CONSTRAINTS.staleTTLMinutes.max
        );

        sanitized.performanceVsFreshness = this.clamp(
            sanitized.performanceVsFreshness,
            PREFERENCE_CONSTRAINTS.performanceVsFreshness.min,
            PREFERENCE_CONSTRAINTS.performanceVsFreshness.max
        );

        // Ensure staleTTL is greater than defaultTTL
        if (sanitized.staleTTLMinutes <= sanitized.defaultTTLMinutes) {
            sanitized.staleTTLMinutes = sanitized.defaultTTLMinutes * 2;
        }

        return sanitized;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private notifyListeners(): void {
        for (const listener of this.listeners) {
            try {
                listener(this.getPreferences());
            } catch (error) {
                console.error('Error in preference listener:', error);
            }
        }
    }
}

/**
 * Global preferences manager instance
 */
let globalPreferencesManager: UserPreferencesManager | null = null;

/**
 * Get the global preferences manager
 */
export function getUserPreferencesManager(): UserPreferencesManager {
    if (!globalPreferencesManager) {
        globalPreferencesManager = new UserPreferencesManager();
    }
    return globalPreferencesManager;
}

/**
 * Set the global preferences manager
 */
export function setUserPreferencesManager(manager: UserPreferencesManager): void {
    globalPreferencesManager = manager;
}
