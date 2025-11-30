import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    where,
} from 'firebase/firestore';
import { db } from './app';
import { toNumber } from '../data/common';
import { UserProfile } from '../data/types';
import { getUserByUsernameOnly } from './profile-resolver';
import { usernameCache } from '../cache/username-cache';
import { syncUserProfileReferences } from './profile-sync';
import { cacheQuery } from '@/lib/cache/query-cache'

export const getAuraLeaderboard = async (limitCount = 20) => {
    const safeLimit = Math.max(limitCount, 1)
    return await cacheQuery('leaderboard', { limit: safeLimit }, async () => {
        const profilesCollection = collection(db, 'profiles')
        const leaderboardQuery = query(profilesCollection, orderBy('aura', 'desc'), limit(safeLimit))
        const snapshot = await getDocs(leaderboardQuery)
        return snapshot.docs.map((profileDoc) => {
            const data = profileDoc.data()
            return { id: profileDoc.id, ...data, aura: toNumber(data.aura) }
        })
    }, { ttlMs: 5 * 60 * 1000, tags: ['leaderboard'] })
}

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
        const profileRef = doc(db, 'profiles', userId);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
            return {
                id: profileSnap.id,
                ...profileSnap.data()
            } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
};

/**
 * Get user profile by name/identifier (DEPRECATED - use getUserByUsername instead)
 * @deprecated Use getUserByUsername from profile-resolver instead
 */
export const getUserProfileByName = async (identifier: string): Promise<UserProfile | null> => {
    console.warn('getUserProfileByName is deprecated. Use getUserByUsername from profile-resolver instead.');

    try {
        const normalizedInput = (identifier ?? '').trim();
        if (!normalizedInput) {
            return null;
        }

        // Use clean username-only lookup (new system)
        return await getUserByUsernameOnly(normalizedInput);
    } catch (error) {
        console.error("Error fetching user profile by name:", error);
        return null;
    }
};

/**
 * Update user profile with username information
 */
export const updateProfileUsername = async (userId: string, username: string): Promise<void> => {
    try {
        const profileRef = doc(db, 'profiles', userId);
        await updateDoc(profileRef, {
            username: username,
            usernameLastChanged: Timestamp.now()
        });
        const profileSnapshot = await getDoc(profileRef);
        const profileData = profileSnapshot.exists() ? profileSnapshot.data() : undefined;

        // Invalidate cache entries for this user
        usernameCache.invalidateByUserId(userId);

        // Also invalidate the specific username entry
        usernameCache.invalidate(username);

        void syncUserProfileReferences({
            userId,
            username,
            fullName: typeof profileData?.fullName === 'string' ? profileData.fullName : undefined,
        }).catch((syncError) => {
            console.error('[ProfileSync] Failed to update related records after username change', syncError);
        });
    } catch (error) {
        console.error('Error updating profile username:', error);
        throw error;
    }
};

/**
 * Get user profile by username (direct lookup)
 */
export const getUserProfileByUsername = async (username: string): Promise<UserProfile | null> => {
    return await getUserByUsernameOnly(username);
};

/**
 * Get user profile by full name
 * This is used to resolve contributor names (full names) to usernames for profile linking
 */
export const getUserProfileByFullName = async (fullName: string): Promise<UserProfile | null> => {
    try {
        const normalizedFullName = (fullName ?? '').trim();
        if (!normalizedFullName) {
            return null;
        }

        const profilesCollection = collection(db, 'profiles');
        const profileQuery = query(
            profilesCollection,
            where('fullName', '==', normalizedFullName),
            limit(1)
        );

        const snapshot = await getDocs(profileQuery);

        if (snapshot.empty) {
            return null;
        }

        const profileDoc = snapshot.docs[0];
        return {
            id: profileDoc.id,
            ...profileDoc.data()
        } as UserProfile;
    } catch (error) {
        console.error('Error fetching user profile by full name:', error);
        return null;
    }
};
