/**
 * Shared types for service worker and main thread communication
 * Supports Requirements 6.1, 6.3, 6.4 - Offline support and cache synchronization
 */

import { CacheEntry, PageState } from './types';

/**
 * Message types for cache synchronization between main thread and service worker
 */
export enum SWMessageType {
    // Main thread → Service worker
    CACHE_SET = 'CACHE_SET',
    CACHE_INVALIDATE = 'CACHE_INVALIDATE',
    CACHE_GET = 'CACHE_GET',
    CACHE_WARM = 'CACHE_WARM',

    // Service worker → Main thread
    CACHE_UPDATED = 'CACHE_UPDATED',
    CACHE_GET_RESPONSE = 'CACHE_GET_RESPONSE',
    CACHE_WARM_COMPLETE = 'CACHE_WARM_COMPLETE',
    CACHE_WARM_FAILED = 'CACHE_WARM_FAILED',
}

/**
 * Page cache entry for service worker storage
 */
export interface SWPageCacheEntry {
    /** The page's data payload */
    pageData: any;
    /** UI state */
    pageState: PageState;
    /** Page route identifier */
    route: string;
    /** Cache entry with metadata */
    entry: CacheEntry<any>;
}

/**
 * Base message structure
 */
export interface SWMessage {
    type: SWMessageType;
    timestamp: number;
    requestId?: string; // For request/response correlation
}

/**
 * Cache set message - Main thread notifies service worker of cache update
 */
export interface SWCacheSetMessage extends SWMessage {
    type: SWMessageType.CACHE_SET;
    key: string;
    cacheEntry: SWPageCacheEntry;
}

/**
 * Cache invalidate message - Main thread requests cache invalidation
 */
export interface SWCacheInvalidateMessage extends SWMessage {
    type: SWMessageType.CACHE_INVALIDATE;
    keyOrTags: string | string[];
}

/**
 * Cache get message - Main thread requests cache entry
 */
export interface SWCacheGetMessage extends SWMessage {
    type: SWMessageType.CACHE_GET;
    key: string;
}

/**
 * Cache get response message - Service worker responds with cache entry
 */
export interface SWCacheGetResponseMessage extends SWMessage {
    type: SWMessageType.CACHE_GET_RESPONSE;
    key: string;
    cacheEntry: SWPageCacheEntry | null;
}

/**
 * Cache warm message - Request to warm cache for specific routes
 */
export interface SWCacheWarmMessage extends SWMessage {
    type: SWMessageType.CACHE_WARM;
    routes: string[];
}

/**
 * Cache updated broadcast - Service worker notifies main thread of cache update
 */
export interface SWCacheUpdatedMessage extends SWMessage {
    type: SWMessageType.CACHE_UPDATED;
    key: string;
    source: 'service-worker' | 'network';
}

/**
 * Cache warm complete message
 */
export interface SWCacheWarmCompleteMessage extends SWMessage {
    type: SWMessageType.CACHE_WARM_COMPLETE;
    routes: string[];
    successCount: number;
    failureCount: number;
}

/**
 * Cache warm failed message
 */
export interface SWCacheWarmFailedMessage extends SWMessage {
    type: SWMessageType.CACHE_WARM_FAILED;
    error: string;
}

/**
 * Union type of all possible messages
 */
export type SWCacheMessage =
    | SWCacheSetMessage
    | SWCacheInvalidateMessage
    | SWCacheGetMessage
    | SWCacheGetResponseMessage
    | SWCacheWarmMessage
    | SWCacheUpdatedMessage
    | SWCacheWarmCompleteMessage
    | SWCacheWarmFailedMessage;

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
    /** Routes to warm with priority (higher = warmed first) */
    routes: Array<{
        path: string;
        priority: number;
    }>;
    /** Whether to warm during service worker install */
    warmOnInstall: boolean;
    /** Whether to warm during idle time */
    warmOnIdle: boolean;
    /** Delay before starting idle warming (ms) */
    idleWarmDelay: number;
}

/**
 * Default cache warming configuration
 */
export const DEFAULT_CACHE_WARMING_CONFIG: CacheWarmingConfig = {
    routes: [
        { path: '/dashboard', priority: 100 },
        { path: '/profile', priority: 90 },
        { path: '/timetable', priority: 70 },
    ],
    warmOnInstall: true,
    warmOnIdle: true,
    idleWarmDelay: 2000, // 2 seconds after idle
};

/**
 * Helper to create a cache set message
 */
export function createCacheSetMessage(
    key: string,
    cacheEntry: SWPageCacheEntry
): SWCacheSetMessage {
    return {
        type: SWMessageType.CACHE_SET,
        key,
        cacheEntry,
        timestamp: Date.now(),
    };
}

/**
 * Helper to create a cache invalidate message
 */
export function createCacheInvalidateMessage(
    keyOrTags: string | string[]
): SWCacheInvalidateMessage {
    return {
        type: SWMessageType.CACHE_INVALIDATE,
        keyOrTags,
        timestamp: Date.now(),
    };
}

/**
 * Helper to create a cache get message
 */
export function createCacheGetMessage(key: string, requestId?: string): SWCacheGetMessage {
    return {
        type: SWMessageType.CACHE_GET,
        key,
        timestamp: Date.now(),
        requestId,
    };
}

/**
 * Helper to create a cache warm message
 */
export function createCacheWarmMessage(routes: string[]): SWCacheWarmMessage {
    return {
        type: SWMessageType.CACHE_WARM,
        routes,
        timestamp: Date.now(),
    };
}

/**
 * Type guard to check if message is a cache message
 */
export function isSWCacheMessage(message: any): message is SWCacheMessage {
    return (
        message &&
        typeof message === 'object' &&
        'type' in message &&
        Object.values(SWMessageType).includes(message.type)
    );
}
