/**
 * Property Tests for Feature Flags
 * Tests: Feature flag evaluation consistency and percentage rollout
 * Feature: pwa-page-caching
 */

import fc from 'fast-check';
import {
    FeatureFlagEvaluator,
    FeatureFlag,
    FeatureFlagContext,
    FeatureFlagConfig,
    LocalStorageFeatureFlagStorage,
} from '../feature-flags';

describe('Feature Flags - Property Tests', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });

    /**
     * Property 1: Feature flag evaluation is consistent for the same user
     * For any feature flag and user context, evaluating the flag multiple times
     * should return the same result
     */
    it('Feature: pwa-page-caching, Property 1: Feature flag evaluation is consistent for the same user', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...Object.values(FeatureFlag)),
                fc.record({
                    userId: fc.option(fc.uuid(), { nil: undefined }),
                    userGroups: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 5 }), { nil: undefined }),
                    environment: fc.constantFrom('development', 'staging', 'production') as fc.Arbitrary<'development' | 'staging' | 'production'>,
                    sessionId: fc.option(fc.uuid(), { nil: undefined }),
                }),
                async (flag, context) => {
                    const evaluator = new FeatureFlagEvaluator();

                    const result1 = await evaluator.isEnabled(flag, context as FeatureFlagContext);
                    const result2 = await evaluator.isEnabled(flag, context as FeatureFlagContext);
                    const result3 = await evaluator.isEnabled(flag, context as FeatureFlagContext);

                    // All evaluations should return the same result
                    expect(result1).toBe(result2);
                    expect(result2).toBe(result3);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 2: Percentage rollout distributes users evenly
     * For a given percentage, approximately that percentage of users should
     * have the feature enabled
     */
    it('Feature: pwa-page-caching, Property 2: Percentage rollout distributes users evenly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 0, max: 100 }),
                async (percentage) => {
                    const DEFAULT_FEATURE_FLAGS: any = {}; // We'll import this properly
                    const config: FeatureFlagConfig = {
                        flag: FeatureFlag.CACHE_WARMING,
                        defaultEnabled: false,
                        rolloutPercentage: percentage,
                        description: 'Test flag',
                    };

                    const evaluator = new FeatureFlagEvaluator({
                        ...DEFAULT_FEATURE_FLAGS,
                        [FeatureFlag.CACHE_WARMING]: config,
                    });

                    // Generate 100 random users
                    const users = Array.from({ length: 100 }, (_, i) => ({
                        userId: `user-${i}`,
                        environment: 'production' as const,
                    }));

                    // Evaluate for each user
                    const results = await Promise.all(
                        users.map(context => evaluator.isEnabled(FeatureFlag.CACHE_WARMING, context))
                    );

                    const enabledCount = results.filter(r => r).length;
                    const actualPercentage = enabledCount;

                    // Allow for some variance (±15%) in distribution
                    const tolerance = 15;
                    const minExpected = Math.max(0, percentage - tolerance);
                    const maxExpected = Math.min(100, percentage + tolerance);

                    expect(actualPercentage).toBeGreaterThanOrEqual(minExpected);
                    expect(actualPercentage).toBeLessThanOrEqual(maxExpected);
                }
            ),
            { numRuns: 20 } // Fewer runs since each test evaluates 100 users
        );
    });

    /**
     * Property 3: User targeting overrides percentage rollout
     * If a user is specifically targeted, they should have the feature enabled
     * regardless of percentage rollout
     */
    it('Feature: pwa-page-caching, Property 3: User targeting overrides percentage rollout', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.integer({ min: 0, max: 100 }),
                async (targetUserId, percentage) => {
                    const DEFAULT_FEATURE_FLAGS: any = {};
                    const config: FeatureFlagConfig = {
                        flag: FeatureFlag.CACHE_WARMING,
                        defaultEnabled: false,
                        rolloutPercentage: percentage,
                        targetUserIds: [targetUserId],
                        description: 'Test flag',
                    };

                    const evaluator = new FeatureFlagEvaluator({
                        ...DEFAULT_FEATURE_FLAGS,
                        [FeatureFlag.CACHE_WARMING]: config,
                    });

                    const context: FeatureFlagContext = {
                        userId: targetUserId,
                        environment: 'production',
                    };

                    const result = await evaluator.isEnabled(FeatureFlag.CACHE_WARMING, context);

                    // Targeted user should always have feature enabled
                    expect(result).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 4: Environment overrides respect hierarchy
     * Environment-specific overrides should take precedence over default rollout
     */
    it('Feature: pwa-page-caching, Property 4: Environment overrides respect hierarchy', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    development: fc.option(fc.boolean(), { nil: undefined }),
                    staging: fc.option(fc.boolean(), { nil: undefined }),
                    production: fc.option(fc.boolean(), { nil: undefined }),
                }),
                fc.constantFrom('development', 'staging', 'production') as fc.Arbitrary<'development' | 'staging' | 'production'>,
                async (envOverrides, environment) => {
                    const DEFAULT_FEATURE_FLAGS: any = {};
                    const config: FeatureFlagConfig = {
                        flag: FeatureFlag.CACHE_WARMING,
                        defaultEnabled: false,
                        rolloutPercentage: 0, // 0% rollout
                        environmentOverrides: envOverrides,
                        description: 'Test flag',
                    };

                    const evaluator = new FeatureFlagEvaluator({
                        ...DEFAULT_FEATURE_FLAGS,
                        [FeatureFlag.CACHE_WARMING]: config,
                    });

                    const context: FeatureFlagContext = {
                        userId: 'test-user',
                        environment,
                    };

                    const result = await evaluator.isEnabled(FeatureFlag.CACHE_WARMING, context);

                    // If environment override is set, it should be used
                    if (envOverrides[environment] !== undefined) {
                        expect(result).toBe(envOverrides[environment]);
                    }
                    // Otherwise, should fall back to percentage rollout (0%)
                    // which means disabled for most users
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property 5: Manual overrides persist across evaluator instances
     * Setting a manual override should persist in storage and be respected
     * by new evaluator instances
     */
    it('Feature: pwa-page-caching, Property 5: Manual overrides persist across evaluator instances', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...Object.values(FeatureFlag)),
                fc.boolean(),
                async (flag, overrideValue) => {
                    const storage = new LocalStorageFeatureFlagStorage();
                    const evaluator1 = new FeatureFlagEvaluator(undefined, storage);

                    // Set override
                    await evaluator1.setOverride(flag, overrideValue);

                    // Create new evaluator with same storage
                    const evaluator2 = new FeatureFlagEvaluator(undefined, storage);

                    const context: FeatureFlagContext = {
                        userId: 'test-user',
                        environment: 'development',
                    };

                    const result = await evaluator2.isEnabled(flag, context);

                    // Override should be respected by new evaluator
                    expect(result).toBe(overrideValue);

                    // Cleanup
                    await storage.clearOverride(flag);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property 6: Group targeting works correctly
     * Users in targeted groups should have the feature enabled
     */
    it('Feature: pwa-page-caching, Property 6: Group targeting works correctly', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
                fc.integer({ min: 0, max: 4 }),
                async (targetGroups: string[], userGroupIndex) => {
                    const DEFAULT_FEATURE_FLAGS: any = {};
                    const config: FeatureFlagConfig = {
                        flag: FeatureFlag.CACHE_WARMING,
                        defaultEnabled: false,
                        rolloutPercentage: 0,
                        targetGroups,
                        description: 'Test flag',
                    };

                    const evaluator = new FeatureFlagEvaluator({
                        ...DEFAULT_FEATURE_FLAGS,
                        [FeatureFlag.CACHE_WARMING]: config,
                    });

                    // User in one of the targeted groups
                    const userGroup = targetGroups[userGroupIndex % targetGroups.length];
                    const context: FeatureFlagContext = {
                        userId: 'test-user',
                        userGroups: [userGroup],
                        environment: 'production',
                    };

                    const result = await evaluator.isEnabled(FeatureFlag.CACHE_WARMING, context);

                    // User in targeted group should have feature enabled
                    expect(result).toBe(true);
                }
            ),
            { numRuns: 50 }
        );
    });
});
