import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteField,
    writeBatch,
    query,
    limit,
    startAfter,
    orderBy,
    QueryDocumentSnapshot,
    DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/app';
import { UsernameMigrationService, MigrationProgress } from './username-migration';
import type { UserProfile } from '../data/types';

export interface SystemMigrationProgress {
    phase: 'username_generation' | 'legacy_cleanup' | 'validation' | 'complete';
    usernameMigration?: MigrationProgress;
    legacyCleanup?: {
        totalProfiles: number;
        processedProfiles: number;
        cleanedFields: number;
    };
    validation?: {
        totalProfiles: number;
        profilesWithUsernames: number;
        profilesWithLegacyFields: number;
        inconsistencies: string[];
    };
    startTime: Date;
    endTime?: Date;
    isComplete: boolean;
    errors: string[];
}

export interface SystemMigrationOptions {
    batchSize?: number;
    dryRun?: boolean;
    cleanupLegacyFields?: boolean;
    onProgress?: (progress: SystemMigrationProgress) => void;
}

/**
 * Complete system migration service that handles:
 * 1. Username generation for all users
 * 2. Legacy field cleanup (profileSlug, fullNameLower)
 * 3. System validation
 */
export class CompleteSystemMigrationService {
    private progress: SystemMigrationProgress;

    constructor() {
        this.progress = {
            phase: 'username_generation',
            startTime: new Date(),
            isComplete: false,
            errors: []
        };
    }

    /**
     * Execute the complete system migration
     */
    async executeCompleteMigration(options: SystemMigrationOptions = {}): Promise<SystemMigrationProgress> {
        const {
            batchSize = 50,
            dryRun = false,
            cleanupLegacyFields = true,
            onProgress
        } = options;

        try {
            console.log(`Starting complete system migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);

            this.progress = {
                phase: 'username_generation',
                startTime: new Date(),
                isComplete: false,
                errors: []
            };

            // Phase 1: Username Generation
            console.log('Phase 1: Generating usernames for all users...');
            this.progress.phase = 'username_generation';
            if (onProgress) onProgress({ ...this.progress });

            const usernameMigrationService = new UsernameMigrationService();
            const usernameMigrationResult = await usernameMigrationService.executeMigration({
                batchSize,
                dryRun,
                skipExisting: true,
                onProgress: (usernameProgress) => {
                    this.progress.usernameMigration = usernameProgress;
                    if (onProgress) onProgress({ ...this.progress });
                }
            });

            this.progress.usernameMigration = usernameMigrationResult;

            if (usernameMigrationResult.failedMigrations > 0) {
                this.progress.errors.push(
                    `Username migration completed with ${usernameMigrationResult.failedMigrations} failures`
                );
            }

            // Phase 2: Legacy Field Cleanup
            if (cleanupLegacyFields && !dryRun) {
                console.log('Phase 2: Cleaning up legacy fields...');
                this.progress.phase = 'legacy_cleanup';
                if (onProgress) onProgress({ ...this.progress });

                const cleanupResult = await this.cleanupLegacyFields(batchSize, dryRun);
                this.progress.legacyCleanup = cleanupResult;
            }

            // Phase 3: Validation
            console.log('Phase 3: Validating migration results...');
            this.progress.phase = 'validation';
            if (onProgress) onProgress({ ...this.progress });

            const validationResult = await this.validateSystemMigration();
            this.progress.validation = validationResult;

            if (validationResult.inconsistencies.length > 0) {
                this.progress.errors.push(...validationResult.inconsistencies);
            }

            // Complete
            this.progress.phase = 'complete';
            this.progress.endTime = new Date();
            this.progress.isComplete = true;

            const duration = this.progress.endTime.getTime() - this.progress.startTime.getTime();
            console.log(`Complete system migration finished in ${duration}ms`);

            if (onProgress) onProgress({ ...this.progress });

            return this.progress;

        } catch (error) {
            console.error('Complete system migration failed:', error);
            this.progress.endTime = new Date();
            this.progress.isComplete = true;
            this.progress.errors.push(error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * Clean up legacy fields from all profiles
     */
    async cleanupLegacyFields(batchSize: number, dryRun: boolean) {
        const result = {
            totalProfiles: 0,
            processedProfiles: 0,
            cleanedFields: 0
        };

        try {
            // Get total count
            const profilesCollection = collection(db, 'profiles');
            const totalSnapshot = await getDocs(profilesCollection);
            result.totalProfiles = totalSnapshot.size;

            console.log(`Cleaning legacy fields from ${result.totalProfiles} profiles...`);

            // Process in batches
            let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;

            while (result.processedProfiles < result.totalProfiles) {
                let q = query(
                    profilesCollection,
                    orderBy('__name__'),
                    limit(batchSize)
                );

                if (lastDoc) {
                    q = query(
                        profilesCollection,
                        orderBy('__name__'),
                        startAfter(lastDoc),
                        limit(batchSize)
                    );
                }

                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    break;
                }

                // Process batch
                const batch = writeBatch(db);
                let batchHasUpdates = false;

                for (const docSnapshot of snapshot.docs) {
                    const data = docSnapshot.data() as UserProfile;
                    const updates: any = {};

                    // Check for legacy fields to remove
                    if (data.profileSlug !== undefined) {
                        updates.profileSlug = deleteField();
                        result.cleanedFields++;
                    }

                    if (data.fullNameLower !== undefined) {
                        updates.fullNameLower = deleteField();
                        result.cleanedFields++;
                    }

                    // Add any other legacy fields that need cleanup
                    // Example: if (data.someOldField !== undefined) { updates.someOldField = deleteField(); }

                    if (Object.keys(updates).length > 0) {
                        if (dryRun) {
                            console.log(`[DRY RUN] Would clean legacy fields from profile ${docSnapshot.id}:`, Object.keys(updates));
                        } else {
                            batch.update(doc(db, 'profiles', docSnapshot.id), updates);
                            batchHasUpdates = true;
                        }
                    }

                    result.processedProfiles++;
                }

                // Commit batch if there are updates
                if (batchHasUpdates && !dryRun) {
                    await batch.commit();
                }

                lastDoc = snapshot.docs[snapshot.docs.length - 1];

                console.log(`Processed ${result.processedProfiles}/${result.totalProfiles} profiles for cleanup`);
            }

            console.log(`Legacy field cleanup complete. Cleaned ${result.cleanedFields} fields from ${result.processedProfiles} profiles.`);
            return result;

        } catch (error) {
            console.error('Error cleaning legacy fields:', error);
            throw error;
        }
    }

    /**
     * Validate the complete system migration
     */
    async validateSystemMigration() {
        try {
            console.log('Validating system migration...');

            const profilesCollection = collection(db, 'profiles');
            const usernamesCollection = collection(db, 'usernames');

            // Get all profiles
            const profilesSnapshot = await getDocs(profilesCollection);
            const usernamesSnapshot = await getDocs(usernamesCollection);

            const result = {
                totalProfiles: profilesSnapshot.size,
                profilesWithUsernames: 0,
                profilesWithLegacyFields: 0,
                inconsistencies: [] as string[]
            };

            const profileUsernames = new Set<string>();
            const usernameRecords = new Map<string, any>();

            // Analyze profiles
            profilesSnapshot.docs.forEach(doc => {
                const data = doc.data() as UserProfile;

                if (data.username) {
                    result.profilesWithUsernames++;
                    profileUsernames.add(data.username.toLowerCase());
                }

                // Check for legacy fields
                if (data.profileSlug !== undefined || data.fullNameLower !== undefined) {
                    result.profilesWithLegacyFields++;
                }
            });

            // Analyze username records
            usernamesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.isActive) {
                    usernameRecords.set(data.id.toLowerCase(), data);
                }
            });

            // Check for inconsistencies
            if (result.profilesWithUsernames !== usernameRecords.size) {
                result.inconsistencies.push(
                    `Mismatch: ${result.profilesWithUsernames} profiles with usernames vs ${usernameRecords.size} active username records`
                );
            }

            // Check for orphaned username records
            for (const [username, record] of usernameRecords) {
                if (!profileUsernames.has(username)) {
                    result.inconsistencies.push(
                        `Orphaned username record: ${username} (userId: ${record.userId})`
                    );
                }
            }

            // Check for profiles with usernames but no username records
            for (const username of profileUsernames) {
                if (!usernameRecords.has(username)) {
                    result.inconsistencies.push(
                        `Profile has username "${username}" but no corresponding username record`
                    );
                }
            }

            if (result.profilesWithLegacyFields > 0) {
                result.inconsistencies.push(
                    `${result.profilesWithLegacyFields} profiles still have legacy fields (profileSlug, fullNameLower)`
                );
            }

            console.log('Validation complete:', result);
            return result;

        } catch (error) {
            console.error('Error validating system migration:', error);
            throw error;
        }
    }

    /**
     * Get current migration progress
     */
    getProgress(): SystemMigrationProgress {
        return { ...this.progress };
    }
}

/**
 * Convenience function to run the complete system migration
 */
export async function runCompleteSystemMigration(options: SystemMigrationOptions = {}): Promise<SystemMigrationProgress> {
    const migrationService = new CompleteSystemMigrationService();
    return await migrationService.executeCompleteMigration(options);
}

/**
 * Convenience function to validate the system migration
 */
export async function validateCompleteSystemMigration() {
    const migrationService = new CompleteSystemMigrationService();
    return await migrationService.validateSystemMigration();
}

/**
 * Rollback migration (emergency use only)
 * This removes username fields and restores the system to pre-migration state
 */
export async function rollbackSystemMigration(options: { batchSize?: number; dryRun?: boolean } = {}) {
    const { batchSize = 50, dryRun = false } = options;

    console.warn('⚠️ ROLLBACK: This will remove all username data and restore the legacy system');

    if (dryRun) {
        console.log('[DRY RUN] Rollback preview - no actual changes will be made');
    }

    try {
        // Remove username fields from profiles
        const profilesCollection = collection(db, 'profiles');
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let processedProfiles = 0;

        while (true) {
            let q = query(
                profilesCollection,
                orderBy('__name__'),
                limit(batchSize)
            );

            if (lastDoc) {
                q = query(
                    profilesCollection,
                    orderBy('__name__'),
                    startAfter(lastDoc),
                    limit(batchSize)
                );
            }

            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                break;
            }

            const batch = writeBatch(db);
            let batchHasUpdates = false;

            for (const docSnapshot of snapshot.docs) {
                const data = docSnapshot.data() as UserProfile;

                if (data.username || data.usernameLastChanged) {
                    const updates: any = {};

                    if (data.username) {
                        updates.username = deleteField();
                    }

                    if (data.usernameLastChanged) {
                        updates.usernameLastChanged = deleteField();
                    }

                    if (dryRun) {
                        console.log(`[DRY RUN] Would remove username fields from profile ${docSnapshot.id}`);
                    } else {
                        batch.update(doc(db, 'profiles', docSnapshot.id), updates);
                        batchHasUpdates = true;
                    }
                }

                processedProfiles++;
            }

            if (batchHasUpdates && !dryRun) {
                await batch.commit();
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            console.log(`Processed ${processedProfiles} profiles for rollback`);
        }

        // Note: Username records would need to be deleted manually or via admin tools
        // as this is a destructive operation that should be done carefully

        console.log(`Rollback complete. Processed ${processedProfiles} profiles.`);

        if (!dryRun) {
            console.warn('⚠️ Remember to manually clean up the "usernames" and "username_history" collections');
        }

    } catch (error) {
        console.error('Rollback failed:', error);
        throw error;
    }
}