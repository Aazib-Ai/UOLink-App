/**
 * Feature Flags System for PWA Page Caching
 * Supports gradual rollout, user targeting, and environment overrides
 * Requirements: 3.1, 3.2, 4.4
 */

/**
 * Available feature flags for cache system
 */
export enum FeatureFlag {
    /** Enable cache-first navigation */
    CACHE_FIRST_NAVIGATION = 'cache_first_navigation',
    /** Enable background refresh */
    BACKGROUND_REFRESH = 'background_refresh',
    /** Enable IndexedDB persistence */
    INDEXEDDB_PERSISTENCE = 'indexeddb_persistence',
    /** Enable advanced priority calculation */
    ADVANCED_PRIORITY = 'advanced_priority',
    /** Enable adaptive cache behavior */
    ADAPTIVE_CACHING = 'adaptive_caching',
    /** Enable cache warming */
    CACHE_WARMING = 'cache_warming',
    /** Enable UI state persistence */
    UI_STATE_PERSISTENCE = 'ui_state_persistence',
    /** Enable offline support */
    OFFLINE_SUPPORT = 'offline_support',
    /** Enable monitoring and metrics */
    MONITORING_ENABLED = 'monitoring_enabled',
    /** Enable automatic error recovery */
    AUTO_ERROR_RECOVERY = 'auto_error_recovery',
}

/**
 * Configuration for a single feature flag
 */
export interface FeatureFlagConfig {
    /** Flag identifier */
    flag: FeatureFlag;
    /** Enable flag by default */
    defaultEnabled: boolean;
    /** Percentage of users to enable for (0-100) */
    rolloutPercentage: number;
    /** Specific user IDs to enable for */
    targetUserIds?: string[];
    /** User groups to enable for */
    targetGroups?: string[];
    /** Environment override (dev/staging/production) */
    environmentOverrides?: {
        development?: boolean;
        staging?: boolean;
        production?: boolean;
    };
    /** Description of what this feature does */
    description: string;
}

/**
 * Context for evaluating feature flags
 */
export interface FeatureFlagContext {
    /** Current user ID */
    userId?: string;
    /** User groups the user belongs to */
    userGroups?: string[];
    /** Current environment */
    environment: 'development' | 'staging' | 'production';
    /** Session ID for consistent evaluation */
    sessionId?: string;
}

/**
 * Storage interface for feature flag overrides
 */
export interface FeatureFlagStorage {
    getOverride(flag: FeatureFlag): Promise<boolean | null>;
    setOverride(flag: FeatureFlag, enabled: boolean): Promise<void>;
    clearOverride(flag: FeatureFlag): Promise<void>;
    clearAllOverrides(): Promise<void>;
}

/**
 * LocalStorage implementation of feature flag storage
 */
export class LocalStorageFeatureFlagStorage implements FeatureFlagStorage {
    private prefix = 'uolink_feature_flag_';

    async getOverride(flag: FeatureFlag): Promise<boolean | null> {
        try {
            const value = localStorage.getItem(this.prefix + flag);
            return value === null ? null : value === 'true';
        } catch {
            return null;
        }
    }

    async setOverride(flag: FeatureFlag, enabled: boolean): Promise<void> {
        try {
            localStorage.setItem(this.prefix + flag, String(enabled));
        } catch (error) {
            console.warn('Failed to set feature flag override:', error);
        }
    }

    async clearOverride(flag: FeatureFlag): Promise<void> {
        try {
            localStorage.removeItem(this.prefix + flag);
        } catch (error) {
            console.warn('Failed to clear feature flag override:', error);
        }
    }

    async clearAllOverrides(): Promise<void> {
        try {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            }
        } catch (error) {
            console.warn('Failed to clear all feature flag overrides:', error);
        }
    }
}

/**
 * Default feature flag configurations
 */
export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
    [FeatureFlag.CACHE_FIRST_NAVIGATION]: {
        flag: FeatureFlag.CACHE_FIRST_NAVIGATION,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable cache-first navigation for instant page loads',
    },
    [FeatureFlag.BACKGROUND_REFRESH]: {
        flag: FeatureFlag.BACKGROUND_REFRESH,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable background refresh of stale cache data',
    },
    [FeatureFlag.INDEXEDDB_PERSISTENCE]: {
        flag: FeatureFlag.INDEXEDDB_PERSISTENCE,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable IndexedDB for persistent cache storage',
    },
    [FeatureFlag.ADVANCED_PRIORITY]: {
        flag: FeatureFlag.ADVANCED_PRIORITY,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable advanced priority calculation for cache entries',
    },
    [FeatureFlag.ADAPTIVE_CACHING]: {
        flag: FeatureFlag.ADAPTIVE_CACHING,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable adaptive cache behavior based on usage patterns',
    },
    [FeatureFlag.CACHE_WARMING]: {
        flag: FeatureFlag.CACHE_WARMING,
        defaultEnabled: false,
        rolloutPercentage: 0,
        description: 'Enable predictive cache warming for frequently accessed pages',
    },
    [FeatureFlag.UI_STATE_PERSISTENCE]: {
        flag: FeatureFlag.UI_STATE_PERSISTENCE,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable UI state persistence across navigation',
    },
    [FeatureFlag.OFFLINE_SUPPORT]: {
        flag: FeatureFlag.OFFLINE_SUPPORT,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable offline support with cached content',
    },
    [FeatureFlag.MONITORING_ENABLED]: {
        flag: FeatureFlag.MONITORING_ENABLED,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable monitoring and performance metrics collection',
    },
    [FeatureFlag.AUTO_ERROR_RECOVERY]: {
        flag: FeatureFlag.AUTO_ERROR_RECOVERY,
        defaultEnabled: true,
        rolloutPercentage: 100,
        description: 'Enable automatic error recovery and rollback',
    },
};

/**
 * Feature flag evaluator with rollout support
 */
export class FeatureFlagEvaluator {
    private config: Record<FeatureFlag, FeatureFlagConfig>;
    private storage: FeatureFlagStorage;
    private evaluationCache = new Map<string, boolean>();
    private cacheExpiry = new Map<string, number>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(
        config: Record<FeatureFlag, FeatureFlagConfig> = DEFAULT_FEATURE_FLAGS,
        storage: FeatureFlagStorage = new LocalStorageFeatureFlagStorage()
    ) {
        this.config = config;
        this.storage = storage;
    }

    /**
     * Evaluate if a feature flag is enabled for the given context
     */
    async isEnabled(flag: FeatureFlag, context: FeatureFlagContext): Promise<boolean> {
        const cacheKey = this.getCacheKey(flag, context);

        // Check cache first
        const cached = this.getCachedEvaluation(cacheKey);
        if (cached !== null) {
            return cached;
        }

        // Check for manual override
        const override = await this.storage.getOverride(flag);
        if (override !== null) {
            this.setCachedEvaluation(cacheKey, override);
            return override;
        }

        const flagConfig = this.config[flag];

        // Check environment override
        const envOverride = this.getEnvironmentOverride(flagConfig, context.environment);
        if (envOverride !== null) {
            this.setCachedEvaluation(cacheKey, envOverride);
            return envOverride;
        }

        // Check user targeting
        if (this.isUserTargeted(flagConfig, context)) {
            this.setCachedEvaluation(cacheKey, true);
            return true;
        }

        // Check percentage rollout
        const enabled = this.evaluatePercentageRollout(flagConfig, context);
        this.setCachedEvaluation(cacheKey, enabled);
        return enabled;
    }

    /**
     * Synchronous version of isEnabled (uses cache only)
     */
    isEnabledSync(flag: FeatureFlag, context: FeatureFlagContext): boolean {
        const cacheKey = this.getCacheKey(flag, context);
        const cached = this.getCachedEvaluation(cacheKey);

        // If not in cache, return default enabled value
        return cached !== null ? cached : this.config[flag].defaultEnabled;
    }

    /**
     * Set a manual override for a feature flag
     */
    async setOverride(flag: FeatureFlag, enabled: boolean): Promise<void> {
        await this.storage.setOverride(flag, enabled);
        this.clearEvaluationCache();
    }

    /**
     * Clear a manual override for a feature flag
     */
    async clearOverride(flag: FeatureFlag): Promise<void> {
        await this.storage.clearOverride(flag);
        this.clearEvaluationCache();
    }

    /**
     * Clear all manual overrides
     */
    async clearAllOverrides(): Promise<void> {
        await this.storage.clearAllOverrides();
        this.clearEvaluationCache();
    }

    /**
     * Update feature flag configuration
     */
    updateConfig(config: Partial<Record<FeatureFlag, FeatureFlagConfig>>): void {
        this.config = { ...this.config, ...config };
        this.clearEvaluationCache();
    }

    /**
     * Get current feature flag configuration
     */
    getConfig(flag: FeatureFlag): FeatureFlagConfig {
        return this.config[flag];
    }

    /**
     * Get all feature flag configurations
     */
    getAllConfigs(): Record<FeatureFlag, FeatureFlagConfig> {
        return { ...this.config };
    }

    private getEnvironmentOverride(
        config: FeatureFlagConfig,
        environment: string
    ): boolean | null {
        if (!config.environmentOverrides) {
            return null;
        }

        const override = config.environmentOverrides[environment as keyof typeof config.environmentOverrides];
        return override !== undefined ? override : null;
    }

    private isUserTargeted(config: FeatureFlagConfig, context: FeatureFlagContext): boolean {
        // Check user ID targeting
        if (config.targetUserIds && context.userId) {
            if (config.targetUserIds.includes(context.userId)) {
                return true;
            }
        }

        // Check group targeting
        if (config.targetGroups && context.userGroups) {
            for (const group of context.userGroups) {
                if (config.targetGroups.includes(group)) {
                    return true;
                }
            }
        }

        return false;
    }

    private evaluatePercentageRollout(
        config: FeatureFlagConfig,
        context: FeatureFlagContext
    ): boolean {
        // If no percentage set or 100%, enable for everyone
        if (config.rolloutPercentage >= 100) {
            return true;
        }

        // If 0%, disable for everyone
        if (config.rolloutPercentage <= 0) {
            return false;
        }

        // Use consistent hashing based on user ID or session ID
        const identifier = context.userId || context.sessionId || 'anonymous';
        const hash = this.hashString(config.flag + identifier);
        const bucket = hash % 100;

        return bucket < config.rolloutPercentage;
    }

    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    private getCacheKey(flag: FeatureFlag, context: FeatureFlagContext): string {
        const id = context.userId || context.sessionId || 'anonymous';
        return `${flag}:${id}:${context.environment}`;
    }

    private getCachedEvaluation(key: string): boolean | null {
        const expiry = this.cacheExpiry.get(key);
        if (expiry && expiry > Date.now()) {
            return this.evaluationCache.get(key) ?? null;
        }
        return null;
    }

    private setCachedEvaluation(key: string, value: boolean): void {
        this.evaluationCache.set(key, value);
        this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
    }

    private clearEvaluationCache(): void {
        this.evaluationCache.clear();
        this.cacheExpiry.clear();
    }
}

/**
 * Global feature flag evaluator instance
 */
let globalEvaluator: FeatureFlagEvaluator | null = null;

/**
 * Get the global feature flag evaluator
 */
export function getFeatureFlagEvaluator(): FeatureFlagEvaluator {
    if (!globalEvaluator) {
        globalEvaluator = new FeatureFlagEvaluator();
    }
    return globalEvaluator;
}

/**
 * Set the global feature flag evaluator
 */
export function setFeatureFlagEvaluator(evaluator: FeatureFlagEvaluator): void {
    globalEvaluator = evaluator;
}
