/**
 * BackgroundRefreshManager - Manages background refresh scheduling and execution
 * Implements Requirements 4.1, 4.2, 4.4, 4.5
 * - Background refresh scheduling and execution
 * - Exponential backoff retry logic for failed refreshes
 * - Seamless cache update mechanism
 * - User interaction detection to defer updates
 */

import { CacheManager, PageType, ContentType } from './cache-manager';
import { StateManager } from './state-manager';

/**
 * Callback function for fetching fresh data
 */
export type RefreshCallback = () => Promise<any>;

/**
 * Callback function for notifying UI of updates
 */
export type UpdateCallback = (data: any) => void;

/**
 * Refresh task tracking
 */
interface RefreshTask {
    route: string;
    callback: RefreshCallback;
    updateCallback?: UpdateCallback;
    pageType: PageType;
    contentType: ContentType;
    retryCount: number;
    scheduledTime: number;
    timeoutId?: NodeJS.Timeout;
    isExecuting: boolean;
}

/**
 * Configuration for BackgroundRefreshManager
 */
export interface BackgroundRefreshConfig {
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Initial retry delay in ms */
    initialRetryDelay?: number;
    /** Maximum retry delay in ms */
    maxRetryDelay?: number;
    /** Delay before executing refresh when user is interacting (ms) */
    interactionDeferDelay?: number;
    /** Enable automatic refresh scheduling */
    enableAutoRefresh?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<BackgroundRefreshConfig> = {
    maxRetries: 3,
    initialRetryDelay: 1000, // 1 second
    maxRetryDelay: 30000, // 30 seconds
    interactionDeferDelay: 2000, // 2 seconds
    enableAutoRefresh: true,
};

/**
 * BackgroundRefreshManager handles background refresh scheduling with retry logic
 * and user interaction detection
 */
export class BackgroundRefreshManager {
    private cacheManager: CacheManager;
    private stateManager: StateManager;
    private config: Required<BackgroundRefreshConfig>;
    private refreshTasks: Map<string, RefreshTask> = new Map();
    private isUserInteracting: boolean = false;
    private interactionDeferTimeout?: NodeJS.Timeout;
    private deferredRefreshes: Set<string> = new Set();

    constructor(
        cacheManager: CacheManager,
        stateManager: StateManager,
        config: BackgroundRefreshConfig = {}
    ) {
        this.cacheManager = cacheManager;
        this.stateManager = stateManager;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Schedule a background refresh for a route
     * Requirement 4.1 - Background refresh initiation
     */
    scheduleRefresh(
        route: string,
        callback: RefreshCallback,
        pageType: PageType = PageType.OTHER,
        contentType: ContentType = ContentType.GENERIC,
        updateCallback?: UpdateCallback
    ): void {
        if (!this.config.enableAutoRefresh) {
            return;
        }

        // Cancel existing refresh for this route
        this.cancelRefresh(route);

        const task: RefreshTask = {
            route,
            callback,
            updateCallback,
            pageType,
            contentType,
            retryCount: 0,
            scheduledTime: Date.now(),
            isExecuting: false,
        };

        this.refreshTasks.set(route, task);

        // Execute refresh immediately or defer if user is interacting
        if (this.isUserInteracting) {
            this.deferredRefreshes.add(route);
        } else {
            this.executeRefreshTask(route);
        }
    }

    /**
     * Cancel a scheduled refresh
     */
    cancelRefresh(route: string): void {
        const task = this.refreshTasks.get(route);
        if (task?.timeoutId) {
            clearTimeout(task.timeoutId);
        }
        this.refreshTasks.delete(route);
        this.deferredRefreshes.delete(route);
    }

    /**
     * Set user interaction state
     * Requirement 4.5 - Deferred updates during interaction
     */
    setUserInteracting(interacting: boolean): void {
        this.isUserInteracting = interacting;

        if (this.interactionDeferTimeout) {
            clearTimeout(this.interactionDeferTimeout);
            this.interactionDeferTimeout = undefined;
        }

        if (!interacting && this.deferredRefreshes.size > 0) {
            // User stopped interacting, execute deferred refreshes after a delay
            this.interactionDeferTimeout = setTimeout(() => {
                this.executeDeferredRefreshes();
            }, this.config.interactionDeferDelay);
        }
    }

    /**
     * Execute all deferred refreshes
     * Requirement 4.5 - Deferred updates during interaction
     */
    private executeDeferredRefreshes(): void {
        const routes = Array.from(this.deferredRefreshes);
        this.deferredRefreshes.clear();

        for (const route of routes) {
            this.executeRefreshTask(route);
        }
    }

    /**
     * Execute a refresh task with retry logic
     * Requirement 4.1 - Background refresh execution
     * Requirement 4.4 - Retry with exponential backoff
     */
    private async executeRefreshTask(route: string): Promise<void> {
        const task = this.refreshTasks.get(route);
        if (!task || task.isExecuting) {
            return;
        }

        task.isExecuting = true;

        try {
            // Fetch fresh data
            const freshData = await task.callback();

            // Update cache seamlessly
            // Requirement 4.2 - Seamless cache updates
            await this.updateCacheSeamlessly(route, freshData, task);

            // Notify UI if callback provided
            if (task.updateCallback) {
                task.updateCallback(freshData);
            }

            // Success - remove task
            this.refreshTasks.delete(route);
        } catch (error) {
            // Handle failure with exponential backoff
            // Requirement 4.4 - Retry with exponential backoff
            await this.handleRefreshFailure(route, task, error);
        } finally {
            task.isExecuting = false;
        }
    }

    /**
     * Update cache seamlessly without disrupting UI
     * Requirement 4.2 - Seamless cache updates
     */
    private async updateCacheSeamlessly(
        route: string,
        data: any,
        task: RefreshTask
    ): Promise<void> {
        // Capture current state before update
        const currentState = this.stateManager.captureState(route);

        // Update cache with new data
        const cacheKey = this.getCacheKey(route);
        await this.cacheManager.set(
            cacheKey,
            data,
            {
                pageType: task.pageType,
                contentType: task.contentType,
                route,
                pageState: currentState,
            }
        );
    }

    /**
     * Handle refresh failure with exponential backoff retry
     * Requirement 4.4 - Retry with exponential backoff
     */
    private async handleRefreshFailure(
        route: string,
        task: RefreshTask,
        error: any
    ): Promise<void> {
        task.retryCount++;

        if (task.retryCount >= this.config.maxRetries) {
            // Max retries reached, give up
            console.error(
                `Background refresh failed for ${route} after ${task.retryCount} attempts:`,
                error
            );
            this.refreshTasks.delete(route);
            return;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
            this.config.initialRetryDelay * Math.pow(2, task.retryCount - 1),
            this.config.maxRetryDelay
        );

        console.warn(
            `Background refresh failed for ${route}, retrying in ${delay}ms (attempt ${task.retryCount}/${this.config.maxRetries})`
        );

        // Schedule retry
        task.timeoutId = setTimeout(() => {
            this.executeRefreshTask(route);
        }, delay);
    }

    /**
     * Get cache key for a route
     */
    private getCacheKey(route: string): string {
        return `page:${route}`;
    }

    /**
     * Check if a refresh is scheduled for a route
     */
    isRefreshScheduled(route: string): boolean {
        return this.refreshTasks.has(route);
    }

    /**
     * Check if a refresh is currently executing for a route
     */
    isRefreshExecuting(route: string): boolean {
        return this.refreshTasks.get(route)?.isExecuting ?? false;
    }

    /**
     * Get retry count for a route
     */
    getRetryCount(route: string): number {
        return this.refreshTasks.get(route)?.retryCount ?? 0;
    }

    /**
     * Check if user is currently interacting
     */
    isUserCurrentlyInteracting(): boolean {
        return this.isUserInteracting;
    }

    /**
     * Get deferred refresh routes
     */
    getDeferredRefreshes(): string[] {
        return Array.from(this.deferredRefreshes);
    }

    /**
     * Clear all scheduled refreshes
     */
    clear(): void {
        // Clear all timeouts
        for (const task of this.refreshTasks.values()) {
            if (task.timeoutId) {
                clearTimeout(task.timeoutId);
            }
        }

        if (this.interactionDeferTimeout) {
            clearTimeout(this.interactionDeferTimeout);
        }

        this.refreshTasks.clear();
        this.deferredRefreshes.clear();
        this.isUserInteracting = false;
    }

    /**
     * Get statistics for monitoring
     */
    getStats() {
        return {
            scheduledRefreshes: this.refreshTasks.size,
            deferredRefreshes: this.deferredRefreshes.size,
            executingRefreshes: Array.from(this.refreshTasks.values()).filter(
                t => t.isExecuting
            ).length,
            isUserInteracting: this.isUserInteracting,
        };
    }
}
