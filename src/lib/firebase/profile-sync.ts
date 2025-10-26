import {
    collection,
    collectionGroup,
    doc,
    getDocs,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db } from './app';

interface SyncOptions {
    userId: string;
    fullName?: string | null;
    username?: string | null;
}

const pickDisplayName = (fullName?: string | null): string => {
    const trimmed = typeof fullName === 'string' ? fullName.trim() : '';
    return trimmed.length > 0 ? trimmed : 'Anonymous';
};

const normalizeUsername = (username?: string | null): string | null => {
    if (typeof username !== 'string') {
        return null;
    }
    const trimmed = username.trim();
    return trimmed.length > 0 ? trimmed : null;
};

async function updateNotesForUser(userId: string, displayName: string, username: string | null) {
    try {
        const notesQuery = query(collection(db, 'notes'), where('uploadedBy', '==', userId));
        const snapshot = await getDocs(notesQuery);

        if (snapshot.empty) {
            return;
        }

        let batch = writeBatch(db);
        let operations = 0;

        const commitBatch = async () => {
            if (operations === 0) {
                return;
            }
            try {
                await batch.commit();
                batch = writeBatch(db);
                operations = 0;
            } catch (error) {
                throw new Error(`Failed to commit notes batch: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        for (const docSnap of snapshot.docs) {
            try {
                const ref = doc(db, 'notes', docSnap.id);
                const payload: Record<string, any> = {
                    contributorName: displayName,
                    contributorDisplayName: displayName,
                };

                if (username !== null) {
                    payload.uploaderUsername = username;
                } else {
                    payload.uploaderUsername = null;
                }

                batch.set(ref, payload, { merge: true });
                operations += 1;

                if (operations === 500) {
                    await commitBatch();
                }
            } catch (error) {
                throw new Error(`Failed to update note ${docSnap.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        await commitBatch();
    } catch (error) {
        throw new Error(`Notes update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function updateCollectionGroupDocs(
    groupName: string,
    userId: string,
    displayName: string,
    username: string | null
) {
    try {
        const docsQuery = query(collectionGroup(db, groupName), where('userId', '==', userId));
        const snapshot = await getDocs(docsQuery);

        if (snapshot.empty) {
            return;
        }

        let batch = writeBatch(db);
        let operations = 0;

        const commitBatch = async () => {
            if (operations === 0) {
                return;
            }
            try {
                await batch.commit();
                batch = writeBatch(db);
                operations = 0;
            } catch (error) {
                throw new Error(`Failed to commit ${groupName} batch: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        for (const docSnap of snapshot.docs) {
            try {
                const ref = doc(db, docSnap.ref.path);
                const payload: Record<string, any> = {
                    userName: displayName,
                    userDisplayName: displayName,
                };

                if (username !== null) {
                    payload.userUsername = username;
                } else {
                    payload.userUsername = null;
                }

                batch.set(ref, payload, { merge: true });
                operations += 1;

                if (operations === 500) {
                    await commitBatch();
                }
            } catch (error) {
                throw new Error(`Failed to update ${groupName} document ${docSnap.id}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        await commitBatch();
    } catch (error) {
        throw new Error(`${groupName} collection update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function syncUserProfileReferences(options: SyncOptions): Promise<void> {
    const { userId } = options;
    if (!userId?.trim()) {
        return;
    }

    const displayName = pickDisplayName(options.fullName);
    const username = normalizeUsername(options.username);

    try {
        const results = await Promise.allSettled([
            updateNotesForUser(userId, displayName, username),
            updateCollectionGroupDocs('comments', userId, displayName, username),
            updateCollectionGroupDocs('replies', userId, displayName, username),
        ]);

        const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
        if (failures.length > 0) {
            // Log failures but don't throw to avoid breaking the UI
            const errorMessages = failures.map((failure, index) => {
                const reason = failure.reason instanceof Error
                    ? failure.reason.message
                    : String(failure.reason ?? 'Unknown profile sync error');
                return `Sync operation ${index + 1}: ${reason}`;
            });

            // Use console.warn instead of console.error to avoid Next.js error overlay
            console.warn('[ProfileSync] Some profile reference updates failed:', errorMessages.join('; '));
        }
    } catch (error) {
        // Catch any unexpected errors and log them without throwing
        console.warn('[ProfileSync] Unexpected error during profile sync:', error instanceof Error ? error.message : String(error));
    }
}
