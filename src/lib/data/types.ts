import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export type { Note, NotesQueryResult } from './note-types';

export interface CommentRecord {
    id: string;
    text: string;
    userId: string;
    emailPrefix?: string;
    userPhotoURL?: string;
    userName?: string;
    userDisplayName?: string;
    userUsername?: string;
    createdAt: Date;
    updatedAt: Date;
    likes: number;
    replyCount: number;
}

export type CommentReplyRecord = Omit<CommentRecord, 'replyCount'>;

export interface UserProfile {
    id: string;
    fullName?: string;
    username?: string;                    // Unique username (technical identifier)
    usernameLastChanged?: Date;          // For cooldown enforcement
    major?: string;
    semester?: string | number;
    section?: string;
    bio?: string;
    about?: string;
    skills?: string[];
    githubUrl?: string;
    linkedinUrl?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    profilePicture?: string | null;
    profilePictureStorageKey?: string | null;
    profileCompleted?: boolean;
    aura?: number;
    noteCount?: number;                   // Denormalized count (alias for notesCount)
    notesCount?: number;                  // Denormalized count of notes contributed (legacy)
    totalNotes?: number;                  // Denormalized count of notes contributed
    totalUpvotes?: number;               // Denormalized total upvotes across all notes
    totalSaves?: number;                 // Denormalized total saves across all notes
    totalDownvotes?: number;             // Denormalized total downvotes across all notes
    totalReports?: number;               // Denormalized total reports across all notes
    averageCredibility?: number;         // Rolling average credibility across notes
    lastStatsUpdate?: any;               // Timestamp of last stats update
    topNotes?: Array<{                   // Denormalized last 5 notes preview
        id: string;
        name: string;
        subject?: string;
        uploadedAt?: any;
        fileUrl?: string;
    }>;
    [key: string]: unknown;
}

export interface NoteScoreInputs {
    upvotes?: number;
    saves?: number;
    downvotes?: number;
    reports?: number;
}

export interface NoteScoreState {
    upvoteCount: number;
    downvoteCount: number;
    saveCount: number;
    reportCount: number;
}

export interface VoteOnNoteResult {
    upvotes: number;
    downvotes: number;
    userVote: 'up' | 'down' | null;
    credibilityScore: number;
}

export interface ToggleSaveNoteResult {
    saved: boolean;
    saveCount: number;
    credibilityScore: number;
}

export interface CommentsPageResult {
    comments: CommentRecord[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}
