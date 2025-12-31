/**
 * Configuration Manager for PWA Page Caching
 * Centralizes configuration from multiple sources with priority merging
 * Requirements: 3.1, 3.2, 4.4
 */

import { CacheConfig, DEFAULT_CACHE_CONFIG } from '../types';
import { FeatureFlag, FeatureFlagContext, FeatureFlagEvaluator, getFeatureFlagEvaluator } from './feature-flags';
import { UserPreferencesManager, getUserPreferencesManager } from './user-preferences';
import { MonitoringManager, getMonitoringManager } from './monitoring';

/**
 * Configuration source priority
 */
export enum ConfigSource {
    DEFAULT = 'default',
    ENVIRONMENT = 'environment',
    USER_PREFERENCE = 'user_preference',
    RUNTIME_OVERRIDE = 'runtime_override',
}

/**
 * Extended cache configuration with config system metadata
 */
export interface ExtendedCacheConfig extends CacheConfig {
    /** Feature flag context for evaluation */
    featureFlagContext?: FeatureFlagContext;
    /** Enable hot-reload of configuration */
    hotReloadEnabled?: boolean;
    /** Configuration source tracking */
    source?: ConfigSource;
}

/**
 * Configuration change event
 */
export interface ConfigChangeEvent {
    oldConfig: ExtendedCacheConfig;
    newConfig: ExtendedCacheConfig;
    changedKeys: string[];
    source: ConfigSource;
    timestamp: number;
}

/**
 * Configuration listener
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void;

/**
 * Configuration manager
 */
export class ConfigurationManager {
    private config: ExtendedCacheConfig;
    private featureFlagEvaluator: FeatureFlagEvaluator;
    private preferencesManager: UserPreferencesManager;
    private monitoringManager: MonitoringManager;
    private listeners: ConfigChangeListener[] = [];
    private hotReloadEnabled = true;
    private initialized = false;

    constructor(
        featureFlagEvaluator?: FeatureFlagEvaluator,
        preferencesManager?: UserPreferencesManager,
        monitoringManager?: MonitoringManager
    ) {
        this.config = { ...DEFAULT_CACHE_CONFIG };
        this.featureFlagEvaluator = featureFlagEvaluator || getFeatureFlagEvaluator();
        this.preferencesManager = preferencesManager || getUserPreferencesManager();
        this.monitoringManager = monitoringManager || getMonitoringManager();
    }

    /**
     * Initialize configuration from all sources
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        // Load user preferences
        await this.preferencesManager.initialize();

        // Merge configurations
        await this.reloadConfig();

        // Listen to preference changes
        this.preferencesManager.addListener(() => {
            if (this.hotReloadEnabled) {
                this.reloadConfig();
            }
        });

        this.initialized = true;
    }

    /**
     * Get current configuration
     */
    getConfig(): ExtendedCacheConfig {
        return { ...this.config };
    }

    /**
     * Get a specific configuration value
     */
    getConfigValue<K extends keyof ExtendedCacheConfig>(key: K): ExtendedCacheConfig[K] {
        return this.config[key];
    }

    /**
     * Set a runtime override for configuration
     */
    async setConfigOverride(overrides: Partial<ExtendedCacheConfig>): Promise<void> {
        const oldConfig = { ...this.config };
        const newConfig = this.mergeConfigs(this.config, overrides, ConfigSource.RUNTIME_OVERRIDE);

        this.config = this.validateConfig(newConfig);

        this.notifyListeners(oldConfig, this.config, ConfigSource.RUNTIME_OVERRIDE);
    }

    /**
     * Reload configuration from all sources
     */
    async reloadConfig(): Promise<void> {
        const oldConfig = { ...this.config };

        // Start with defaults
        let merged = { ...DEFAULT_CACHE_CONFIG };

        // Merge environment config
        const envConfig = this.getEnvironmentConfig();
        merged = this.mergeConfigs(merged, envConfig, ConfigSource.ENVIRONMENT);

        // Merge user preferences
        const userConfig = this.preferencesManager.toCacheConfig();
        merged = this.mergeConfigs(merged, userConfig, ConfigSource.USER_PREFERENCE);

        // Validate final config
        this.config = this.validateConfig(merged);

        this.notifyListeners(oldConfig, this.config, ConfigSource.USER_PREFERENCE);
    }

    /**
     * Check if a feature is enabled
     */
    async isFeatureEnabled(flag: FeatureFlag, context?: FeatureFlagContext): Promise<boolean> {
        const evalContext = context || this.getDefaultFeatureFlagContext();
        return this.featureFlagEvaluator.isEnabled(flag, evalContext);
    }

    /**
     * Synchronous feature check (uses cache)
     */
    isFeatureEnabledSync(flag: FeatureFlag, context?: FeatureFlagContext): boolean {
        const evalContext = context || this.getDefaultFeatureFlagContext();
        return this.featureFlagEvaluator.isEnabledSync(flag, evalContext);
    }

    /**
     * Get feature flag evaluator
     */
    getFeatureFlagEvaluator(): FeatureFlagEvaluator {
        return this.featureFlagEvaluator;
    }

    /**
     * Get preferences manager
     */
    getPreferencesManager(): UserPreferencesManager {
        return this.preferencesManager;
    }

    /**
     * Get monitoring manager
     */
    getMonitoringManager(): MonitoringManager {
        return this.monitoringManager;
    }

    /**
     * Enable or disable hot-reload
     */
    setHotReload(enabled: boolean): void {
        this.hotReloadEnabled = enabled;
    }

    /**
     * Add configuration change listener
     */
    addListener(listener: ConfigChangeListener): () => void {
        this.listeners.push(listener);

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Validate configuration values
     */
    private validateConfig(config: ExtendedCacheConfig): ExtendedCacheConfig {
        const validated = { ...config };

        // Ensure positive values
        validated.maxMemoryBytes = Math.max(1024 * 1024, validated.maxMemoryBytes); // Min 1MB
        validated.maxIndexedDBBytes = Math.max(1024 * 1024, validated.maxIndexedDBBytes); // Min 1MB
        validated.defaultTTL = Math.max(1000, validated.defaultTTL); // Min 1 second
        validated.staleTTL = Math.max(validated.defaultTTL, validated.staleTTL); // staleTTL >= defaultTTL

        // Ensure weights sum to reasonable values
        if (validated.priorityWeights) {
            const totalWeight = validated.priorityWeights.frequency + validated.priorityWeights.recency;
            if (totalWeight <= 0 || totalWeight > 2) {
                // Reset to defaults if invalid
                validated.priorityWeights = DEFAULT_CACHE_CONFIG.priorityWeights;
            }
        }

        // Validate thresholds
        if (validated.minHitRateForAdaptation !== undefined) {
            validated.minHitRateForAdaptation = Math.max(0, Math.min(1, validated.minHitRateForAdaptation));
        }

        if (validated.thrashingThreshold !== undefined) {
            validated.thrashingThreshold = Math.max(0, validated.thrashingThreshold);
        }

        return validated;
    }

    /**
     * Merge configurations with source priority
     */
    private mergeConfigs(
        base: Partial<ExtendedCacheConfig>,
        override: Partial<ExtendedCacheConfig>,
        source: ConfigSource
    ): ExtendedCacheConfig {
        const merged = { ...base, ...override };
        merged.source = source;
        return merged as ExtendedCacheConfig;
    }

    /**
     * Get environment-specific configuration
     */
    private getEnvironmentConfig(): Partial<ExtendedCacheConfig> {
        const env = this.getEnvironment();

        // Environment-specific overrides
        const envConfigs: Record<string, Partial<ExtendedCacheConfig>> = {
            development: {
                // More aggressive caching in dev
                defaultTTL: 10 * 60 * 1000, // 10 minutes
                staleTTL: 60 * 60 * 1000, // 1 hour
            },
            staging: {
                // Moderate caching in staging
                defaultTTL: 5 * 60 * 1000, // 5 minutes
                staleTTL: 30 * 60 * 1000, // 30 minutes
            },
            production: {
                // Use defaults in production
            },
        };

        return envConfigs[env] || {};
    }

    /**
     * Get current environment
     */
    private getEnvironment(): 'development' | 'staging' | 'production' {
        if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
            const nodeEnv = process.env.NODE_ENV.toLowerCase();
            if (nodeEnv === 'development') return 'development';
            if (nodeEnv === 'staging') return 'staging';
        }
        return 'production';
    }

    /**
     * Get default feature flag context
     */
    private getDefaultFeatureFlagContext(): FeatureFlagContext {
        return this.config.featureFlagContext || {
            environment: this.getEnvironment(),
        };
    }

    /**
     * Notify listeners of configuration changes
     */
    private notifyListeners(
        oldConfig: ExtendedCacheConfig,
        newConfig: ExtendedCacheConfig,
        source: ConfigSource
    ): void {
        const changedKeys = this.getChangedKeys(oldConfig, newConfig);

        if (changedKeys.length === 0) {
            return;
        }

        const event: ConfigChangeEvent = {
            oldConfig,
            newConfig,
            changedKeys,
            source,
            timestamp: Date.now(),
        };

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in configuration change listener:', error);
            }
        }
    }

    /**
     * Get list of changed configuration keys
     */
    private getChangedKeys(
        oldConfig: ExtendedCacheConfig,
        newConfig: ExtendedCacheConfig
    ): string[] {
        const changed: string[] = [];
        const allKeys = new Set([
            ...Object.keys(oldConfig),
            ...Object.keys(newConfig),
        ]);

        for (const key of allKeys) {
            const oldValue = oldConfig[key as keyof ExtendedCacheConfig];
            const newValue = newConfig[key as keyof ExtendedCacheConfig];

            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                changed.push(key);
            }
        }

        return changed;
    }
}

/**
 * Global configuration manager instance
 */
let globalConfigurationManager: ConfigurationManager | null = null;

/**
 * Get the global configuration manager
 */
export function getConfigurationManager(): ConfigurationManager {
    if (!globalConfigurationManager) {
        globalConfigurationManager = new ConfigurationManager();
    }
    return globalConfigurationManager;
}

/**
 * Set the global configuration manager
 */
export function setConfigurationManager(manager: ConfigurationManager): void {
    globalConfigurationManager = manager;
}

/**
 * Initialize the global configuration manager
 */
export async function initializeConfiguration(): Promise<void> {
    const manager = getConfigurationManager();
    await manager.initialize();
}
