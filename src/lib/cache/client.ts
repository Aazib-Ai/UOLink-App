'use client';

/**
 * Client-side cache module exports
 * This module includes React hooks and components that can only be used in Client Components.
 * For server-side cache utilities, import from './index.ts' instead.
 */

// Re-export all server-safe exports for convenience
export * from './index';

// Client-only exports - React hooks and context
export { PageCacheProvider, usePageCache } from './page-cache/page-cache-context';
export { useCachedPage } from './page-cache/hooks/use-cached-page';
export { useNavigationState } from './page-cache/hooks/use-navigation-state';
export type { UseNavigationStateOptions } from './page-cache/hooks/use-navigation-state';
