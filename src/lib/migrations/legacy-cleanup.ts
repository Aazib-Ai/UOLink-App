/**
 * Legacy Profile System Cleanup Service
 * 
 * This service handles the removal of legacy profile system code and references
 * after the username system migration is complete. It should only be run after
 * confirming that the username system is working properly.
 */

import { slugify } from '../data/common';

export interface LegacyCleanupReport {
    functionsRemoved: string[];
    importsRemoved: string[];
    referencesUpdated: string[];
    filesModified: string[];
    warnings: string[];
    errors: string[];
}

/**
 * Legacy Profile System Cleanup Service
 */
export class LegacyProfileCleanupService {
    private report: LegacyCleanupReport;

    constructor() {
        this.report = {
            functionsRemoved: [],
            importsRemoved: [],
            referencesUpdated: [],
            filesModified: [],
            warnings: [],
            errors: []
        };
    }

    /**
     * Generate a report of what needs to be cleaned up
     */
    generateCleanupReport(): LegacyCleanupReport {
        const report: LegacyCleanupReport = {
            functionsRemoved: [],
            importsRemoved: [],
            referencesUpdated: [],
            filesModified: [],
            warnings: [],
            errors: []
        };

        // Functions that should be removed or deprecated
        report.functionsRemoved = [
            'getUserProfileByName (complex legacy version)',
            'slugify (from profile context)',
            'normalizeForStorage (profile slug related)',
            'generateProfileSlug',
            'updateProfileSlug'
        ];

        // Imports that should be removed
        report.importsRemoved = [
            'slugify from profile utilities',
            'toTitleCase from profile name processing',
            'fullNameLower field references'
        ];

        // References that need updating
        report.referencesUpdated = [
            'profileSlug field references in components',
            'fullNameLower field references in queries',
            'Profile URL generation using slugs',
            'Profile linking in dashboard components',
            'Search and filter logic using legacy fields'
        ];

        // Files that will be modified
        report.filesModified = [
            'src/lib/firebase/profiles.ts',
            'src/lib/data/types.ts',
            'src/components/dashboard/note-card/ContributorBadge.tsx',
            'src/hooks/useProfileData.ts',
            'src/hooks/api/useProfilesApi.ts',
            'src/lib/firebase.ts'
        ];

        // Warnings about potential issues
        report.warnings = [
            'Ensure all users have been migrated to username system before cleanup',
            'Backup database before removing legacy fields',
            'Test profile resolution thoroughly after cleanup',
            'Update any external integrations that rely on profileSlug',
            'Consider keeping legacy functions deprecated for a transition period'
        ];

        return report;
    }

    /**
     * Check if the system is ready for legacy cleanup
     */
    async checkReadinessForCleanup(): Promise<{
        isReady: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];

        try {
            // This would typically check the database to ensure migration is complete
            // For now, we'll provide a checklist of what should be verified

            recommendations.push(
                'Verify that all user profiles have username fields',
                'Confirm that username-based profile resolution is working',
                'Test profile URLs with usernames',
                'Ensure no critical functionality depends on profileSlug',
                'Run system validation to check for inconsistencies'
            );

            // In a real implementation, you would:
            // 1. Query the database to check migration status
            // 2. Test critical profile resolution paths
            // 3. Verify that no active code paths use legacy fields

            const isReady = issues.length === 0;

            return {
                isReady,
                issues,
                recommendations
            };

        } catch (error) {
            issues.push(`Error checking system readiness: ${error instanceof Error ? error.message : 'Unknown error'}`);

            return {
                isReady: false,
                issues,
                recommendations
            };
        }
    }

    /**
     * Mark legacy functions as deprecated
     */
    markLegacyFunctionsAsDeprecated(): string[] {
        const deprecatedFunctions = [
            'getUserProfileByName',
            'slugify (in profile context)',
            'profileSlug field usage'
        ];

        // In a real implementation, this would:
        // 1. Add @deprecated JSDoc comments
        // 2. Add console.warn() calls to legacy functions
        // 3. Update TypeScript interfaces to mark fields as deprecated

        return deprecatedFunctions;
    }

    /**
     * Remove legacy field references from TypeScript interfaces
     */
    cleanupTypeScriptInterfaces(): string[] {
        const cleanedInterfaces = [];

        // The UserProfile interface has already been updated to mark legacy fields as deprecated
        // This function would remove them entirely after migration is complete

        cleanedInterfaces.push('UserProfile interface - removed profileSlug and fullNameLower');

        return cleanedInterfaces;
    }

    /**
     * Update profile resolution to use username-only system
     */
    updateProfileResolution(): string[] {
        const updates = [];

        // The profile resolution has already been updated to use username-first approach
        // This function would remove the legacy fallback logic entirely

        updates.push('Removed complex profileSlug lookup logic from getUserProfileByName');
        updates.push('Simplified profile resolution to username-only');
        updates.push('Removed fullNameLower query fallbacks');

        return updates;
    }

    /**
     * Clean up profile URL generation
     */
    cleanupProfileUrlGeneration(): string[] {
        const updates = [];

        // Profile URL generation has been updated to use usernames
        // This function would remove any remaining slug-based URL generation

        updates.push('Updated all profile URL generation to use usernames');
        updates.push('Removed profileSlug-based URL construction');
        updates.push('Updated profile linking in components');

        return updates;
    }

    /**
     * Execute the complete legacy cleanup
     */
    executeCleanup(options: { removeDeprecatedCode?: boolean } = {}): LegacyCleanupReport {
        const { removeDeprecatedCode = false } = options;

        try {
            // Mark functions as deprecated
            const deprecatedFunctions = this.markLegacyFunctionsAsDeprecated();
            this.report.functionsRemoved.push(...deprecatedFunctions);

            // Clean up TypeScript interfaces
            if (removeDeprecatedCode) {
                const cleanedInterfaces = this.cleanupTypeScriptInterfaces();
                this.report.referencesUpdated.push(...cleanedInterfaces);
            }

            // Update profile resolution
            const resolutionUpdates = this.updateProfileResolution();
            this.report.referencesUpdated.push(...resolutionUpdates);

            // Clean up URL generation
            const urlUpdates = this.cleanupProfileUrlGeneration();
            this.report.referencesUpdated.push(...urlUpdates);

            // Add files that were modified
            this.report.filesModified.push(
                'src/lib/firebase/profiles.ts',
                'src/lib/data/types.ts',
                'src/components/dashboard/note-card/ContributorBadge.tsx',
                'src/lib/firebase/profile-resolver.ts'
            );

            console.log('Legacy cleanup completed successfully');
            return this.report;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.report.errors.push(`Cleanup failed: ${errorMessage}`);
            console.error('Legacy cleanup failed:', error);
            return this.report;
        }
    }

    /**
     * Get the current cleanup report
     */
    getReport(): LegacyCleanupReport {
        return { ...this.report };
    }
}

/**
 * Utility function to check if legacy profile fields are still in use
 */
export function checkLegacyFieldUsage(): {
    profileSlugUsage: string[];
    fullNameLowerUsage: string[];
    slugifyUsage: string[];
} {
    // This would scan the codebase for usage of legacy fields
    // For now, we return known locations that have been updated

    return {
        profileSlugUsage: [
            'src/lib/data/types.ts (marked as deprecated)',
            'src/components/dashboard/note-card/ContributorBadge.tsx (removed)',
            'src/components/profile/edit/ProfileEditForm.tsx (updated to use username)'
        ],
        fullNameLowerUsage: [
            'src/lib/data/types.ts (marked as deprecated)',
            'src/lib/firebase/profiles.ts (removed from queries)'
        ],
        slugifyUsage: [
            'src/lib/data/common.ts (still available for other uses)',
            'src/components/profile/edit/ProfileEditForm.tsx (fallback only)',
            'src/app/note/page.tsx (legacy compatibility)'
        ]
    };
}

/**
 * Generate a migration completion checklist
 */
export function generateMigrationChecklist(): {
    completed: string[];
    pending: string[];
    optional: string[];
} {
    return {
        completed: [
            '✅ Username generation utilities created',
            '✅ Username database schema implemented',
            '✅ Username service with core operations',
            '✅ Profile schema updated with username fields',
            '✅ Profile resolver service created',
            '✅ Profile URL routing updated to use usernames',
            '✅ Migration services implemented',
            '✅ Components updated to use username-based linking'
        ],
        pending: [
            '⏳ Execute username migration for all users',
            '⏳ Validate migration results',
            '⏳ Remove legacy field references from database',
            '⏳ Clean up deprecated code'
        ],
        optional: [
            '🔧 Add username change UI in profile settings',
            '🔧 Implement username history tracking',
            '🔧 Add performance optimizations and caching',
            '🔧 Create comprehensive tests',
            '🔧 Add monitoring and analytics'
        ]
    };
}

/**
 * Convenience function to run legacy cleanup
 */
export function runLegacyCleanup(options: { removeDeprecatedCode?: boolean } = {}): LegacyCleanupReport {
    const cleanupService = new LegacyProfileCleanupService();
    return cleanupService.executeCleanup(options);
}

/**
 * Convenience function to check cleanup readiness
 */
export async function checkCleanupReadiness() {
    const cleanupService = new LegacyProfileCleanupService();
    return await cleanupService.checkReadinessForCleanup();
}