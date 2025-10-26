/**
 * Cache initialization utilities
 * Sets up caching when the application starts
 */

import { warmUsernameCache, schedulePeriodicCacheWarming } from './cache-warming';

/**
 * Initialize caching system
 * Call this when the application starts
 */
export async function initializeCache(): Promise<void> {
    try {
        console.log('[Cache] Initializing username cache system...');

        // Initial cache warming
        await warmUsernameCache({
            warmLeaderboard: true,
            warmPopularContributors: true,
            leaderboardLimit: 20, // Start with top 20 profiles
            contributorLimit: 50   // And top 50 contributors
        });

        // Schedule periodic warming every hour
        schedulePeriodicCacheWarming(60);

        console.log('[Cache] Username cache system initialized successfully');
    } catch (error) {
        console.error('[Cache] Error initializing cache system:', error);
        // Don't throw - cache is optional and shouldn't break the app
    }
}

/**
 * Initialize cache in development mode with more frequent updates
 */
export async function initializeCacheDev(): Promise<void> {
    try {
        console.log('[Cache] Initializing username cache system (development mode)...');

        // Initial cache warming with smaller limits for faster startup
        await warmUsernameCache({
            warmLeaderboard: true,
            warmPopularContributors: false, // Skip in dev for faster startup
            leaderboardLimit: 10,
            contributorLimit: 0
        });

        // Schedule more frequent warming in development (every 15 minutes)
        schedulePeriodicCacheWarming(15);

        console.log('[Cache] Username cache system initialized successfully (dev mode)');
    } catch (error) {
        console.error('[Cache] Error initializing cache system:', error);
    }
}