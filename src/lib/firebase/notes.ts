import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    startAfter,
    serverTimestamp,
    doc,
    runTransaction,
    increment,
    getDoc,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from './app';
import { normalizeForStorage } from '../data/common';
import { resolveNoteFileMetadata } from '../data/r2-utils';
import { readNoteScoreState, computeCredibilityScore, buildNoteScoreUpdate } from '../data/note-utils';
import { VoteOnNoteResult, ToggleSaveNoteResult } from '../data/types';
import type { Note, NotesQueryResult } from '../data/note-types';
import { queueAuraAdjustment } from './aura';

export const mapNoteSnapshot = (doc: QueryDocumentSnapshot<DocumentData>): Note => {
    const data = doc.data();
    const { resolvedUrl, storageKey, storageProvider, storageBucket } = resolveNoteFileMetadata(data);
    const scoreState = readNoteScoreState(data);
    const credibilityScore =
        typeof data.credibilityScore === 'number' && Number.isFinite(data.credibilityScore)
            ? data.credibilityScore
            : computeCredibilityScore({
                upvotes: scoreState.upvoteCount,
                saves: scoreState.saveCount,
                downvotes: scoreState.downvoteCount,
                reports: scoreState.reportCount,
            });

    const subject = typeof data.subject === 'string' ? data.subject : '';
    const moduleValue = typeof data.module === 'string' ? data.module : '';
    const teacherValue = typeof data.teacher === 'string' ? data.teacher : moduleValue;
    const semesterValue = data.semester;
    const sectionValue = data.section;
    const materialTypeValue = data.materialType;
    const materialSequenceValue = data.materialSequence;
    const contributorNameValue = data.contributorName;
    const contributorDisplayNameValue = data.contributorDisplayName;
    const uploaderUsernameValue = data.uploaderUsername;
    const contributorMajorValue = data.contributorMajor;
    const nameValue = data.name;
    const uploadedByValue = data.uploadedBy;

    const note: Note = {
        id: doc.id,
        ...data,
        storageProvider: storageProvider ?? data.storageProvider,
        storageBucket,
        storageKey: storageKey ?? data.storageKey,
        fileUrl: resolvedUrl ?? (typeof data.fileUrl === 'string' ? data.fileUrl : ''),
        rawFileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : undefined,
        subject,
        module: moduleValue,
        teacher: teacherValue || moduleValue,
        semester:
            typeof semesterValue === 'string'
                ? semesterValue
                : semesterValue != null
                    ? String(semesterValue)
                    : '',
        section:
            typeof sectionValue === 'string'
                ? sectionValue
                : sectionValue != null
                    ? String(sectionValue)
                    : '',
        materialType: typeof materialTypeValue === 'string' ? materialTypeValue : '',
        materialSequence:
            typeof materialSequenceValue === 'string'
                ? materialSequenceValue
                : materialSequenceValue != null
                    ? String(materialSequenceValue)
                    : null,
        contributorName: typeof contributorNameValue === 'string' ? contributorNameValue : '',
        contributorDisplayName:
            typeof contributorDisplayNameValue === 'string'
                ? contributorDisplayNameValue
                : typeof contributorNameValue === 'string'
                    ? contributorNameValue
                    : '',
        uploaderUsername:
            typeof uploaderUsernameValue === 'string' && uploaderUsernameValue.trim()
                ? uploaderUsernameValue
                : null,
        contributorMajor: typeof contributorMajorValue === 'string' ? contributorMajorValue : '',
        name: typeof nameValue === 'string' ? nameValue : '',
        uploadedBy: typeof uploadedByValue === 'string' ? uploadedByValue : '',
        uploadedAt: data.uploadedAt ?? null,
        upvoteCount: scoreState.upvoteCount,
        downvoteCount: scoreState.downvoteCount,
        saveCount: scoreState.saveCount,
        reportCount: scoreState.reportCount,
        credibilityScore,
    };

    return note;
};

export const addNote = async (noteData: any) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('User must be authenticated to add a note');
        }

        if (!noteData.name || !noteData.semester || !noteData.subject) {
            throw new Error('Missing required note details');
        }

        const notesCollection = collection(db, 'notes');
        const noteRef = doc(notesCollection);
        const timestamp = serverTimestamp();
        const metadataCreatedAt = new Date().toISOString();
        const uploaderId = currentUser.uid;
        const normalizedTeacher = normalizeForStorage(noteData.teacher || noteData.module || '');
        const profileRef = doc(db, 'profiles', uploaderId);
        const profileSnap = await getDoc(profileRef);
        const profileData = profileSnap.exists() ? profileSnap.data() : undefined;

        const pickString = (...values: unknown[]): string | undefined => {
            for (const value of values) {
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed.length > 0) {
                        return trimmed;
                    }
                }
            }
            return undefined;
        };

        const contributorDisplayName =
            pickString(
                noteData.contributorDisplayName,
                noteData.contributorName,
                profileData?.fullName,
                currentUser.displayName,
                currentUser.email ? currentUser.email.split('@')[0] : undefined
            ) ?? 'Anonymous';

        const uploaderUsername =
            pickString(
                noteData.uploaderUsername,
                profileData?.username
            ) ?? null;

        await runTransaction(db, async (transaction) => {
            transaction.set(noteRef, {
                ...noteData,
                subject: normalizeForStorage(noteData.subject),
                teacher: normalizedTeacher,
                module: normalizedTeacher,
                contributorName: contributorDisplayName,
                contributorDisplayName,
                uploaderUsername,
                uploadedBy: uploaderId,
                uploadedAt: timestamp,
                upvoteCount: 0,
                downvoteCount: 0,
                saveCount: 0,
                reportCount: 0,
                credibilityScore: 0,
                credibilityUpdatedAt: timestamp,
                lastInteractionAt: timestamp,
                metadata: {
                    createdBy: currentUser.email ?? null,
                    createdAt: metadataCreatedAt
                }
            });

            queueAuraAdjustment(transaction, uploaderId, 10, timestamp);
        });

        console.log('Note added with ID: ', noteRef.id);
        return noteRef;
    } catch (error) {
        console.error("Error adding note: ", error);
        throw error;
    }
};

export const getNotesWithPagination = async (pageSize = 10, lastDocSnapshot = null, filters: any = {}): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

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

interface ProfileNotesQueryOptions {
    uploadedBy?: string;
    contributorName?: string;
}

const toMillis = (value: any): number => {
    if (!value) {
        return 0;
    }
    if (typeof value.toMillis === 'function') {
        return value.toMillis();
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const getNotesForProfile = async ({
    uploadedBy,
    contributorName,
}: ProfileNotesQueryOptions): Promise<NotesQueryResult> => {
    if (!uploadedBy && !contributorName) {
        throw new Error('getNotesForProfile requires either uploadedBy or contributorName');
    }

    try {
        const notesCollection = collection(db, 'notes');
        const constraints: any[] = [];

        if (uploadedBy) {
            constraints.push(where('uploadedBy', '==', uploadedBy));
        }

        if (contributorName) {
            constraints.push(where('contributorName', '==', contributorName));
        }

        const profileQuery = constraints.length
            ? query(notesCollection, ...constraints)
            : query(notesCollection);

        const querySnapshot = await getDocs(profileQuery);
        let notes = querySnapshot.docs.map(mapNoteSnapshot);

        if (contributorName && !uploadedBy) {
            const normalizedContributor = normalizeForStorage(contributorName);
            notes = notes.filter(note =>
                normalizeForStorage(note.contributorName || '') === normalizedContributor
            );
        }

        notes.sort((a, b) => toMillis(b.uploadedAt) - toMillis(a.uploadedAt));

        return {
            notes,
            lastDocSnapshot: null,
            hasMore: false
        };
    } catch (error) {
        console.error('Error fetching profile notes:', error);
        throw error;
    }
};

export const getAllNotesWithFilters = async (filters: any = {}, searchTerm = ''): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');
        const q = query(notesCollection, orderBy('uploadedAt', 'desc'));
        const querySnapshot = await getDocs(q);

        let notes = querySnapshot.docs.map(mapNoteSnapshot);

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
            hasMore: false
        };
    } catch (error) {
        console.error("Error fetching all filtered notes: ", error);
        throw error;
    }
};

export const voteOnNote = async (noteId: string, voteType: 'up' | 'down'): Promise<VoteOnNoteResult> => {
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
        let upvotes = Math.max(0, noteVoteSnap.data()?.upvotes || 0);
        let downvotes = Math.max(0, noteVoteSnap.data()?.downvotes || 0);
        const storedVote = (userVoteSnap.exists() ? userVoteSnap.data()?.voteType : null) as ('up' | 'down' | null);
        let nextVote: 'up' | 'down' | null = voteType;
        let auraDelta = 0;

        if (storedVote === voteType) {
            if (voteType === 'up') {
                upvotes = Math.max(0, upvotes - 1);
                auraDelta -= 2;
            } else {
                downvotes = Math.max(0, downvotes - 1);
                auraDelta += 3;
            }
            transaction.delete(userVoteRef);
            nextVote = null;
        } else {
            if (storedVote === 'up') {
                upvotes = Math.max(0, upvotes - 1);
                auraDelta -= 2;
            } else if (storedVote === 'down') {
                downvotes = Math.max(0, downvotes - 1);
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
            credibilityScore: noteScoreUpdate.credibilityScore
        };
    });
};

export const toggleSaveNote = async (noteId: string): Promise<ToggleSaveNoteResult> => {
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
            saveCount = Math.max(0, saveCount - 1);
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
            credibilityScore: noteScoreUpdate.credibilityScore
        };
    });
};

export const getInitialNotes = async () => {
    return await getNotesWithPagination(9, null, {});
};

export const searchNotes = async (searchTerm: string, pageSize = 20, lastDocSnapshot = null): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        constraints.push(limit(pageSize * 3));

        const q = query(notesCollection, ...constraints);
        const querySnapshot = await getDocs(q);

        let allNotes = querySnapshot.docs.map(mapNoteSnapshot);

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

export const getFilterOptions = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const q = query(notesCollection, orderBy('uploadedAt', 'desc'), limit(1000));
        const querySnapshot = await getDocs(q);

        const notes = querySnapshot.docs.map(mapNoteSnapshot);

        const semesters = [...new Set(notes.map(note => note.semester).filter(Boolean))];

        const subjectMap = new Map();
        notes.forEach(note => {
            if (note.subject) {
                const normalizedSubject = normalizeForStorage(note.subject);
                if (!subjectMap.has(normalizedSubject)) {
                    subjectMap.set(normalizedSubject, normalizedSubject);
                }
            }
        });
        const subjects = Array.from(subjectMap.values());

        const sortedSubjects = subjects.filter(subject => subject !== 'not mentioned').sort();
        if (subjects.includes('not mentioned')) {
            sortedSubjects.push('not mentioned');
        }

        const teacherMap = new Map();
        notes.forEach(note => {
            const teacherValue = note.teacher || '';
            if (teacherValue) {
                const normalizedTeacher = normalizeForStorage(teacherValue);
                if (!teacherMap.has(normalizedTeacher)) {
                    teacherMap.set(normalizedTeacher, normalizedTeacher);
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
            subjects: sortedSubjects,
            teachers: teachers.sort(),
            sections,
            materialTypes,
            materialSequences,
        };
    } catch (error) {
        console.error("Error fetching filter options: ", error);
        throw error;
    }
};

export const getTotalNotesCount = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const querySnapshot = await getDocs(notesCollection);
        return querySnapshot.size;
    } catch (error) {
        console.error("Error getting total notes count: ", error);
        return 0;
    }
};

export const getNotes = async () => {
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
