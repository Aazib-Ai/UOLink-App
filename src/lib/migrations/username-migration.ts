import {
    collection,
    getDocs,
    doc,
    updateDoc,
    writeBatch,
    query,
    limit,
    startAfter,
    orderBy,
    Timestamp,
    QueryDocumentSnapshot,
    DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/app';
import { generateUsernameWithConflicts } from '../username/generation';
import { validateUsername } from '../username/validation';
import { createUsernameRecord } from '../firebase/usernames';
import type { UserProfile } from '../data/types';

export interface MigrationProgress {
    totalUsers: number;
    processedUsers: number;
    successfulMigrations: number;
    failedMigrations: number;
    errors: MigrationError[];
    startTime: Date;
    endTime?: Date;
    isComplete: boolean;
}

export interface MigrationError {
    userId: string;
    fullName: string;
    error: string;
    timestamp: Date;
}

export interface MigrationBatch {
    users: UserProfile[];
    batchNumber: number;
    totalBatches: number;
}

export interface MigrationOptions {
    batchSize?: number;
    dryRun?: boolean;
    skipExisting?: boolean;
    onProgress?: (progress: MigrationProgress) => void;
    onBatchComplete?: (batch: MigrationBatch, progress: MigrationProgress) => void;
}

/**
 * One-time migration service to add usernames to existing user profiles
 */
export class UsernameMigrationService {
    private existingUsernames = new Set<string>();
    private progress: MigrationProgress;

    constructor() {
        this.progress = {
            totalUsers: 0,
            processedUsers: 0,
            successfulMigrations: 0,
            failedMigrations: 0,
            errors: [],
            startTime: new Date(),
            isComplete: false
        };
    }

    /**
     * Get total count of users that need migration
     */
    async getTotalUserCount(): Promise<number> {
        try {
            const profilesCollection = collection(db, 'profiles');
            const snapshot = await getDocs(profilesCollection);
            return snapshot.size;
        } catch (error) {
            console.error('Error getting total user count:', error);
            throw new Error('Failed to get total user count');
        }
    }

    /**
     * Load existing usernames to avoid conflicts
     */
    async loadExistingUsernames(): Promise<void> {
        try {
            const usernamesCollection = collection(db, 'usernames');
            const snapshot = await getDocs(usernamesCollection);

            this.existingUsernames.clear();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.isActive) {
                    this.existingUsernames.add(data.id.toLowerCase());
                }
            });

            console.log(`Loaded ${this.existingUsernames.size} existing usernames`);
        } catch (error) {
            console.error('Error loading existing usernames:', error);
            throw new Error('Failed to load existing usernames');
        }
    }

    /**
     * Generate username for a user profile
     */
    generateUsernameForProfile(profile: UserProfile): string {
        const displayName = profile.fullName || `user-${profile.id.slice(-6)}`;

        const username = generateUsernameWithConflicts(
            displayName,
            this.existingUsernames,
            { maxLength: 30 }
        );

        // Add to existing usernames to prevent conflicts in same batch
        this.existingUsernames.add(username.toLowerCase());

        return username;
    }

    /**
     * Process a single user profile migration
     */
    async migrateUserProfile(profile: UserProfile, dryRun: boolean = false): Promise<void> {
        try {
            // Skip if user already has a username
            if (profile.username) {
                console.log(`User ${profile.id} already has username: ${profile.username}`);
                return;
            }

            // Generate username
            const username = this.generateUsernameForProfile(profile);

            if (dryRun) {
                console.log(`[DRY RUN] Would assign username "${username}" to user ${profile.id} (${profile.fullName})`);
                return;
            }

            // Create username record
            await createUsernameRecord({
                id: username.toLowerCase(),
                userId: profile.id,
                displayUsername: username,
                isActive: true
            });

            // Update profile with username
            const profileRef = doc(db, 'profiles', profile.id);
            await updateDoc(profileRef, {
                username: username,
                usernameLastChanged: Timestamp.now()
            });

            console.log(`Successfully migrated user ${profile.id}: ${profile.fullName} -> ${username}`);
        } catch (error) {
            console.error(`Error migrating user ${profile.id}:`, error);
            throw error;
        }
    }

    /**
     * Process a batch of users
     */
    async processBatch(
        users: UserProfile[],
        batchNumber: number,
        totalBatches: number,
        options: MigrationOptions
    ): Promise<void> {
        const { dryRun = false, onBatchComplete } = options;
        const batchErrors: MigrationError[] = [];

        console.log(`Processing batch ${batchNumber}/${totalBatches} (${users.length} users)`);

        for (const user of users) {
            try {
                await this.migrateUserProfile(user, dryRun);
                this.progress.successfulMigrations++;
            } catch (error) {
                this.progress.failedMigrations++;
                const migrationError: MigrationError = {
                    userId: user.id,
                    fullName: user.fullName || 'Unknown',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date()
                };
                batchErrors.push(migrationError);
                this.progress.errors.push(migrationError);
            }

            this.progress.processedUsers++;
        }

        // Call batch complete callback
        if (onBatchComplete) {
            const batch: MigrationBatch = {
                users,
                batchNumber,
                totalBatches
            };
            onBatchComplete(batch, { ...this.progress });
        }

        if (batchErrors.length > 0) {
            console.warn(`Batch ${batchNumber} completed with ${batchErrors.length} errors`);
        }
    }

    /**
     * Get users in batches for processing
     */
    async *getUserBatches(batchSize: number): AsyncGenerator<UserProfile[]> {
        let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
        let batchNumber = 0;

        while (true) {
            const profilesCollection = collection(db, 'profiles');
            let q = query(
                profilesCollection,
                orderBy('__name__'), // Order by document ID for consistent pagination
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

            const users: UserProfile[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as UserProfile));

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            batchNumber++;

            yield users;
        }
    }

    /**
     * Execute the complete migration
     */
    async executeMigration(options: MigrationOptions = {}): Promise<MigrationProgress> {
        const {
            batchSize = 50,
            dryRun = false,
            skipExisting = true,
            onProgress
        } = options;

        try {
            console.log(`Starting username migration (${dryRun ? 'DRY RUN' : 'LIVE'})`);

            // Initialize progress
            this.progress = {
                totalUsers: await this.getTotalUserCount(),
                processedUsers: 0,
                successfulMigrations: 0,
                failedMigrations: 0,
                errors: [],
                startTime: new Date(),
                isComplete: false
            };

            // Load existing usernames
            await this.loadExistingUsernames();

            console.log(`Total users to process: ${this.progress.totalUsers}`);

            // Calculate total batches
            const totalBatches = Math.ceil(this.progress.totalUsers / batchSize);
            let batchNumber = 0;

            // Process users in batches
            for await (const users of this.getUserBatches(batchSize)) {
                batchNumber++;

                // Filter users that need migration
                const usersToMigrate = skipExisting
                    ? users.filter(user => !user.username)
                    : users;

                if (usersToMigrate.length > 0) {
                    await this.processBatch(usersToMigrate, batchNumber, totalBatches, options);
                } else {
                    // Still count processed users even if skipped
                    this.progress.processedUsers += users.length;
                }

                // Call progress callback
                if (onProgress) {
                    onProgress({ ...this.progress });
                }

                // Small delay to prevent overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Mark as complete
            this.progress.endTime = new Date();
            this.progress.isComplete = true;

            const duration = this.progress.endTime.getTime() - this.progress.startTime.getTime();
            console.log(`Migration completed in ${duration}ms`);
            console.log(`Successful: ${this.progress.successfulMigrations}, Failed: ${this.progress.failedMigrations}`);

            if (this.progress.errors.length > 0) {
                console.warn('Migration completed with errors:', this.progress.errors);
            }

            return this.progress;

        } catch (error) {
            console.error('Migration failed:', error);
            this.progress.endTime = new Date();
            this.progress.isComplete = true;
            throw error;
        }
    }

    /**
     * Validate migration results
     */
    async validateMigration(): Promise<{
        totalProfiles: number;
        profilesWithUsernames: number;
        totalUsernameRecords: number;
        inconsistencies: string[];
    }> {
        try {
            // Count profiles
            const profilesSnapshot = await getDocs(collection(db, 'profiles'));
            const totalProfiles = profilesSnapshot.size;

            let profilesWithUsernames = 0;
            const profileUsernames = new Set<string>();

            profilesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.username) {
                    profilesWithUsernames++;
                    profileUsernames.add(data.username.toLowerCase());
                }
            });

            // Count username records
            const usernamesSnapshot = await getDocs(collection(db, 'usernames'));
            const totalUsernameRecords = usernamesSnapshot.size;

            // Check for inconsistencies
            const inconsistencies: string[] = [];

            if (profilesWithUsernames !== totalUsernameRecords) {
                inconsistencies.push(
                    `Mismatch: ${profilesWithUsernames} profiles with usernames vs ${totalUsernameRecords} username records`
                );
            }

            return {
                totalProfiles,
                profilesWithUsernames,
                totalUsernameRecords,
                inconsistencies
            };

        } catch (error) {
            console.error('Error validating migration:', error);
            throw error;
        }
    }

    /**
     * Get current migration progress
     */
    getProgress(): MigrationProgress {
        return { ...this.progress };
    }
}

/**
 * Convenience function to run the migration
 */
export async function runUsernameMigration(options: MigrationOptions = {}): Promise<MigrationProgress> {
    const migrationService = new UsernameMigrationService();
    return await migrationService.executeMigration(options);
}

/**
 * Convenience function to validate migration
 */
export async function validateUsernameMigration() {
    const migrationService = new UsernameMigrationService();
    return await migrationService.validateMigration();
}