/**
 * Feature flags for personalized feed rollout
 * This allows gradual rollout and A/B testing
 */

export interface PersonalizedFeedConfig {
    enabled: boolean;
    rolloutPercentage: number; // 0-100
    requireCompleteProfile: boolean;
    fallbackToGeneral: boolean;
    debugMode: boolean;
}

// Default configuration
const DEFAULT_CONFIG: PersonalizedFeedConfig = {
    enabled: true,
    rolloutPercentage: 100, // Start with 100% for testing, reduce for gradual rollout
    requireCompleteProfile: false, // Set to true to require complete profiles
    fallbackToGeneral: true,
    debugMode: process.env.NODE_ENV === 'development'
};

// Get config from environment or use defaults
export const getPersonalizedFeedConfig = (): PersonalizedFeedConfig => {
    return {
        enabled: process.env.NEXT_PUBLIC_PERSONALIZED_FEED_ENABLED === 'true',
        rolloutPercentage: parseInt(process.env.NEXT_PUBLIC_PERSONALIZED_FEED_ROLLOUT ?? '100'),
        requireCompleteProfile: process.env.NEXT_PUBLIC_REQUIRE_COMPLETE_PROFILE === 'true',
        fallbackToGeneral: process.env.NEXT_PUBLIC_FALLBACK_TO_GENERAL !== 'false',
        debugMode: process.env.NODE_ENV === 'development'
    };
};

// Check if user should get personalized feed
export const shouldShowPersonalizedFeed = (userId: string): boolean => {
    const config = getPersonalizedFeedConfig();

    if (!config.enabled) {
        return false;
    }

    // Simple hash-based rollout (consistent per user)
    const hash = hashString(userId);
    const userPercentile = hash % 100;

    return userPercentile < config.rolloutPercentage;
};

// Simple string hash function for consistent user bucketing
function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// Check if user profile is complete enough for personalization
export const isProfileCompleteForPersonalization = (profile: any): boolean => {
    const config = getPersonalizedFeedConfig();

    if (!config.requireCompleteProfile) {
        return true; // Don't require complete profile
    }

    // Define what constitutes a "complete enough" profile
    const hasBasicInfo = !!(
        profile?.major &&
        profile?.semester
    );

    const hasAdditionalInfo = !!(
        profile?.section ||
        profile?.fullName
    );

    return hasBasicInfo && hasAdditionalInfo;
};

// Analytics helper for tracking personalization effectiveness
export const trackPersonalizationEvent = (event: string, data: any = {}) => {
    const config = getPersonalizedFeedConfig();

    if (config.debugMode) {
        console.log(`[Personalization] ${event}:`, data);
    }

    // Here you would integrate with your analytics service
    // Example: analytics.track(event, { ...data, feature: 'personalized_feed' });
};

// Environment variables to add to your .env.local:
/*
NEXT_PUBLIC_PERSONALIZED_FEED_ENABLED=true
NEXT_PUBLIC_PERSONALIZED_FEED_ROLLOUT=100
NEXT_PUBLIC_REQUIRE_COMPLETE_PROFILE=false
NEXT_PUBLIC_FALLBACK_TO_GENERAL=true
*/