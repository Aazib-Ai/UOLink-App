/**
 * Cache module exports
 */

export { usernameCache, UsernameLookupCache } from './username-cache';
export {
    warmUsernameCache,
    schedulePeriodicCacheWarming,
    getCacheWarmingStats
} from './cache-warming';
export { initializeCache, initializeCacheDev } from './init';

// Page cache exports
export * from './page-cache/types';
export { IndexedDBCache } from './page-cache/indexeddb-wrapper';
export { MemoryCache } from './page-cache/memory-cache';
export { CacheManager, PageType, ContentType } from './page-cache/cache-manager';
export { StateManager } from './page-cache/state-manager';
export { NavigationGuard } from './page-cache/navigation-guard';
export { BackgroundRefreshManager } from './page-cache/background-refresh-manager';

// Note: Client-side hooks (PageCacheProvider, usePageCache, useCachedPage, useNavigationState)
// are exported from './client.ts' to maintain Next.js client/server boundary
