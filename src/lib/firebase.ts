import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { normalizeForStorage, slugify, toTitleCase } from "./utils";
import { buildR2PublicUrlFromBase, deriveR2ObjectKey, isR2LikeHost } from "./r2-shared";

import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    query,
    orderBy,
    limit,
    where,
    startAfter,
    serverTimestamp,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    onSnapshot,
    runTransaction,
    increment,
} from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot, Transaction } from 'firebase/firestore';

export interface CommentRecord {
    id: string;
    text: string;
    userId: string;
    userEmail: string;
    userPhotoURL?: string;
    userName?: string;
    createdAt: Date;
    updatedAt: Date;
    likes: number;
    replyCount: number;
}

export type CommentReplyRecord = Omit<CommentRecord, 'replyCount'>;

export interface UserProfile {
    id: string;
    fullName?: string;
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
    profileSlug?: string;
    fullNameLower?: string;
    aura?: number;
    [key: string]: unknown;
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

type ServerTimestamp = ReturnType<typeof serverTimestamp>;

interface NoteScoreInputs {
    upvotes?: number;
    saves?: number;
    downvotes?: number;
    reports?: number;
}

interface NoteScoreState {
    upvoteCount: number;
    downvoteCount: number;
    saveCount: number;
    reportCount: number;
}

const toNumber = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;

const clampNonNegative = (value: number): number => (value < 0 ? 0 : value);

const computeVibeScore = (counts: NoteScoreInputs): number => (
    (toNumber(counts.upvotes) * 2) +
    (toNumber(counts.saves) * 5) -
    (toNumber(counts.downvotes) * 3) -
    (toNumber(counts.reports) * 10)
);

const readNoteScoreState = (data: DocumentData | undefined): NoteScoreState => ({
    upvoteCount: clampNonNegative(toNumber(data?.upvoteCount)),
    downvoteCount: clampNonNegative(toNumber(data?.downvoteCount)),
    saveCount: clampNonNegative(toNumber(data?.saveCount)),
    reportCount: clampNonNegative(toNumber(data?.reportCount)),
});

const buildNoteScoreUpdate = (
    base: NoteScoreState,
    overrides: Partial<NoteScoreState>,
    timestamp: ServerTimestamp
) => {
    const upvoteCount = clampNonNegative(overrides.upvoteCount ?? base.upvoteCount);
    const downvoteCount = clampNonNegative(overrides.downvoteCount ?? base.downvoteCount);
    const saveCount = clampNonNegative(overrides.saveCount ?? base.saveCount);
    const reportCount = clampNonNegative(overrides.reportCount ?? base.reportCount);

    return {
        upvoteCount,
        downvoteCount,
        saveCount,
        reportCount,
        vibeScore: computeVibeScore({
            upvotes: upvoteCount,
            saves: saveCount,
            downvotes: downvoteCount,
            reports: reportCount,
        }),
        vibeUpdatedAt: timestamp,
        lastInteractionAt: timestamp,
    };
};

const queueAuraAdjustment = (
    transaction: Transaction,
    userId: string | undefined,
    auraDelta: number,
    timestamp: ServerTimestamp
) => {
    if (!userId || !Number.isFinite(auraDelta) || auraDelta === 0) {
        return;
    }

    const profileRef = doc(db, 'profiles', userId);
    transaction.set(
        profileRef,
        {
            aura: increment(auraDelta),
            auraUpdatedAt: timestamp,
        },
        { merge: true }
    );
};

const r2PublicBaseUrl = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    process.env.CLOUDFLARE_R2_PUBLIC_BASE_URL ||
    ''
).trim();

const resolveNoteFileMetadata = (data: DocumentData) => {
    const originalUrl = typeof data.fileUrl === 'string' ? data.fileUrl : undefined;
    const storedProvider = typeof data.storageProvider === 'string' ? data.storageProvider : undefined;
    const bucketName =
        typeof data.storageBucket === 'string'
            ? data.storageBucket
            : (process.env.CLOUDFLARE_R2_BUCKET_NAME || undefined);

    const isLikelyR2 =
        storedProvider === 'cloudflare-r2' ||
        (originalUrl ? (() => {
            try {
                return isR2LikeHost(new URL(originalUrl).hostname.toLowerCase());
            } catch {
                return false;
            }
        })() : false);

    let storageKey =
        typeof data.storageKey === 'string' && data.storageKey.trim()
            ? data.storageKey.trim()
            : undefined;

    if (!storageKey && originalUrl) {
        storageKey = deriveR2ObjectKey(originalUrl, bucketName) || undefined;
    }

    let resolvedUrl = originalUrl;

    if (isLikelyR2 && storageKey && r2PublicBaseUrl) {
        try {
            resolvedUrl = buildR2PublicUrlFromBase({
                baseUrl: r2PublicBaseUrl,
                objectKey: storageKey,
            });
        } catch {
            // If construction fails, fall back to whatever we already have
        }
    }

    return {
        resolvedUrl,
        storageKey,
        storageProvider: isLikelyR2 ? 'cloudflare-r2' : storedProvider,
        storageBucket: bucketName ?? data.storageBucket,
    };
};

const mapNoteSnapshot = (doc: QueryDocumentSnapshot<DocumentData>) => {
    const data = doc.data();
    const { resolvedUrl, storageKey, storageProvider, storageBucket } = resolveNoteFileMetadata(data);
    const scoreState = readNoteScoreState(data);
    const vibeScore =
        typeof data.vibeScore === 'number' && Number.isFinite(data.vibeScore)
            ? data.vibeScore
            : computeVibeScore({
                upvotes: scoreState.upvoteCount,
                saves: scoreState.saveCount,
                downvotes: scoreState.downvoteCount,
                reports: scoreState.reportCount,
            });

    return {
        id: doc.id,
        ...data,
        storageProvider: storageProvider ?? data.storageProvider,
        storageBucket,
        storageKey: storageKey ?? data.storageKey,
        fileUrl: resolvedUrl ?? (typeof data.fileUrl === 'string' ? data.fileUrl : ''),
        rawFileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : undefined,
        subject: data.subject || '',
        module: data.module || '',
        teacher: data.teacher || data.module || '',
        semester: data.semester || '',
        section: data.section || '',
        materialType: data.materialType || '',
        materialSequence: data.materialSequence ?? null,
        contributorName: data.contributorName || '',
        contributorMajor: data.contributorMajor || '',
        name: data.name || '',
        uploadedBy: data.uploadedBy || '',
        uploadedAt: data.uploadedAt || null,
        upvoteCount: scoreState.upvoteCount,
        downvoteCount: scoreState.downvoteCount,
        saveCount: scoreState.saveCount,
        reportCount: scoreState.reportCount,
        vibeScore,
    };
};

const addNote = async (noteData: any) => {
    try {
        // Validate input
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to add a note');
        }

        // Ensure all required fields are present
        if (!noteData.name || !noteData.semester || !noteData.subject) {
            throw new Error('Missing required note details');
        }

        const notesCollection = collection(db, 'notes');
        const noteRef = doc(notesCollection);
        const timestamp = serverTimestamp();
        const metadataCreatedAt = new Date().toISOString();
        const uploaderId = auth.currentUser.uid;
        const normalizedTeacher = normalizeForStorage(noteData.teacher || noteData.module || '');

        await runTransaction(db, async (transaction) => {
            transaction.set(noteRef, {
                ...noteData,
                subject: normalizeForStorage(noteData.subject), // Store subject in lowercase
                teacher: normalizedTeacher, // Store teacher in lowercase
                module: normalizedTeacher, // Legacy module field for backward compatibility
                contributorName: noteData.contributorName, // Keep contributor name as-is
                uploadedBy: uploaderId, // Explicitly add user ID
                uploadedAt: timestamp, // Use server-side timestamp
                upvoteCount: 0,
                downvoteCount: 0,
                saveCount: 0,
                reportCount: 0,
                vibeScore: 0,
                vibeUpdatedAt: timestamp,
                lastInteractionAt: timestamp,
                metadata: {
                    createdBy: auth.currentUser.email, // Optional: add email for reference
                    createdAt: metadataCreatedAt
                }
            });

            queueAuraAdjustment(transaction, uploaderId, 10, timestamp);
        });

        console.log('Note added with ID: ', noteRef.id);
        return noteRef;
    } catch (error) {
        console.error("Error adding note: ", error);

        // More detailed error handling
        if (error instanceof Error && 'code' in error) {
            const firebaseError = error as any;
            if (firebaseError.code === 'permission-denied') {
                console.error('Permission denied. Check Firestore security rules.');
            }
        }

        throw error;
    }
};

// Function to get notes with pagination and filtering
const getNotesWithPagination = async (pageSize = 10, lastDocSnapshot = null, filters: any = {}) => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        // Add filter constraints if provided
        if (filters.semester && filters.semester !== '') {
            constraints.push(where('semester', '==', filters.semester));
        }
        if (filters.subject && filters.subject !== '') {
            constraints.push(where('subject', '==', filters.subject));
        }
        if (filters.teacher && filters.teacher !== '') {
            constraints.push(where('teacher', '==', filters.teacher));
        }
        if (filters.contributorName && filters.contributorName !== '') {
            constraints.push(where('contributorName', '==', filters.contributorName));
        }
        if (filters.section && filters.section !== '') {
            constraints.push(where('section', '==', filters.section));
        }
        if (filters.materialType && filters.materialType !== '') {
            constraints.push(where('materialType', '==', filters.materialType));
        }
        if (filters.materialSequence && filters.materialSequence !== '') {
            constraints.push(where('materialSequence', '==', filters.materialSequence));
        }

        // Add pagination
        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        constraints.push(limit(pageSize));

        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);

        const notes = querySnapshot.docs.map(mapNoteSnapshot);

        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        const hasMore = querySnapshot.docs.length === pageSize;

        return {
            notes,
            lastDocSnapshot: lastDoc,
            hasMore
        };
    } catch (error) {
        console.error("Error fetching notes with pagination: ", error);
        throw error;
    }
};

// Function to get all notes with filters (no pagination - for filtered results)
const getAllNotesWithFilters = async (filters: any = {}, searchTerm = '') => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        // For better filtering, we'll fetch all notes and do client-side filtering
        // This ensures case-insensitive matching and better search functionality
        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);

        let notes = querySnapshot.docs.map(mapNoteSnapshot);

        // Apply filters client-side with lowercase comparison
        if (filters.semester && filters.semester !== '') {
            notes = notes.filter(note =>
                note.semester && note.semester.toString() === filters.semester.toString()
            );
        }

        if (filters.subject && filters.subject !== '') {
            const normalizedSubject = normalizeForStorage(filters.subject);
            notes = notes.filter(note =>
                normalizeForStorage(note.subject) === normalizedSubject
            );
        }

        if (filters.teacher && filters.teacher !== '') {
            const normalizedTeacher = normalizeForStorage(filters.teacher);
            notes = notes.filter(note =>
                normalizeForStorage(note.teacher || '') === normalizedTeacher
            );
        }

        if (filters.uploadedBy && filters.uploadedBy !== '') {
            const uploaderId = filters.uploadedBy.trim();
            notes = notes.filter(note => (note.uploadedBy || '').trim() === uploaderId);
        }

        if (filters.contributorName && filters.contributorName !== '') {
            const normalizedContributor = normalizeForStorage(filters.contributorName);
            notes = notes.filter(note =>
                normalizeForStorage(note.contributorName || '') === normalizedContributor
            );
        }

        if (filters.section && filters.section !== '') {
            const normalizedSection = filters.section.trim().toUpperCase();
            notes = notes.filter(note =>
                (note.section || '').toString().trim().toUpperCase() === normalizedSection
            );
        }

        if (filters.contributorMajor && filters.contributorMajor !== '') {
            const normalizedMajor = normalizeForStorage(filters.contributorMajor);
            notes = notes.filter(note =>
                normalizeForStorage(note.contributorMajor || '') === normalizedMajor
            );
        }

        if (filters.materialType && filters.materialType !== '') {
            const normalizedType = normalizeForStorage(filters.materialType);
            notes = notes.filter(note =>
                normalizeForStorage(note.materialType || '') === normalizedType
            );
        }

        if (filters.materialSequence && filters.materialSequence !== '') {
            const normalizedSequence = filters.materialSequence.trim();
            notes = notes.filter(note =>
                (note.materialSequence ?? '').toString().trim() === normalizedSequence
            );
        }

        // Client-side filtering for search if search term is provided
        if (searchTerm && searchTerm.trim() !== '') {
            const searchLower = searchTerm.toLowerCase();
            notes = notes.filter(note =>
                (note.subject?.toLowerCase() || '').includes(searchLower) ||
                (note.contributorName?.toLowerCase() || '').includes(searchLower) ||
                (note.name?.toLowerCase() || '').includes(searchLower)
            );
        }

        return {
            notes,
            lastDocSnapshot: null,
            hasMore: false // No pagination for filtered results
        };
    } catch (error) {
        console.error("Error fetching all filtered notes: ", error);
        throw error;
    }
};

interface VoteOnNoteResult {
    upvotes: number;
    downvotes: number;
    userVote: 'up' | 'down' | null;
    vibeScore: number;
}

const voteOnNote = async (noteId: string, voteType: 'up' | 'down'): Promise<VoteOnNoteResult> => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to vote on a note');
    }

    const voterId = auth.currentUser.uid;
    const noteRef = doc(db, 'notes', noteId);
    const noteVoteRef = doc(db, 'noteVotes', noteId);
    const userVoteRef = doc(db, 'userVotes', voterId, 'votes', noteId);

    return await runTransaction(db, async (transaction) => {
        const noteSnap = await transaction.get(noteRef);
        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const noteVoteSnap = await transaction.get(noteVoteRef);
        const userVoteSnap = await transaction.get(userVoteRef);

        const timestamp = serverTimestamp();
        const noteData = noteSnap.data();
        const scoreState = readNoteScoreState(noteData);
        let upvotes = clampNonNegative(toNumber(noteVoteSnap.data()?.upvotes));
        let downvotes = clampNonNegative(toNumber(noteVoteSnap.data()?.downvotes));
        const storedVote = (userVoteSnap.exists() ? userVoteSnap.data()?.voteType : null) as ('up' | 'down' | null);
        let auraDelta = 0;
        let nextVote: 'up' | 'down' | null = voteType;

        if (storedVote === voteType) {
            // Remove existing vote
            if (voteType === 'up') {
                upvotes = clampNonNegative(upvotes - 1);
                auraDelta -= 2;
            } else {
                downvotes = clampNonNegative(downvotes - 1);
                auraDelta += 3;
            }
            transaction.delete(userVoteRef);
            nextVote = null;
        } else {
            // Remove previous vote if switching
            if (storedVote === 'up') {
                upvotes = clampNonNegative(upvotes - 1);
                auraDelta -= 2;
            } else if (storedVote === 'down') {
                downvotes = clampNonNegative(downvotes - 1);
                auraDelta += 3;
            }

            if (voteType === 'up') {
                upvotes += 1;
                auraDelta += 2;
            } else {
                downvotes += 1;
                auraDelta -= 3;
            }

            transaction.set(
                userVoteRef,
                {
                    noteId,
                    voteType,
                    votedAt: timestamp
                },
                { merge: true }
            );
        }

        transaction.set(
            noteVoteRef,
            {
                upvotes,
                downvotes,
                updatedAt: timestamp
            },
            { merge: true }
        );

        const noteScoreUpdate = buildNoteScoreUpdate(
            scoreState,
            { upvoteCount: upvotes, downvoteCount: downvotes },
            timestamp
        );

        transaction.set(noteRef, noteScoreUpdate, { merge: true });

        const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined;
        queueAuraAdjustment(transaction, uploaderId, auraDelta, timestamp);

        return {
            upvotes,
            downvotes,
            userVote: nextVote,
            vibeScore: noteScoreUpdate.vibeScore
        };
    });
};

interface ToggleSaveNoteResult {
    saved: boolean;
    saveCount: number;
    vibeScore: number;
}

const toggleSaveNote = async (noteId: string): Promise<ToggleSaveNoteResult> => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to save notes');
    }

    const userId = auth.currentUser.uid;
    const noteRef = doc(db, 'notes', noteId);
    const userSaveRef = doc(db, 'users', userId, 'savedNotes', noteId);

    return await runTransaction(db, async (transaction) => {
        const noteSnap = await transaction.get(noteRef);
        if (!noteSnap.exists()) {
            throw new Error('Note not found');
        }

        const saveSnap = await transaction.get(userSaveRef);
        const timestamp = serverTimestamp();
        const noteData = noteSnap.data();
        const scoreState = readNoteScoreState(noteData);

        let saveCount = scoreState.saveCount;
        let auraDelta = 0;
        let saved = false;

        if (saveSnap.exists()) {
            saveCount = clampNonNegative(saveCount - 1);
            transaction.delete(userSaveRef);
            auraDelta -= 5;
            saved = false;
        } else {
            saveCount = saveCount + 1;
            transaction.set(userSaveRef, {
                noteId,
                savedAt: timestamp
            });
            auraDelta += 5;
            saved = true;
        }

        const noteScoreUpdate = buildNoteScoreUpdate(
            scoreState,
            { saveCount },
            timestamp
        );

        transaction.set(noteRef, noteScoreUpdate, { merge: true });

        const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined;
        queueAuraAdjustment(transaction, uploaderId, auraDelta, timestamp);

        return {
            saved,
            saveCount: noteScoreUpdate.saveCount,
            vibeScore: noteScoreUpdate.vibeScore
        };
    });
};

// Function to get initial notes (first 9)
const getInitialNotes = async () => {
    return await getNotesWithPagination(9, null, {});
};

// Function to search notes by title/contributor name
const searchNotes = async (searchTerm: string, pageSize = 20, lastDocSnapshot = null) => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        // Note: Firestore doesn't support contains queries easily, so we'll do this client-side
        // For now, we'll fetch more data and filter on client side for search
        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        constraints.push(limit(pageSize * 3)); // Fetch more to compensate for client-side filtering

        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);

        let allNotes = querySnapshot.docs.map(mapNoteSnapshot);

        // Client-side filtering for search
        if (searchTerm && searchTerm.trim() !== '') {
            const searchLower = searchTerm.toLowerCase();
            allNotes = allNotes.filter(note =>
                (note.subject?.toLowerCase() || '').includes(searchLower) ||
                (note.teacher?.toLowerCase() || '').includes(searchLower) ||
                (note.contributorName?.toLowerCase() || '').includes(searchLower) ||
                (note.materialType?.toLowerCase() || '').includes(searchLower) ||
                (note.section?.toLowerCase() || '').includes(searchLower) ||
                (note.name?.toLowerCase() || '').includes(searchLower)
            );
        }

        // Take only the requested page size
        const notes = allNotes.slice(0, pageSize);
        const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
        const hasMore = querySnapshot.docs.length === pageSize * 3;

        return {
            notes,
            lastDocSnapshot: lastDoc,
            hasMore: hasMore && notes.length === pageSize
        };
    } catch (error) {
        console.error("Error searching notes: ", error);
        throw error;
    }
};

// Function to get unique filter values (for dropdowns)
const getFilterOptions = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const q = query(notesCollection, orderBy('uploadedAt', 'desc'), limit(1000)); // Limit to reduce load
        const querySnapshot = await getDocs(q);

        const notes = querySnapshot.docs.map(mapNoteSnapshot);

        const semesters = [...new Set(notes.map(note => note.semester).filter(Boolean))];

        // Deduplicate subjects by normalizing to lowercase
        const subjectMap = new Map();
        notes.forEach(note => {
            if (note.subject) {
                const normalizedSubject = normalizeForStorage(note.subject);
                if (!subjectMap.has(normalizedSubject)) {
                    subjectMap.set(normalizedSubject, normalizedSubject); // Store the normalized version
                }
            }
        });
        const subjects = Array.from(subjectMap.values());

        // Sort subjects and move "not mentioned" to the bottom
        const sortedSubjects = subjects.filter(subject => subject !== 'not mentioned').sort();
        if (subjects.includes('not mentioned')) {
            sortedSubjects.push('not mentioned');
        }

        // Deduplicate teachers by normalizing to lowercase
        const teacherMap = new Map();
        notes.forEach(note => {
            const teacherValue = note.teacher || '';
            if (teacherValue) {
                const normalizedTeacher = normalizeForStorage(teacherValue);
                if (!teacherMap.has(normalizedTeacher)) {
                    teacherMap.set(normalizedTeacher, normalizedTeacher); // Store the normalized version
                }
            }
        });
        const teachers = Array.from(teacherMap.values());

        const sections = [...new Set(notes
            .map(note => (note.section || '').toString().trim().toUpperCase())
            .filter(Boolean))].sort();

        const materialTypeOrder = [
            'assignment',
            'quiz',
            'lecture',
            'slides',
            'midterm-notes',
            'final-term-notes',
            'books',
        ];

        const materialTypeSet = new Set<string>();
        notes.forEach(note => {
            if (note.materialType) {
                materialTypeSet.add(normalizeForStorage(note.materialType));
            }
        });

        const orderedMaterialTypes = materialTypeOrder.filter(type => materialTypeSet.has(type));
        const leftoverMaterialTypes = [...materialTypeSet].filter(type => !materialTypeOrder.includes(type)).sort();
        const materialTypes = [...orderedMaterialTypes, ...leftoverMaterialTypes];

        const materialSequences = [...new Set(notes
            .map(note => (note.materialSequence ?? '').toString().trim())
            .filter(Boolean))].sort((a, b) => Number(a) - Number(b));

        return {
            semesters: semesters.sort(),
            subjects: sortedSubjects, // Already normalized to lowercase with "not mentioned" at bottom
            teachers: teachers.sort(), // Already normalized to lowercase
            sections,
            materialTypes,
            materialSequences,
        };
    } catch (error) {
        console.error("Error fetching filter options: ", error);
        throw error;
    }
};

// Function to get total notes count
const getTotalNotesCount = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const querySnapshot = await getDocs(notesCollection);
        return querySnapshot.size;
    } catch (error) {
        console.error("Error getting total notes count: ", error);
        return 0;
    }
};

// Function to get all notes (keeping for backward compatibility)
const getNotes = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const q = query(notesCollection, orderBy('uploadedAt', 'desc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(mapNoteSnapshot);
    } catch (error) {
        console.error("Error fetching notes: ", error);
        throw error;
    }
};

// Comment functions
const addComment = async (noteId: string, commentData: any) => {
    try {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to add a comment');
        }

        const commentsCollection = collection(db, 'notes', noteId, 'comments');
        const docRef = await addDoc(commentsCollection, {
            ...commentData,
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            userPhotoURL: auth.currentUser.photoURL,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            likes: 0,
            replyCount: 0
        });

        console.log('Comment added with ID: ', docRef.id);
        return docRef;
    } catch (error) {
        console.error("Error adding comment: ", error);
        throw error;
    }
};

const readString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const readNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const mapCommentDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): CommentRecord => {
    const data = snapshot.data() ?? {};

    const text = readString((data as Record<string, unknown>).text) ?? '';
    const userId = readString((data as Record<string, unknown>).userId) ?? '';
    const userEmail = readString((data as Record<string, unknown>).userEmail) ?? '';

    return {
        id: snapshot.id,
        text,
        userId,
        userEmail,
        userPhotoURL: readString((data as Record<string, unknown>).userPhotoURL),
        userName: readString((data as Record<string, unknown>).userName),
        likes: readNumber((data as Record<string, unknown>).likes) ?? 0,
        replyCount: readNumber((data as Record<string, unknown>).replyCount) ?? 0,
        createdAt: (data as Record<string, any>).createdAt?.toDate?.() ?? new Date(),
        updatedAt: (data as Record<string, any>).updatedAt?.toDate?.() ?? new Date(),
    };
};

const fetchCommentsPage = async (
    noteId: string,
    pageSize = 15,
    cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<{
    comments: CommentRecord[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}> => {
    const commentsCollection = collection(db, 'notes', noteId, 'comments');

    const constraints = cursor
        ? [orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize)]
        : [orderBy('createdAt', 'desc'), limit(pageSize)];

    const commentsQuery = query(commentsCollection, ...constraints);
    const snapshot = await getDocs(commentsQuery);

    const mappedComments = snapshot.docs.map(mapCommentDocument);
    const lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return {
        comments: mappedComments,
        lastDoc: lastVisible,
        hasMore: snapshot.docs.length === pageSize,
    };
};

const getComments = (noteId: string, callback: (comments: CommentRecord[]) => void) => {
    try {
        const commentsCollection = collection(db, 'notes', noteId, 'comments');
        const q = query(commentsCollection, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const comments = querySnapshot.docs.map(mapCommentDocument);
            callback(comments);
        });

        return unsubscribe;
    } catch (error) {
        console.error("Error fetching comments: ", error);
        throw error;
    }
};

const likeComment = async (noteId: string, commentId: string) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to like a comment');
    }

    const likerId = auth.currentUser.uid;
    const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
    const likeRef = doc(db, 'users', likerId, 'commentLikes', commentId);

    try {
        return await runTransaction(db, async (transaction) => {
            const commentSnap = await transaction.get(commentRef);
            if (!commentSnap.exists()) {
                throw new Error('Comment not found');
            }

            const commentData = commentSnap.data();
            const commentOwnerId = commentData.userId as string | undefined;
            if (commentOwnerId && commentOwnerId === likerId) {
                throw new Error('You cannot like your own comment');
            }

            const likeSnap = await transaction.get(likeRef);
            const timestamp = serverTimestamp();
            let likes = clampNonNegative(toNumber(commentData.likes));
            let auraDelta = 0;
            let liked = true;

            if (likeSnap.exists()) {
                likes = clampNonNegative(likes - 1);
                transaction.delete(likeRef);
                auraDelta = -1;
                liked = false;
            } else {
                likes += 1;
                transaction.set(likeRef, {
                    commentId,
                    noteId,
                    likedAt: timestamp
                });
                auraDelta = 1;
            }

            transaction.set(
                commentRef,
                {
                    likes,
                    updatedAt: timestamp
                },
                { merge: true }
            );

            if (commentOwnerId && auraDelta !== 0) {
                queueAuraAdjustment(transaction, commentOwnerId, auraDelta, timestamp);
            }

            return liked;
        });
    } catch (error) {
        console.error("Error liking comment: ", error);
        throw error;
    }
};

const deleteComment = async (noteId: string, commentId: string, userId: string) => {
    try {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to delete a comment');
        }

        if (auth.currentUser.uid !== userId) {
            throw new Error('You can only delete your own comments');
        }

        const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
        await deleteDoc(commentRef);

        console.log('Comment deleted successfully');
        return true;
    } catch (error) {
        console.error("Error deleting comment: ", error);
        throw error;
    }
};

const addReply = async (noteId: string, commentId: string, replyData: any) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a reply');
    }

    const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
    const repliesCollection = collection(commentRef, 'replies');
    const replyRef = doc(repliesCollection);

    await runTransaction(db, async (transaction) => {
        const commentSnapshot = await transaction.get(commentRef);

        if (!commentSnapshot.exists()) {
            throw new Error('Comment not found');
        }

        const timestamp = serverTimestamp();

        transaction.set(replyRef, {
            ...replyData,
            userId: auth.currentUser?.uid,
            userEmail: auth.currentUser?.email,
            userPhotoURL: auth.currentUser?.photoURL,
            likes: 0,
            createdAt: timestamp,
            updatedAt: timestamp,
        });

        transaction.update(commentRef, {
            replyCount: increment(1),
            updatedAt: timestamp,
        });
    });

    return replyRef;
};

// Report functions
const reportContent = async (noteId: string, reason: string, description?: string) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to report content');
    }

    try {
        const reportRef = doc(db, 'reports', `${noteId}_${auth.currentUser.uid}`);
        const noteRef = doc(db, 'notes', noteId);

        await runTransaction(db, async (transaction) => {
            const reportSnap = await transaction.get(reportRef);
            if (reportSnap.exists()) {
                throw new Error('You have already reported this content');
            }

            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists()) {
                throw new Error('Content not found');
            }

            const timestamp = serverTimestamp();
            const noteData = noteSnap.data();
            const scoreState = readNoteScoreState(noteData);
            const reportCount = scoreState.reportCount + 1;
            const noteScoreUpdate = buildNoteScoreUpdate(
                scoreState,
                { reportCount },
                timestamp
            );

            // Create report record
            transaction.set(reportRef, {
                noteId,
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                reason,
                description: description?.trim() || null,
                status: 'pending',
                createdAt: timestamp,
                reviewedAt: null,
                reviewedBy: null
            });

            // Increment report count on note
            transaction.set(
                noteRef,
                {
                    ...noteScoreUpdate,
                    lastReportedAt: timestamp
                },
                { merge: true }
            );

            const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined;
            queueAuraAdjustment(transaction, uploaderId, -10, timestamp);
        });

        return true;
    } catch (error) {
        console.error("Error reporting content:", error);
        throw error;
    }
};

const getReportStatus = async (noteId: string) => {
    if (!auth.currentUser) {
        return { hasReported: false, reportCount: 0 };
    }

    try {
        const reportRef = doc(db, 'reports', `${noteId}_${auth.currentUser.uid}`);
        const noteRef = doc(db, 'notes', noteId);

        const [reportSnap, noteSnap] = await Promise.all([
            getDoc(reportRef),
            getDoc(noteRef)
        ]);

        const hasReported = reportSnap.exists();
        const reportCount = noteSnap.exists() ? toNumber(noteSnap.data()?.reportCount) : 0;

        return { hasReported, reportCount };
    } catch (error) {
        console.error("Error checking report status:", error);
        return { hasReported: false, reportCount: 0 };
    }
};

const mapReplyDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): CommentReplyRecord => {
    const data = snapshot.data() ?? {};

    const text = readString((data as Record<string, unknown>).text) ?? '';
    const userId = readString((data as Record<string, unknown>).userId) ?? '';
    const userEmail = readString((data as Record<string, unknown>).userEmail) ?? '';

    return {
        id: snapshot.id,
        text,
        userId,
        userEmail,
        userPhotoURL: readString((data as Record<string, unknown>).userPhotoURL),
        userName: readString((data as Record<string, unknown>).userName),
        likes: readNumber((data as Record<string, unknown>).likes) ?? 0,
        createdAt: (data as Record<string, any>).createdAt?.toDate?.() ?? new Date(),
        updatedAt: (data as Record<string, any>).updatedAt?.toDate?.() ?? new Date(),
    };
};

const fetchReplies = async (noteId: string, commentId: string, limitCount = 50): Promise<CommentReplyRecord[]> => {
    const repliesCollection = collection(db, 'notes', noteId, 'comments', commentId, 'replies');
    const repliesQuery = query(repliesCollection, orderBy('createdAt', 'asc'), limit(limitCount));
    const snapshot = await getDocs(repliesQuery);
    return snapshot.docs.map(mapReplyDocument);
};

// Profile functions
const getAuraLeaderboard = async (limitCount = 20) => {
    try {
        const safeLimit = Math.max(limitCount, 1);
        const profilesCollection = collection(db, 'profiles');
        const leaderboardQuery = query(
            profilesCollection,
            orderBy('aura', 'desc'),
            limit(safeLimit)
        );
        const snapshot = await getDocs(leaderboardQuery);

        return snapshot.docs.map((profileDoc) => {
            const data = profileDoc.data();
            return {
                id: profileDoc.id,
                ...data,
                aura: toNumber(data.aura),
            };
        });
    } catch (error) {
        console.error('Error fetching aura leaderboard:', error);
        throw error;
    }
};

const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
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

const getUserProfileByName = async (identifier: string): Promise<UserProfile | null> => {
    try {
        const normalizedInput = (identifier ?? '').trim();
        if (!normalizedInput) {
            return null;
        }

        const profilesCollection = collection(db, 'profiles');

        const pickProfile = (profileSnap: QueryDocumentSnapshot<DocumentData> | null): UserProfile | null => {
            if (!profileSnap) {
                return null;
            }
            return {
                id: profileSnap.id,
                ...profileSnap.data()
            } as UserProfile;
        };

        const slugCandidate = slugify(normalizedInput);
        if (slugCandidate) {
            const slugQuery = query(profilesCollection, where('profileSlug', '==', slugCandidate));
            const slugSnapshot = await getDocs(slugQuery);
            if (!slugSnapshot.empty) {
                return pickProfile(slugSnapshot.docs[0]);
            }
        }

        const profileRef = doc(db, 'profiles', normalizedInput);
        const directProfileSnap = await getDoc(profileRef);
        if (directProfileSnap.exists()) {
            return {
                id: directProfileSnap.id,
                ...directProfileSnap.data()
            };
        }

        const loweredCandidates = new Set<string>();
        const rawLower = normalizedInput.toLowerCase();
        if (rawLower) {
            loweredCandidates.add(rawLower);
        }

        const spaceVariant = normalizedInput.replace(/[-_]+/g, ' ').trim();
        if (spaceVariant) {
            loweredCandidates.add(spaceVariant.toLowerCase());
        }

        const titleVariant = spaceVariant ? toTitleCase(spaceVariant) : toTitleCase(normalizedInput.replace(/[-_]+/g, ' '));
        if (titleVariant) {
            loweredCandidates.add(titleVariant.toLowerCase());
        }

        for (const lowerCandidate of loweredCandidates) {
            if (!lowerCandidate) continue;
            const lowerQuery = query(profilesCollection, where('fullNameLower', '==', lowerCandidate));
            const lowerSnapshot = await getDocs(lowerQuery);
            if (!lowerSnapshot.empty) {
                return pickProfile(lowerSnapshot.docs[0]);
            }
        }

        const nameCandidates = new Set<string>();
        const seedCandidates = [
            normalizedInput,
            normalizedInput.trim(),
            spaceVariant,
            spaceVariant ? spaceVariant.trim() : '',
            titleVariant,
        ];

        seedCandidates.forEach(candidate => {
            if (candidate) {
                nameCandidates.add(candidate);
            }
        });

        // Also add title case derived from lowercase variants
        loweredCandidates.forEach(lowerCandidate => {
            if (!lowerCandidate) return;
            nameCandidates.add(toTitleCase(lowerCandidate));
        });

        for (const nameCandidateRaw of nameCandidates) {
            const nameCandidate = nameCandidateRaw?.trim();
            if (!nameCandidate) continue;
            const nameQuery = query(profilesCollection, where('fullName', '==', nameCandidate));
            const nameSnapshot = await getDocs(nameQuery);
            if (!nameSnapshot.empty) {
                return pickProfile(nameSnapshot.docs[0]);
            }
        }

        return null;
    } catch (error) {
        console.error("Error fetching user profile by name:", error);
        return null;
    }
};

export {
    auth,
    db,
    addNote,
    getNotes,
    getNotesWithPagination,
    getInitialNotes,
    searchNotes,
    getFilterOptions,
    getTotalNotesCount,
    getAllNotesWithFilters,
    voteOnNote,
    toggleSaveNote,
    addComment,
    fetchCommentsPage,
    getComments,
    likeComment,
    deleteComment,
    addReply,
    fetchReplies,
    reportContent,
    getReportStatus,
    getAuraLeaderboard,
    getUserProfile,
    getUserProfileByName
};
