import {
    collection,
    getDocs,
    doc,
    updateDoc,
    writeBatch,
    query,
    limit,
    startAfter,
    orderBy
} from 'firebase/firestore';
import { db } from '../firebase/app';

/**
 * Migration script to rename vibeScore to credibilityScore in all notes
 * This script should be run once to update existing data
 */

interface MigrationProgress {
    processed: number;
    updated: number;
    errors: number;
    total?: number;
}

export const migrateVibeScoreToCredibilityScore = async (
    batchSize: number = 100,
    onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationProgress> => {
    const progress: MigrationProgress = {
        processed: 0,
        updated: 0,
        errors: 0
    };

    try {
        console.log('Starting vibeScore to credibilityScore migration...');

        // Get total count first (optional, for progress tracking)
        const totalSnapshot = await getDocs(collection(db, 'notes'));
        progress.total = totalSnapshot.size;
        console.log(`Total notes to process: ${progress.total}`);

        let lastDoc = null;
        let hasMore = true;

        while (hasMore) {
            // Build query for batch processing
            let notesQuery = query(
                collection(db, 'notes'),
                orderBy('uploadedAt', 'desc'),
                limit(batchSize)
            );

            if (lastDoc) {
                notesQuery = query(
                    collection(db, 'notes'),
                    orderBy('uploadedAt', 'desc'),
                    startAfter(lastDoc),
                    limit(batchSize)
                );
            }

            const snapshot = await getDocs(notesQuery);

            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            // Process batch
            const batch = writeBatch(db);
            let batchUpdates = 0;

            for (const docSnapshot of snapshot.docs) {
                try {
                    const data = docSnapshot.data();
                    progress.processed++;

                    // Check if migration is needed
                    if (data.vibeScore !== undefined && data.credibilityScore === undefined) {
                        const noteRef = doc(db, 'notes', docSnapshot.id);

                        // Prepare update data
                        const updateData: any = {
                            credibilityScore: data.vibeScore,
                            credibilityUpdatedAt: data.vibeUpdatedAt || data.lastInteractionAt || new Date()
                        };

                        // Remove old fields (set to null to delete)
                        updateData.vibeScore = null;
                        if (data.vibeUpdatedAt !== undefined) {
                            updateData.vibeUpdatedAt = null;
                        }

                        batch.update(noteRef, updateData);
                        batchUpdates++;
                        progress.updated++;
                    }
                } catch (error) {
                    console.error(`Error processing document ${docSnapshot.id}:`, error);
                    progress.errors++;
                }
            }

            // Commit batch if there are updates
            if (batchUpdates > 0) {
                await batch.commit();
                console.log(`Batch committed: ${batchUpdates} updates`);
            }

            // Update progress
            if (onProgress) {
                onProgress({ ...progress });
            }

            // Set up for next batch
            lastDoc = snapshot.docs[snapshot.docs.length - 1];

            // Small delay to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('Migration completed successfully!');
        console.log(`Final stats: ${progress.processed} processed, ${progress.updated} updated, ${progress.errors} errors`);

        return progress;

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    }
};

/**
 * Rollback function to revert the migration (for testing purposes)
 */
export const rollbackCredibilityScoreToVibeScore = async (
    batchSize: number = 100
): Promise<MigrationProgress> => {
    const progress: MigrationProgress = {
        processed: 0,
        updated: 0,
        errors: 0
    };

    try {
        console.log('Starting rollback: credibilityScore to vibeScore...');

        let lastDoc = null;
        let hasMore = true;

        while (hasMore) {
            let notesQuery = query(
                collection(db, 'notes'),
                orderBy('uploadedAt', 'desc'),
                limit(batchSize)
            );

            if (lastDoc) {
                notesQuery = query(
                    collection(db, 'notes'),
                    orderBy('uploadedAt', 'desc'),
                    startAfter(lastDoc),
                    limit(batchSize)
                );
            }

            const snapshot = await getDocs(notesQuery);

            if (snapshot.empty) {
                hasMore = false;
                break;
            }

            const batch = writeBatch(db);
            let batchUpdates = 0;

            for (const docSnapshot of snapshot.docs) {
                try {
                    const data = docSnapshot.data();
                    progress.processed++;

                    if (data.credibilityScore !== undefined) {
                        const noteRef = doc(db, 'notes', docSnapshot.id);

                        const updateData: any = {
                            vibeScore: data.credibilityScore,
                            vibeUpdatedAt: data.credibilityUpdatedAt || data.lastInteractionAt || new Date(),
                            credibilityScore: null,
                            credibilityUpdatedAt: null
                        };

                        batch.update(noteRef, updateData);
                        batchUpdates++;
                        progress.updated++;
                    }
                } catch (error) {
                    console.error(`Error processing document ${docSnapshot.id}:`, error);
                    progress.errors++;
                }
            }

            if (batchUpdates > 0) {
                await batch.commit();
                console.log(`Rollback batch committed: ${batchUpdates} updates`);
            }

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('Rollback completed successfully!');
        return progress;

    } catch (error) {
        console.error('Rollback failed:', error);
        throw error;
    }
};

/**
 * Utility function to check migration status
 */
export const checkMigrationStatus = async (): Promise<{
    totalNotes: number;
    notesWithVibeScore: number;
    notesWithCredibilityScore: number;
    needsMigration: number;
}> => {
    const snapshot = await getDocs(collection(db, 'notes'));

    let notesWithVibeScore = 0;
    let notesWithCredibilityScore = 0;
    let needsMigration = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.vibeScore !== undefined) {
            notesWithVibeScore++;
            if (data.credibilityScore === undefined) {
                needsMigration++;
            }
        }
        if (data.credibilityScore !== undefined) {
            notesWithCredibilityScore++;
        }
    });

    return {
        totalNotes: snapshot.size,
        notesWithVibeScore,
        notesWithCredibilityScore,
        needsMigration
    };
};