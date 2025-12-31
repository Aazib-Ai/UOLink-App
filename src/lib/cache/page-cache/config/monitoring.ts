/**
 * Monitoring and Health Check System for PWA Page Caching
 * Tracks performance metrics and triggers rollback on degradation
 * Requirements: 3.1, 3.2, 4.4
 */

import { CacheStats } from '../types';

/**
 * Health status of the cache system
 */
export enum HealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    CRITICAL = 'critical',
}

/**
 * Performance metric snapshot
 */
export interface PerformanceMetric {
    timestamp: number;
    hitRate: number;
    memoryUsageBytes: number;
    memoryUsagePercentage: number;
    evictionRate: number; // Evictions per minute
    backgroundRefreshSuccessRate: number;
    averageLoadTime: number; // ms
    quotaUsagePercentage: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
    status: HealthStatus;
    timestamp: number;
    issues: string[];
    metrics: PerformanceMetric;
    recommendations: string[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
    /** Minimum hit rate before alerting (0-1) */
    minHitRate: number;
    /** Maximum memory usage percentage before alerting */
    maxMemoryUsagePercentage: number;
    /** Maximum eviction rate (evictions/minute) */
    maxEvictionRate: number;
    /** Minimum background refresh success rate (0-1) */
    minRefreshSuccessRate: number;
    /** Maximum average load time (ms) */
    maxAverageLoadTime: number;
    /** Maximum quota usage percentage */
    maxQuotaUsagePercentage: number;
}

/**
 * Default alert configuration
 */
export const DEFAULT_ALERT_CONFIG: AlertConfig = {
    minHitRate: 0.3,
    maxMemoryUsagePercentage: 90,
    maxEvictionRate: 50,
    minRefreshSuccessRate: 0.7,
    maxAverageLoadTime: 500,
    maxQuotaUsagePercentage: 80,
};

/**
 * Rollback configuration
 */
export interface RollbackConfig {
    /** Enable automatic rollback */
    enabled: boolean;
    /** Number of consecutive degraded checks before rollback */
    degradedThreshold: number;
    /** What to do when rolling back */
    action: 'disable_feature' | 'clear_cache' | 'reset_config';
}

/**
 * Default rollback configuration
 */
export const DEFAULT_ROLLBACK_CONFIG: RollbackConfig = {
    enabled: true,
    degradedThreshold: 3,
    action: 'clear_cache',
};

/**
 * Monitoring event listener
 */
export type MonitoringEventListener = (event: MonitoringEvent) => void;

/**
 * Monitoring event
 */
export interface MonitoringEvent {
    type: 'metric' | 'health_check' | 'alert' | 'rollback';
    timestamp: number;
    data: any;
}

/**
 * Monitoring manager
 */
export class MonitoringManager {
    private metrics: PerformanceMetric[] = [];
    private readonly maxMetrics = 100; // Keep last 100 metrics
    private alertConfig: AlertConfig;
    private rollbackConfig: RollbackConfig;
    private listeners: MonitoringEventListener[] = [];
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private consecutiveDegradedChecks = 0;
    private lastRollbackTime = 0;
    private readonly ROLLBACK_COOLDOWN = 30 * 60 * 1000; // 30 minutes

    // Track metrics for calculations
    private loadTimes: number[] = [];
    private refreshSuccesses = 0;
    private refreshFailures = 0;
    private lastEvictionCount = 0;
    private lastEvictionTime = Date.now();

    constructor(
        alertConfig: AlertConfig = DEFAULT_ALERT_CONFIG,
        rollbackConfig: RollbackConfig = DEFAULT_ROLLBACK_CONFIG
    ) {
        this.alertConfig = alertConfig;
        this.rollbackConfig = rollbackConfig;
    }

    /**
     * Start monitoring with health checks at regular intervals
     */
    startMonitoring(intervalMs: number = 60000): void {
        if (this.healthCheckInterval) {
            return;
        }

        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Record a cache performance metric
     */
    recordMetric(stats: CacheStats, quotaUsage?: { usage: number; quota: number }): void {
        const metric: PerformanceMetric = {
            timestamp: Date.now(),
            hitRate: stats.hitRate,
            memoryUsageBytes: stats.memoryBytes,
            memoryUsagePercentage: this.calculateMemoryPercentage(stats.memoryBytes),
            evictionRate: this.calculateEvictionRate(stats.evictions),
            backgroundRefreshSuccessRate: this.calculateRefreshSuccessRate(),
            averageLoadTime: this.calculateAverageLoadTime(),
            quotaUsagePercentage: quotaUsage
                ? (quotaUsage.usage / quotaUsage.quota) * 100
                : 0,
        };

        this.metrics.push(metric);

        // Keep only recent metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics.shift();
        }

        this.emit({
            type: 'metric',
            timestamp: Date.now(),
            data: metric,
        });
    }

    /**
     * Record a page load time
     */
    recordLoadTime(timeMs: number): void {
        this.loadTimes.push(timeMs);

        // Keep only recent load times
        if (this.loadTimes.length > 50) {
            this.loadTimes.shift();
        }
    }

    /**
     * Record a background refresh result
     */
    recordRefreshResult(success: boolean): void {
        if (success) {
            this.refreshSuccesses++;
        } else {
            this.refreshFailures++;
        }
    }

    /**
     * Perform a health check
     */
    performHealthCheck(): HealthCheckResult {
        const latestMetric = this.getLatestMetric();
        if (!latestMetric) {
            return {
                status: HealthStatus.HEALTHY,
                timestamp: Date.now(),
                issues: [],
                metrics: this.createEmptyMetric(),
                recommendations: [],
            };
        }

        const issues: string[] = [];
        const recommendations: string[] = [];

        // Check hit rate
        if (latestMetric.hitRate < this.alertConfig.minHitRate) {
            issues.push(`Low cache hit rate: ${(latestMetric.hitRate * 100).toFixed(1)}%`);
            recommendations.push('Consider increasing cache size or TTL');
        }

        // Check memory usage
        if (latestMetric.memoryUsagePercentage > this.alertConfig.maxMemoryUsagePercentage) {
            issues.push(`High memory usage: ${latestMetric.memoryUsagePercentage.toFixed(1)}%`);
            recommendations.push('Reduce cache size limit or enable more aggressive eviction');
        }

        // Check eviction rate
        if (latestMetric.evictionRate > this.alertConfig.maxEvictionRate) {
            issues.push(`High eviction rate: ${latestMetric.evictionRate.toFixed(1)}/min`);
            recommendations.push('Increase cache size or reduce data being cached');
        }

        // Check background refresh success rate
        if (latestMetric.backgroundRefreshSuccessRate < this.alertConfig.minRefreshSuccessRate) {
            issues.push(`Low refresh success rate: ${(latestMetric.backgroundRefreshSuccessRate * 100).toFixed(1)}%`);
            recommendations.push('Check network connectivity or reduce refresh frequency');
        }

        // Check load time
        if (latestMetric.averageLoadTime > this.alertConfig.maxAverageLoadTime) {
            issues.push(`Slow average load time: ${latestMetric.averageLoadTime.toFixed(0)}ms`);
            recommendations.push('Optimize cache lookup or reduce cached data size');
        }

        // Check quota usage
        if (latestMetric.quotaUsagePercentage > this.alertConfig.maxQuotaUsagePercentage) {
            issues.push(`High quota usage: ${latestMetric.quotaUsagePercentage.toFixed(1)}%`);
            recommendations.push('Clear old cache entries or reduce cache limits');
        }

        // Determine status
        let status = HealthStatus.HEALTHY;
        if (issues.length > 0) {
            status = issues.length >= 3 ? HealthStatus.CRITICAL : HealthStatus.DEGRADED;
        }

        const result: HealthCheckResult = {
            status,
            timestamp: Date.now(),
            issues,
            metrics: latestMetric,
            recommendations,
        };

        this.emit({
            type: 'health_check',
            timestamp: Date.now(),
            data: result,
        });

        // Handle degraded status
        if (status === HealthStatus.DEGRADED || status === HealthStatus.CRITICAL) {
            this.consecutiveDegradedChecks++;

            // Emit alert
            this.emit({
                type: 'alert',
                timestamp: Date.now(),
                data: result,
            });

            // Check if rollback is needed
            if (this.shouldRollback()) {
                this.triggerRollback(result);
            }
        } else {
            this.consecutiveDegradedChecks = 0;
        }

        return result;
    }

    /**
     * Get latest metric
     */
    getLatestMetric(): PerformanceMetric | null {
        return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
    }

    /**
     * Get all metrics
     */
    getAllMetrics(): PerformanceMetric[] {
        return [...this.metrics];
    }

    /**
     * Get metrics for a time range
     */
    getMetricsInRange(startTime: number, endTime: number): PerformanceMetric[] {
        return this.metrics.filter(
            m => m.timestamp >= startTime && m.timestamp <= endTime
        );
    }

    /**
     * Add event listener
     */
    addEventListener(listener: MonitoringEventListener): () => void {
        this.listeners.push(listener);

        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Update alert configuration
     */
    updateAlertConfig(config: Partial<AlertConfig>): void {
        this.alertConfig = { ...this.alertConfig, ...config };
    }

    /**
     * Update rollback configuration
     */
    updateRollbackConfig(config: Partial<RollbackConfig>): void {
        this.rollbackConfig = { ...this.rollbackConfig, ...config };
    }

    /**
     * Clear all metrics
     */
    clearMetrics(): void {
        this.metrics = [];
        this.loadTimes = [];
        this.refreshSuccesses = 0;
        this.refreshFailures = 0;
        this.consecutiveDegradedChecks = 0;
    }

    private shouldRollback(): boolean {
        if (!this.rollbackConfig.enabled) {
            return false;
        }

        // Check cooldown
        if (Date.now() - this.lastRollbackTime < this.ROLLBACK_COOLDOWN) {
            return false;
        }

        return this.consecutiveDegradedChecks >= this.rollbackConfig.degradedThreshold;
    }

    private triggerRollback(healthCheck: HealthCheckResult): void {
        this.lastRollbackTime = Date.now();
        this.consecutiveDegradedChecks = 0;

        this.emit({
            type: 'rollback',
            timestamp: Date.now(),
            data: {
                action: this.rollbackConfig.action,
                reason: healthCheck.issues,
                healthCheck,
            },
        });
    }

    private calculateMemoryPercentage(memoryBytes: number): number {
        const maxMemory = 50 * 1024 * 1024; // 50MB default
        return (memoryBytes / maxMemory) * 100;
    }

    private calculateEvictionRate(currentEvictions: number): number {
        const now = Date.now();
        const timeDiffMinutes = (now - this.lastEvictionTime) / (60 * 1000);

        if (timeDiffMinutes === 0) {
            return 0;
        }

        const evictionsSinceLastCheck = currentEvictions - this.lastEvictionCount;
        const rate = evictionsSinceLastCheck / timeDiffMinutes;

        this.lastEvictionCount = currentEvictions;
        this.lastEvictionTime = now;

        return Math.max(0, rate);
    }

    private calculateRefreshSuccessRate(): number {
        const total = this.refreshSuccesses + this.refreshFailures;
        if (total === 0) {
            return 1.0;
        }
        return this.refreshSuccesses / total;
    }

    private calculateAverageLoadTime(): number {
        if (this.loadTimes.length === 0) {
            return 0;
        }
        const sum = this.loadTimes.reduce((a, b) => a + b, 0);
        return sum / this.loadTimes.length;
    }

    private createEmptyMetric(): PerformanceMetric {
        return {
            timestamp: Date.now(),
            hitRate: 0,
            memoryUsageBytes: 0,
            memoryUsagePercentage: 0,
            evictionRate: 0,
            backgroundRefreshSuccessRate: 1,
            averageLoadTime: 0,
            quotaUsagePercentage: 0,
        };
    }

    private emit(event: MonitoringEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in monitoring event listener:', error);
            }
        }
    }
}

/**
 * Global monitoring manager instance
 */
let globalMonitoringManager: MonitoringManager | null = null;

/**
 * Get the global monitoring manager
 */
export function getMonitoringManager(): MonitoringManager {
    if (!globalMonitoringManager) {
        globalMonitoringManager = new MonitoringManager();
    }
    return globalMonitoringManager;
}

/**
 * Set the global monitoring manager
 */
export function setMonitoringManager(manager: MonitoringManager): void {
    globalMonitoringManager = manager;
}
