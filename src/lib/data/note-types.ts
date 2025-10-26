import type { QueryDocumentSnapshot, DocumentData, Timestamp } from 'firebase/firestore';

export interface Note {
    id: string;
    subject: string;
    module: string;
    teacher: string;
    semester: string;
    section: string;
    materialType: string;
    materialSequence: string | null;
    contributorName: string;
    contributorDisplayName?: string;
    uploaderUsername?: string | null;
    contributorMajor: string;
    name: string;
    uploadedBy: string;
    uploadedAt: Timestamp | Date | null;
    upvoteCount: number;
    downvoteCount: number;
    saveCount: number;
    reportCount: number;
    credibilityScore: number;
    fileUrl: string;
    rawFileUrl?: string;
    storageProvider?: string;
    storageBucket?: string;
    storageKey?: string;
    metadata?: {
        createdBy: string | null;
        createdAt: string;
    };
    [key: string]: any;
}

export interface NotesQueryResult {
    notes: Note[];
    lastDocSnapshot: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}
