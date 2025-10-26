import {
    collection,
    doc,
    getDoc,
    setDoc,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    writeBatch,
    Timestamp
} from 'firebase/firestore';
import { db } from './app';

// Username collection schema interfaces
export interface UsernameRecord {
    id: string;           // username (lowercase)
    userId: string;       // Firebase Auth UID
    displayUsername: string; // Original case username
    createdAt: Timestamp;
    updatedAt: Timestamp;
    isActive: boolean;
}

export interface UsernameHistoryRecord {
    id: string;           // auto-generated
    userId: string;       // Firebase Auth UID
    oldUsername: string;
    oldUsernameLower?: string;
    newUsername: string;
    changedAt: Timestamp;
    aliasExpiresAt: Timestamp;
}

// Collection references
export const usernamesCollection = collection(db, 'usernames');
export const usernameHistoryCollection = collection(db, 'username_history');

/**
 * Initialize database indexes for username collections
 * This function documents the required indexes that should be created in Firebase Console
 * or via Firebase CLI/Admin SDK
 */
export function getRequiredIndexes() {
    return {
        usernames: [
            // Single field indexes (automatically created by Firestore)
            { field: 'userId', order: 'asc' },
            { field: 'isActive', order: 'asc' },
            { field: 'createdAt', order: 'desc' },

            // Compound indexes (need to be created manually)
            {
                name: 'username_userId_isActive',
                fields: [
                    { field: 'userId', order: 'asc' },
                    { field: 'isActive', order: 'asc' }
                ]
            },
            {
                name: 'isActive_createdAt',
                fields: [
                    { field: 'isActive', order: 'asc' },
                    { field: 'createdAt', order: 'desc' }
                ]
            }
        ],
        username_history: [
            // Single field indexes
            { field: 'userId', order: 'asc' },
            { field: 'changedAt', order: 'desc' },
            { field: 'aliasExpiresAt', order: 'asc' },

            // Compound indexes
            {
                name: 'userId_changedAt',
                fields: [
                    { field: 'userId', order: 'asc' },
                    { field: 'changedAt', order: 'desc' }
                ]
            },
            {
                name: 'aliasExpiresAt_oldUsername',
                fields: [
                    { field: 'aliasExpiresAt', order: 'asc' },
                    { field: 'oldUsername', order: 'asc' }
                ]
            }
        ]
    };
}

/**
 * Create indexes programmatically (requires Admin SDK in server environment)
 * This is for documentation purposes - indexes should be created via Firebase Console
 */
export function getFirebaseIndexCommands() {
    return [
        // Username collection indexes
        'firebase firestore:indexes --project YOUR_PROJECT_ID',

        // Add these to firestore.indexes.json:
        `
{
  "indexes": [
    {
      "collectionGroup": "usernames",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "usernames", 
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "username_history",
      "queryScope": "COLLECTION", 
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "changedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "username_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aliasExpiresAt", "order": "ASCENDING" },
        { "fieldPath": "oldUsername", "order": "ASCENDING" }
      ]
    }
  ]
}
        `
    ];
}

// Basic CRUD operations for username records
export async function getUsernameRecord(username: string): Promise<UsernameRecord | null> {
    try {
        const docRef = doc(usernamesCollection, username.toLowerCase());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as UsernameRecord;
        }
        return null;
    } catch (error) {
        console.error('Error fetching username record:', error);
        throw error;
    }
}

export async function createUsernameRecord(record: Omit<UsernameRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
        const now = Timestamp.now();
        const docRef = doc(usernamesCollection, record.id.toLowerCase());

        await setDoc(docRef, {
            ...record,
            id: record.id.toLowerCase(),
            createdAt: now,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error creating username record:', error);
        throw error;
    }
}

export async function getUsernamesByUserId(userId: string): Promise<UsernameRecord[]> {
    try {
        const q = query(
            usernamesCollection,
            where('userId', '==', userId),
            where('isActive', '==', true),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as UsernameRecord);
    } catch (error) {
        console.error('Error fetching usernames by userId:', error);
        throw error;
    }
}

export async function addUsernameHistoryRecord(record: Omit<UsernameHistoryRecord, 'id' | 'changedAt'>): Promise<void> {
    try {
        const docRef = doc(usernameHistoryCollection);

        await setDoc(docRef, {
            ...record,
            id: docRef.id,
            oldUsernameLower: record.oldUsername.toLowerCase(),
            changedAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error adding username history record:', error);
        throw error;
    }
}

export async function getUsernameHistory(userId: string, limitCount: number = 10): Promise<UsernameHistoryRecord[]> {
    try {
        const q = query(
            usernameHistoryCollection,
            where('userId', '==', userId),
            orderBy('changedAt', 'desc'),
            limit(limitCount)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.data() as UsernameHistoryRecord);
    } catch (error) {
        console.error('Error fetching username history:', error);
        throw error;
    }
}
