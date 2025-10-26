import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export type { Note, NotesQueryResult } from './note-types';

export interface CommentRecord {
    id: string;
    text: string;
    userId: string;
    userEmail: string;
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
