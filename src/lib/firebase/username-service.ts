import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    getDocs,
    writeBatch,
    Timestamp,
    runTransaction
} from 'firebase/firestore';
import { db } from './app';
import {
    usernamesCollection,
    usernameHistoryCollection,
    getUsernameRecord,
    createUsernameRecord,
    addUsernameHistoryRecord,
    type UsernameRecord,
    type UsernameHistoryRecord
} from './usernames';
import { getUserProfile } from './profiles';
import { usernameCache } from '../cache/username-cache';
import type { UserProfile } from '../data/types';
import { syncUserProfileReferences } from './profile-sync';
import { isReservedUsername, normalizeUsernameInput } from '@/lib/username/validation';
import { UsernameError } from '@/lib/username/errors';
import { toPublicProfile } from '@/lib/security/sanitization';

// Username service interface
export interface UsernameService {
    checkAvailability(username: string): Promise<boolean>;
    reserveUsername(userId: string, username: string): Promise<void>;
    getUserByUsername(username: string): Promise<UserProfile | null>;
    generateSuggestions(baseUsername: string): Promise<string[]>;
    changeUsername(userId: string, newUsername: string): Promise<void>;
}

/**
 * Check if a username is available for registration
 */
export async function checkAvailability(username: string): Promise<boolean> {
    try {
        const normalizedUsername = normalizeUsernameInput(username).toLowerCase();

        // Check if username exists in usernames collection
        const usernameRecord = await getUsernameRecord(normalizedUsername);

        if (usernameRecord && usernameRecord.isActive) {
            return false;
        }

        // Check if username is in reserved list
        if (isReservedUsername(normalizedUsername)) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking username availability:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to check username availability');
    }
}

/**
 * Atomically reserve a username for a user
 */
export async function reserveUsername(userId: string, username: string): Promise<void> {
    try {
        const normalizedUsername = normalizeUsernameInput(username).toLowerCase();

        // Validate against reserved usernames before starting transaction
        if (isReservedUsername(normalizedUsername)) {
            throw new UsernameError('RESERVED', 'Username is reserved');
        }

        // Use transaction to ensure atomicity
        await runTransaction(db, async (transaction) => {
            const usernameDocRef = doc(usernamesCollection, normalizedUsername);
            const usernameDoc = await transaction.get(usernameDocRef);

            // Check if username is already taken
            if (usernameDoc.exists()) {
                const existingRecord = usernameDoc.data() as UsernameRecord;
                if (existingRecord.isActive) {
                    throw new UsernameError('USERNAME_TAKEN', 'Username is already taken');
                }
            }

            // Check if user already has an active username (read inside transaction)
            const activeQuery = query(
                usernamesCollection,
                where('userId', '==', userId),
                where('isActive', '==', true)
            );
            const activeSnapshot = await getDocs(activeQuery);
            if (!activeSnapshot.empty) {
                const oldDoc = activeSnapshot.docs[0];
                const oldRef = doc(usernamesCollection, oldDoc.id);
                // Read old username doc inside the transaction to include it in the read set
                await transaction.get(oldRef);

                transaction.update(oldRef, {
                    isActive: false,
                    updatedAt: Timestamp.now()
                });

                // Add to history
                const historyRef = doc(usernameHistoryCollection);
                transaction.set(historyRef, {
                    id: historyRef.id,
                    userId,
                    oldUsername: (oldDoc.data().displayUsername || normalizedUsername),
                    oldUsernameLower: (oldDoc.data().displayUsername || normalizedUsername).toLowerCase(),
                    newUsername: username,
                    changedAt: Timestamp.now(),
                    aliasExpiresAt: Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)) // 90 days
                });
            }

            // Create new username record
            const now = Timestamp.now();
            transaction.set(usernameDocRef, {
                id: normalizedUsername,
                userId,
                displayUsername: username,
                createdAt: now,
                updatedAt: now,
                isActive: true
            });
        });

        // Invalidate caches after successful reservation
        usernameCache.invalidate(normalizedUsername);
        usernameCache.invalidateByUserId(userId);
    } catch (error) {
        console.error('Error reserving username:', error);
        if (error instanceof UsernameError) {
            throw error;
        }
        throw new UsernameError('SERVER_ERROR', 'Failed to reserve username');
    }
}

/**
 * Get user profile by username with caching
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
    try {
        const normalizedUsername = normalizeUsernameInput(username).toLowerCase();

        // Check cache first
        const cachedProfile = usernameCache.get(normalizedUsername);
        if (cachedProfile !== undefined) {
            return cachedProfile as UserProfile | null;
        }

        // Get username record from database
        const usernameRecord = await getUsernameRecord(normalizedUsername);

        if (!usernameRecord || !usernameRecord.isActive) {
            // Check if it's an old username alias
            const aliasRecord = await checkUsernameAlias(normalizedUsername, username);
            if (aliasRecord) {
                // Redirect to current username
                const currentUsernameRecord = await getUsernameRecord(aliasRecord.newUsername.toLowerCase());
                if (currentUsernameRecord && currentUsernameRecord.isActive) {
                    const raw = await getUserProfile(currentUsernameRecord.userId);
                    const profile = raw ? (toPublicProfile(raw) as UserProfile) : null;
                    // Cache the result for both the alias and current username
                    const aliasExpiryMs = aliasRecord.aliasExpiresAt?.toMillis?.()
                        ?? (aliasRecord.aliasExpiresAt instanceof Date ? aliasRecord.aliasExpiresAt.getTime() : null);
                    usernameCache.set(normalizedUsername, profile, { expiresAt: aliasExpiryMs ?? null });
                    if (profile?.username) {
                        usernameCache.set(profile.username, profile);
                    }
                    return profile;
                }
            }

            // Cache null result to avoid repeated database queries for non-existent users
            usernameCache.set(normalizedUsername, null);
            return null;
        }

        // Get user profile
        const raw = await getUserProfile(usernameRecord.userId);
        const profile = raw ? (toPublicProfile(raw) as UserProfile) : null;

        // Cache the result
        usernameCache.set(normalizedUsername, profile);

        return profile;
    } catch (error) {
        console.error('Error getting user by username:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to get user by username');
    }
}

/**
 * Generate username suggestions based on a base username
 */
export async function generateSuggestions(baseUsername: string): Promise<string[]> {
    try {
        const normalizedBase = normalizeUsernameInput(baseUsername).toLowerCase();
        const suggestions: string[] = [];

        // Generate variations
        const variations = [
            normalizedBase,
            `${normalizedBase}-1`,
            `${normalizedBase}-2`,
            `${normalizedBase}-3`,
            `${normalizedBase}1`,
            `${normalizedBase}2`,
            `${normalizedBase}3`,
            `${normalizedBase}-user`,
            `${normalizedBase}-dev`
        ];

        // Filter out reserved upfront
        const nonReserved = variations.filter((v) => !isReservedUsername(v));

        // Batch query existing username records using 'id' field
        // Firestore 'in' operator supports up to 10 values; variations <= 9 here
        if (nonReserved.length > 0) {
            const snapshot = await getDocs(query(
                usernamesCollection,
                where('id', 'in', nonReserved)
            ));
            const takenActive = new Set(
                snapshot.docs
                    .map((d) => d.data() as UsernameRecord)
                    .filter((r) => r.isActive)
                    .map((r) => r.id.toLowerCase())
            );

            for (const v of nonReserved) {
                if (!takenActive.has(v)) {
                    suggestions.push(v);
                }
                if (suggestions.length >= 5) break;
            }
        }

        return suggestions;
    } catch (error) {
        console.error('Error generating username suggestions:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to generate username suggestions');
    }
}

/**
 * Change username for a user (with cooldown enforcement)
 */
export async function changeUsername(userId: string, newUsername: string): Promise<void> {
    try {
        // Check cooldown period (30 days)
        const lastChange = await getLastUsernameChange(userId);
        if (lastChange) {
            const cooldownPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
            const timeSinceLastChange = Date.now() - lastChange.changedAt.toMillis();

            if (timeSinceLastChange < cooldownPeriod) {
                const remainingDays = Math.ceil((cooldownPeriod - timeSinceLastChange) / (24 * 60 * 60 * 1000));
                throw new UsernameError('COOLDOWN', `Username can only be changed once every 30 days. Please wait ${remainingDays} more days.`);
            }
        }

        // Reserve the new username (this handles the atomic operation)
        await reserveUsername(userId, newUsername);

        // Invalidate cache entries for this user after successful username change
        usernameCache.invalidateByUserId(userId);
        usernameCache.invalidate(newUsername);

        const profile = await getUserProfile(userId);
        void syncUserProfileReferences({
            userId,
            fullName: profile?.fullName,
            username: newUsername,
        }).catch((syncError) => {
            console.error('[ProfileSync] Failed to update related records after username change', syncError);
        });
    } catch (error) {
        console.error('Error changing username:', error);
        if (error instanceof UsernameError) {
            throw error;
        }
        throw new UsernameError('SERVER_ERROR', 'Failed to change username');
    }
}

// Helper functions

/**
 * Get active username for a user
 */
async function getUserActiveUsername(userId: string): Promise<UsernameRecord[]> {
    try {
        const q = query(
            usernamesCollection,
            where('userId', '==', userId),
            where('isActive', '==', true)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as UsernameRecord);
    } catch (error) {
        console.error('Error getting user active username:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to fetch active username');
    }
}

/**
 * Check if username is an alias (old username that redirects)
 */
async function checkUsernameAlias(normalizedInput: string, rawInput?: string): Promise<UsernameHistoryRecord | null> {
    try {
        const normalizedUsername = normalizedInput.toLowerCase().trim();
        if (!normalizedUsername) {
            return null;
        }

        const nowMillis = Timestamp.now().toMillis();
        const findActiveAlias = (docs: UsernameHistoryRecord[]): UsernameHistoryRecord | null => {
            if (!docs.length) return null;
            return docs.reduce<UsernameHistoryRecord | null>((current, record) => {
                const expires = record.aliasExpiresAt ? record.aliasExpiresAt.toMillis() : 0;
                if (expires <= nowMillis) {
                    return current;
                }

                if (!current) {
                    return record;
                }

                const currentExpires = current.aliasExpiresAt ? current.aliasExpiresAt.toMillis() : 0;
                return expires > currentExpires ? record : current;
            }, null);
        };

        const q = query(
            usernameHistoryCollection,
            where('oldUsernameLower', '==', normalizedUsername)
        );

        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(docSnap => docSnap.data() as UsernameHistoryRecord);
        let activeRecord = findActiveAlias(records);

        if (!activeRecord) {
            const legacySearchValues = Array.from(new Set(
                [rawInput, rawInput?.toLowerCase(), normalizedUsername]
                    .map(value => value?.trim())
                    .filter(Boolean) as string[]
            ));

            if (!legacySearchValues.length) {
                return activeRecord;
            }

            const legacySnapshot = await getDocs(query(
                usernameHistoryCollection,
                where('oldUsername', 'in', legacySearchValues)
            ));
            const legacyRecords = legacySnapshot.docs.map(docSnap => docSnap.data() as UsernameHistoryRecord);
            activeRecord = findActiveAlias(legacyRecords);
        }

        return activeRecord;
    } catch (error) {
        console.error('Error checking username alias:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to check username alias');
    }
}

/**
 * Get last username change for cooldown enforcement
 */
async function getLastUsernameChange(userId: string): Promise<any | null> {
    try {
        const q = query(
            usernameHistoryCollection,
            where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }

        // Find the most recent change
        let lastChange: any = null;
        querySnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!lastChange || data.changedAt.toMillis() > lastChange.changedAt.toMillis()) {
                lastChange = data;
            }
        });

        return lastChange;
    } catch (error) {
        console.error('Error getting last username change:', error);
        throw new UsernameError('SERVER_ERROR', 'Failed to get last username change');
    }
}

// Use isReservedUsername from validation module for consistency

// Export the service interface implementation
export const usernameService: UsernameService = {
    checkAvailability,
    reserveUsername,
    getUserByUsername,
    generateSuggestions,
    changeUsername
};
