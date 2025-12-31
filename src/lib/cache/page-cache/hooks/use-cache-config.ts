/**
 * React Hooks for Cache Configuration
 * Provides easy access to configuration, preferences, and feature flags in React components
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    getConfigurationManager,
    ConfigurationManager,
    ExtendedCacheConfig,
    FeatureFlag,
    FeatureFlagContext,
    UserCachePreferences,
    UserPreferencesManager,
    MonitoringManager,
    HealthCheckResult,
    PerformanceMetric,
} from '../config';
import { CacheStats } from '../types';

/**
 * Hook to access cache configuration
 */
export function useCacheConfig(): {
    config: ExtendedCacheConfig;
    manager: ConfigurationManager;
    reload: () => Promise<void>;
} {
    const [config, setConfig] = useState<ExtendedCacheConfig>(() => {
        const manager = getConfigurationManager();
        return manager.getConfig();
    });

    const manager = useMemo(() => getConfigurationManager(), []);

    useEffect(() => {
        const unsubscribe = manager.addListener((event) => {
            setConfig(event.newConfig);
        });

        return unsubscribe;
    }, [manager]);

    const reload = useCallback(async () => {
        await manager.reloadConfig();
    }, [manager]);

    return { config, manager, reload };
}

/**
 * Hook to check if a feature flag is enabled
 */
export function useFeatureFlag(
    flag: FeatureFlag,
    context?: FeatureFlagContext
): {
    enabled: boolean;
    loading: boolean;
    reload: () => Promise<void>;
} {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const manager = useMemo(() => getConfigurationManager(), []);

    const checkFlag = useCallback(async () => {
        setLoading(true);
        const isEnabled = await manager.isFeatureEnabled(flag, context);
        setEnabled(isEnabled);
        setLoading(false);
    }, [manager, flag, context]);

    useEffect(() => {
        checkFlag();
    }, [checkFlag]);

    return { enabled, loading, reload: checkFlag };
}

/**
 * Hook to access and update user preferences
 */
export function useUserPreferences(): {
    preferences: UserCachePreferences;
    manager: UserPreferencesManager;
    updatePreferences: (updates: Partial<UserCachePreferences>) => Promise<void>;
    resetToDefaults: () => Promise<void>;
    exportPreferences: () => string;
    importPreferences: (json: string) => Promise<void>;
} {
    const configManager = useMemo(() => getConfigurationManager(), []);
    const manager = useMemo(() => configManager.getPreferencesManager(), [configManager]);

    const [preferences, setPreferences] = useState<UserCachePreferences>(() => {
        return manager.getPreferences();
    });

    useEffect(() => {
        const unsubscribe = manager.addListener((prefs) => {
            setPreferences(prefs);
        });

        return unsubscribe;
    }, [manager]);

    const updatePreferences = useCallback(
        async (updates: Partial<UserCachePreferences>) => {
            await manager.updatePreferences(updates);
        },
        [manager]
    );

    const resetToDefaults = useCallback(async () => {
        await manager.resetToDefaults();
    }, [manager]);

    const exportPreferences = useCallback(() => {
        return manager.exportPreferences();
    }, [manager]);

    const importPreferences = useCallback(
        async (json: string) => {
            await manager.importPreferences(json);
        },
        [manager]
    );

    return {
        preferences,
        manager,
        updatePreferences,
        resetToDefaults,
        exportPreferences,
        importPreferences,
    };
}

/**
 * Hook to access cache statistics and monitoring
 */
export function useCacheStats(stats?: CacheStats): {
    latestMetric: PerformanceMetric | null;
    healthCheck: HealthCheckResult | null;
    manager: MonitoringManager;
    performHealthCheck: () => HealthCheckResult;
} {
    const configManager = useMemo(() => getConfigurationManager(), []);
    const manager = useMemo(() => configManager.getMonitoringManager(), [configManager]);

    const [latestMetric, setLatestMetric] = useState<PerformanceMetric | null>(() => {
        return manager.getLatestMetric();
    });

    const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);

    useEffect(() => {
        const unsubscribe = manager.addEventListener((event) => {
            if (event.type === 'metric') {
                setLatestMetric(event.data);
            } else if (event.type === 'health_check') {
                setHealthCheck(event.data);
            }
        });

        return unsubscribe;
    }, [manager]);

    // Record stats whenever they change
    useEffect(() => {
        if (stats) {
            manager.recordMetric(stats);
        }
    }, [stats, manager]);

    const performHealthCheck = useCallback(() => {
        const result = manager.performHealthCheck();
        setHealthCheck(result);
        return result;
    }, [manager]);

    return {
        latestMetric,
        healthCheck,
        manager,
        performHealthCheck,
    };
}

/**
 * Hook to get a specific configuration value with type safety
 */
export function useConfigValue<K extends keyof ExtendedCacheConfig>(
    key: K
): ExtendedCacheConfig[K] {
    const { config } = useCacheConfig();
    return config[key];
}

/**
 * Hook to toggle a feature flag override (for testing/development)
 */
export function useFeatureFlagOverride(
    flag: FeatureFlag
): {
    override: boolean | null;
    setOverride: (enabled: boolean) => Promise<void>;
    clearOverride: () => Promise<void>;
} {
    const manager = useMemo(() => getConfigurationManager(), []);
    const evaluator = useMemo(() => manager.getFeatureFlagEvaluator(), [manager]);
    const [override, setOverrideState] = useState<boolean | null>(null);

    useEffect(() => {
        const storage = (evaluator as any).storage;
        storage.getOverride(flag).then((value: boolean | null) => {
            setOverrideState(value);
        });
    }, [evaluator, flag]);

    const setOverride = useCallback(
        async (enabled: boolean) => {
            await evaluator.setOverride(flag, enabled);
            setOverrideState(enabled);
        },
        [evaluator, flag]
    );

    const clearOverride = useCallback(async () => {
        await evaluator.clearOverride(flag);
        setOverrideState(null);
    }, [evaluator, flag]);

    return { override, setOverride, clearOverride };
}
