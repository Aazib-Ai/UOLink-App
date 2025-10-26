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
        const normalizedUsername = username.toLowerCase().trim();

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
        throw new Error('Failed to check username availability');
    }
}

/**
 * Atomically reserve a username for a user
 */
export async function reserveUsername(userId: string, username: string): Promise<void> {
    try {
        const normalizedUsername = username.toLowerCase().trim();

        // Use transaction to ensure atomicity
        await runTransaction(db, async (transaction) => {
            const usernameDocRef = doc(usernamesCollection, normalizedUsername);
            const usernameDoc = await transaction.get(usernameDocRef);

            // Check if username is already taken
            if (usernameDoc.exists()) {
                const existingRecord = usernameDoc.data() as UsernameRecord;
                if (existingRecord.isActive) {
                    throw new Error('Username is already taken');
                }
            }

            // Check if user already has an active username
            const existingUsernames = await getUserActiveUsername(userId);
            if (existingUsernames.length > 0) {
                // Deactivate existing username
                const oldUsernameRef = doc(usernamesCollection, existingUsernames[0].id);
                transaction.update(oldUsernameRef, {
                    isActive: false,
                    updatedAt: Timestamp.now()
                });

                // Add to history
                const historyRef = doc(usernameHistoryCollection);
                transaction.set(historyRef, {
                    id: historyRef.id,
                    userId,
                    oldUsername: existingUsernames[0].displayUsername,
                    oldUsernameLower: existingUsernames[0].displayUsername.toLowerCase(),
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
    } catch (error) {
        console.error('Error reserving username:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to reserve username');
    }
}

/**
 * Get user profile by username with caching
 */
export async function getUserByUsername(username: string): Promise<UserProfile | null> {
    try {
        const normalizedUsername = username.toLowerCase().trim();

        // Check cache first
        const cachedProfile = usernameCache.get(normalizedUsername);
        if (cachedProfile !== undefined) {
            return cachedProfile;
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
                    const profile = await getUserProfile(currentUsernameRecord.userId);
                    // Cache the result for both the alias and current username
                    usernameCache.set(normalizedUsername, profile);
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
        const profile = await getUserProfile(usernameRecord.userId);

        // Cache the result
        usernameCache.set(normalizedUsername, profile);

        return profile;
    } catch (error) {
        console.error('Error getting user by username:', error);
        throw new Error('Failed to get user by username');
    }
}

/**
 * Generate username suggestions based on a base username
 */
export async function generateSuggestions(baseUsername: string): Promise<string[]> {
    try {
        const normalizedBase = baseUsername.toLowerCase().trim();
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

        // Check availability for each variation
        for (const variation of variations) {
            const isAvailable = await checkAvailability(variation);
            if (isAvailable) {
                suggestions.push(variation);
            }

            // Return up to 5 suggestions
            if (suggestions.length >= 5) {
                break;
            }
        }

        return suggestions;
    } catch (error) {
        console.error('Error generating username suggestions:', error);
        throw new Error('Failed to generate username suggestions');
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
                throw new Error(`Username can only be changed once every 30 days. Please wait ${remainingDays} more days.`);
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
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Failed to change username');
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
        return [];
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
        return null;
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
        return null;
    }
}

/**
 * Check if username is reserved (system usernames)
 */
function isReservedUsername(username: string): boolean {
    const reservedUsernames = [
        'admin', 'administrator', 'root', 'system', 'api', 'www', 'mail', 'email',
        'support', 'help', 'info', 'contact', 'about', 'terms', 'privacy',
        'security', 'login', 'register', 'signup', 'signin', 'auth', 'oauth',
        'profile', 'profiles', 'user', 'users', 'account', 'accounts',
        'dashboard', 'settings', 'config', 'configuration', 'test', 'testing',
        'dev', 'development', 'staging', 'production', 'prod', 'beta', 'alpha',
        'null', 'undefined', 'true', 'false', 'anonymous', 'guest'
    ];

    return reservedUsernames.includes(username.toLowerCase());
}

// Export the service interface implementation
export const usernameService: UsernameService = {
    checkAvailability,
    reserveUsername,
    getUserByUsername,
    generateSuggestions,
    changeUsername
};
