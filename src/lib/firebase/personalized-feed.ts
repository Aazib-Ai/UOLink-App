import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    startAfter,
    QueryDocumentSnapshot,
    DocumentData,
} from 'firebase/firestore';
import { db, auth } from './app';
import { mapNoteSnapshot } from './notes';
import type { Note, NotesQueryResult } from '../data/note-types';
import { getUserProfile } from './profiles';

export interface PersonalizedFeedOptions {
    pageSize?: number;
    lastDocSnapshot?: QueryDocumentSnapshot<DocumentData> | null;
    fallbackToGeneral?: boolean;
}

export interface FeedScore {
    note: Note;
    relevanceScore: number;
    matchReasons: string[];
}

/**
 * Calculate relevance score for a note based on user profile
 */
const calculateRelevanceScore = (note: Note, userProfile: any): { score: number; reasons: string[] } => {
    let score = 0;
    const reasons: string[] = [];

    // Base credibility score (0-100 points)
    const credibilityBonus = Math.min(note.credibilityScore * 2, 100);
    score += credibilityBonus;
    if (credibilityBonus > 20) reasons.push('High credibility');

    // Perfect matches (high priority)
    if (userProfile.major && note.contributorMajor === userProfile.major) {
        score += 150;
        reasons.push('Same major');
    }

    if (userProfile.semester && note.semester === userProfile.semester) {
        score += 100;
        reasons.push('Same semester');
    }

    if (userProfile.section && note.section === userProfile.section) {
        score += 80;
        reasons.push('Same section');
    }

    // Subject relevance (medium priority)
    // Notes from the same major tend to have relevant subjects
    if (userProfile.major && note.contributorMajor === userProfile.major) {
        score += 50; // Already counted above, but this is for subject relevance
    }

    // Temporal relevance - newer notes get slight boost
    const uploadedAtMs = note.uploadedAt
        ? (typeof (note.uploadedAt as any).toMillis === 'function'
            ? (note.uploadedAt as any).toMillis()
            : (note.uploadedAt instanceof Date
                ? note.uploadedAt.getTime()
                : 0))
        : 0;
    const daysSinceUpload = uploadedAtMs > 0
        ? (Date.now() - uploadedAtMs) / (1000 * 60 * 60 * 24)
        : 999;

    if (daysSinceUpload < 7) {
        score += 30;
        reasons.push('Recent upload');
    } else if (daysSinceUpload < 30) {
        score += 15;
        reasons.push('Recently uploaded');
    }

    // Engagement boost - popular notes
    const totalEngagement = (note.upvoteCount || 0) + (note.saveCount || 0);
    if (totalEngagement > 10) {
        score += 25;
        reasons.push('Popular content');
    } else if (totalEngagement > 5) {
        score += 10;
        reasons.push('Good engagement');
    }

    return { score, reasons };
};

/**
 * Get personalized notes feed for the current user
 */
export const getPersonalizedFeed = async (options: PersonalizedFeedOptions = {}): Promise<NotesQueryResult> => {
    const { pageSize = 9, lastDocSnapshot = null, fallbackToGeneral = true } = options;

    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User must be authenticated');
        }

        // Get user profile
        const userProfile = await getUserProfile(currentUser.uid);
        if (!userProfile) {
            throw new Error('User profile not found');
        }

        // Fetch a larger set of notes to score and filter
        const fetchSize = Math.max(pageSize * 4, 50); // Fetch 4x more to ensure good selection
        const notesCollection = collection(db, 'notes');

        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        constraints.push(limit(fetchSize));

        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);
        const allNotes = querySnapshot.docs.map(mapNoteSnapshot);

        // Score all notes
        const scoredNotes: FeedScore[] = allNotes.map(note => {
            const { score, reasons } = calculateRelevanceScore(note, userProfile);
            return {
                note,
                relevanceScore: score,
                matchReasons: reasons
            };
        });

        // Sort by relevance score
        scoredNotes.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Get top relevant notes
        const relevantNotes = scoredNotes.slice(0, pageSize);

        // If we don't have enough relevant notes and fallback is enabled
        if (relevantNotes.length < pageSize && fallbackToGeneral) {
            const needed = pageSize - relevantNotes.length;
            const remainingNotes = scoredNotes.slice(pageSize);

            // Add more notes sorted by credibility + recency
            const fallbackNotes = remainingNotes
                .sort((a, b) => {
                    const aScore = a.note.credibilityScore + (a.matchReasons.includes('Recent upload') ? 50 : 0);
                    const bScore = b.note.credibilityScore + (b.matchReasons.includes('Recent upload') ? 50 : 0);
                    return bScore - aScore;
                })
                .slice(0, needed);

            relevantNotes.push(...fallbackNotes);
        }

        const notes = relevantNotes.map(scored => scored.note);
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        const hasMore = querySnapshot.docs.length === fetchSize;

        return {
            notes,
            lastDocSnapshot: lastDoc,
            hasMore
        };

    } catch (error) {
        console.error("Error fetching personalized feed:", error);
        throw error;
    }
};

/**
 * Get personalized feed with specific filters applied
 */
export const getPersonalizedFeedWithFilters = async (
    filters: any = {},
    options: PersonalizedFeedOptions = {}
): Promise<NotesQueryResult> => {
    const { pageSize = 9, fallbackToGeneral = true } = options;

    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User must be authenticated');
        }

        const userProfile = await getUserProfile(currentUser.uid);
        if (!userProfile) {
            throw new Error('User profile not found');
        }

        // Build query with filters
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        // Apply filters
        if (filters.semester) {
            constraints.push(where('semester', '==', filters.semester));
        }
        if (filters.subject) {
            constraints.push(where('subject', '==', filters.subject));
        }
        if (filters.teacher) {
            constraints.push(where('teacher', '==', filters.teacher));
        }
        if (filters.section) {
            constraints.push(where('section', '==', filters.section));
        }
        if (filters.materialType) {
            constraints.push(where('materialType', '==', filters.materialType));
        }

        // Fetch more to allow for personalization
        constraints.push(limit(pageSize * 3));

        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);
        const allNotes = querySnapshot.docs.map(mapNoteSnapshot);

        // Score and sort
        const scoredNotes: FeedScore[] = allNotes.map(note => {
            const { score, reasons } = calculateRelevanceScore(note, userProfile);
            return {
                note,
                relevanceScore: score,
                matchReasons: reasons
            };
        });

        scoredNotes.sort((a, b) => b.relevanceScore - a.relevanceScore);
        const notes = scoredNotes.slice(0, pageSize).map(scored => scored.note);

        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        const hasMore = querySnapshot.docs.length === pageSize * 3;

        return {
            notes,
            lastDocSnapshot: lastDoc,
            hasMore: hasMore && notes.length === pageSize
        };

    } catch (error) {
        console.error("Error fetching personalized filtered feed:", error);
        throw error;
    }
};

/**
 * Get feed explanation for debugging/transparency
 */
export const getFeedExplanation = async (noteId: string): Promise<{ score: number; reasons: string[] } | null> => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return null;

        const userProfile = await getUserProfile(currentUser.uid);
        if (!userProfile) return null;

        // This would need to fetch the specific note, but for now return null
        // In a real implementation, you'd fetch the note and calculate its score
        return null;
    } catch (error) {
        console.error("Error getting feed explanation:", error);
        return null;
    }
};
