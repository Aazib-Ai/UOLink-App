/**
 * Cache warming service for username lookups
 * Pre-loads popular profiles into cache to improve performance
 */

import { usernameCache } from './username-cache';
import { getAuraLeaderboard } from '../firebase/profiles';
import { getAllNotesWithFilters } from '../firebase/notes';
import type { UserProfile } from '../data/types';

interface CacheWarmingConfig {
    warmLeaderboard: boolean;
    warmPopularContributors: boolean;
    leaderboardLimit: number;
    contributorLimit: number;
}

const DEFAULT_CONFIG: CacheWarmingConfig = {
    warmLeaderboard: true,
    warmPopularContributors: true,
    leaderboardLimit: 50,
    contributorLimit: 100
};

/**
 * Warm cache with popular profiles
 */
export async function warmUsernameCache(config: Partial<CacheWarmingConfig> = {}): Promise<void> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    try {
        console.log('[CacheWarming] Starting username cache warming...');

        const warmingPromises: Promise<void>[] = [];

        // Warm with leaderboard profiles
        if (finalConfig.warmLeaderboard) {
            warmingPromises.push(warmLeaderboardProfiles(finalConfig.leaderboardLimit));
        }

        // Warm with popular contributors
        if (finalConfig.warmPopularContributors) {
            warmingPromises.push(warmPopularContributors(finalConfig.contributorLimit));
        }

        await Promise.allSettled(warmingPromises);

        const stats = usernameCache.getStats();
        console.log(`[CacheWarming] Cache warming completed. Cache now has ${stats.entries} entries.`);
    } catch (error) {
        console.error('[CacheWarming] Error during cache warming:', error);
    }
}

/**
 * Warm cache with leaderboard profiles
 */
async function warmLeaderboardProfiles(limit: number): Promise<void> {
    try {
        const leaderboardProfiles = await getAuraLeaderboard(limit);

        const profilesWithUsernames = leaderboardProfiles
            .filter((profile: any) => profile.username)
            .map((profile: any) => ({
                username: profile.username,
                profile: profile as UserProfile
            }));

        usernameCache.warmCache(profilesWithUsernames);

        console.log(`[CacheWarming] Warmed cache with ${profilesWithUsernames.length} leaderboard profiles`);
    } catch (error) {
        console.error('[CacheWarming] Error warming leaderboard profiles:', error);
    }
}

/**
 * Warm cache with popular contributors
 */
async function warmPopularContributors(limit: number): Promise<void> {
    try {
        // Get recent notes to find popular contributors
        const notesResult = await getAllNotesWithFilters({
            limit: 500, // Get more notes to find diverse contributors
            orderBy: 'uploadedAt',
            orderDirection: 'desc'
        });

        // Count contributions by contributor
        const contributorCounts = new Map<string, number>();

        notesResult.notes.forEach((note: any) => {
            if (note.contributorName) {
                const count = contributorCounts.get(note.contributorName) || 0;
                contributorCounts.set(note.contributorName, count + 1);
            }
        });

        // Get top contributors
        const topContributors = Array.from(contributorCounts.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([contributorName]) => contributorName);

        // For now, we'll cache these contributor names directly
        // In a real implementation, you'd want to resolve these to actual usernames
        // This is a simplified version that works with the current system
        const contributorProfiles = topContributors.map(contributorName => ({
            username: contributorName,
            profile: null as UserProfile | null // Will be resolved on first access
        }));

        // Pre-cache these as null entries to avoid repeated database queries
        // They will be properly cached when first accessed
        contributorProfiles.forEach(({ username }) => {
            if (!usernameCache.get(username)) {
                // Don't overwrite existing cache entries
                usernameCache.set(username, null);
            }
        });

        console.log(`[CacheWarming] Pre-cached ${topContributors.length} popular contributor entries`);
    } catch (error) {
        console.error('[CacheWarming] Error warming popular contributors:', error);
    }
}

/**
 * Schedule periodic cache warming
 */
export function schedulePeriodicCacheWarming(intervalMinutes = 60): void {
    const intervalMs = intervalMinutes * 60 * 1000;

    // Initial warming
    warmUsernameCache();

    // Schedule periodic warming
    setInterval(() => {
        warmUsernameCache();
    }, intervalMs);

    console.log(`[CacheWarming] Scheduled periodic cache warming every ${intervalMinutes} minutes`);
}

/**
 * Get cache warming statistics
 */
export function getCacheWarmingStats(): {
    cacheStats: ReturnType<typeof usernameCache.getStats>;
    mostAccessed: ReturnType<typeof usernameCache.getMostAccessed>;
} {
    return {
        cacheStats: usernameCache.getStats(),
        mostAccessed: usernameCache.getMostAccessed(20)
    };
}