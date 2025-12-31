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

// Page cache context and hooks
export { PageCacheProvider, usePageCache } from './page-cache/page-cache-context';
export { useCachedPage } from './page-cache/hooks/use-cached-page';
export { useNavigationState } from './page-cache/hooks/use-navigation-state';
export type { UseNavigationStateOptions } from './page-cache/hooks/use-navigation-state';
