import {
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    startAfter,
    where,
    Timestamp,
    doc,
    getDoc,
    getCountFromServer,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from './app';
import { cachedFetch } from './batch-operations';
import { cacheQuery, generateCacheKey } from '@/lib/cache/query-cache'
import { getCachedFilterOptions } from '@/lib/cache/filter-cache'
import { resolveNoteFileMetadata } from '../data/r2-utils';
import { normalizeForStorage } from '@/lib/utils';
import { readNoteScoreState, computeCredibilityScore } from '../data/note-utils';
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData';
import type { Note, NotesQueryResult } from '../data/note-types';

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
                ? (materialSequenceValue.trim() || null)
                : materialSequenceValue != null
                    ? (String(materialSequenceValue).trim() || null)
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
        uploadedAt: data.uploadedAt instanceof Timestamp ? data.uploadedAt : (data.uploadedAt ? new Date(data.uploadedAt) : null),
        upvoteCount: scoreState.upvoteCount,
        downvoteCount: scoreState.downvoteCount,
        saveCount: scoreState.saveCount,
        reportCount: scoreState.reportCount,
        credibilityScore,
    };

    return note;
};


const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheBucket = Map<string, { expiresAt: number; result: NotesQueryResult }>;
const SEARCH_CACHE: CacheBucket = new Map();
const FILTER_SEARCH_CACHE: CacheBucket = new Map();
let searchFallbackCount = 0;
let filterFallbackCount = 0;
const nowMs = () => Date.now();
const getCachedResult = (bucket: CacheBucket, key: string): NotesQueryResult | null => {
    const entry = bucket.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= nowMs()) {
        bucket.delete(key);
        return null;
    }
    return entry.result;
};
const setCachedResult = (bucket: CacheBucket, key: string, result: NotesQueryResult) => {
    bucket.set(key, { expiresAt: nowMs() + CACHE_TTL_MS, result });
};
const makeSearchKey = (
    term: string,
    pageSize: number,
    cursor: QueryDocumentSnapshot<DocumentData> | null
) => `search:${normalizeForStorage(term || '')}|size:${pageSize}|cursor:${cursor?.id || 'none'}`;
export const invalidateSearchCacheForNote = (note: Note) => {
    const lower = (s: any) => (s || '').toString().toLowerCase();
    for (const key of Array.from(SEARCH_CACHE.keys())) {
        const kTerm = key.split('|')[0].replace('search:', '').toLowerCase();
        if (!kTerm) continue;
        if (
            lower(note.subject).includes(kTerm) ||
            lower(note.teacher).includes(kTerm) ||
            lower(note.contributorName).includes(kTerm) ||
            lower(note.materialType).includes(kTerm) ||
            lower(note.section).includes(kTerm) ||
            lower(note.name).includes(kTerm)
        ) {
            SEARCH_CACHE.delete(key);
        }
    }
};
export const clearSearchCache = () => {
    SEARCH_CACHE.clear();
};
export const getNotesWithPagination = async (pageSize = 10, lastDocSnapshot = null, filters: any = {}): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];

        // Normalize incoming filters to match storage conventions
        const normalizedSubject = filters.subject ? normalizeForStorage(filters.subject) : '';
        const normalizedTeacher = filters.teacher ? normalizeForStorage(filters.teacher) : '';
        const normalizedMaterialType = filters.materialType ? normalizeForStorage(filters.materialType) : '';
        const normalizedSection = filters.section ? String(filters.section).trim().toUpperCase() : '';
        const normalizedMaterialSequence = filters.materialSequence != null && filters.materialSequence !== ''
            ? String(filters.materialSequence).trim()
            : '';
        const semesterValue = filters.semester ?? '';
        const contributorNameValue = filters.contributorName ?? '';
        const contributorMajorValue = filters.contributorMajor ?? '';

        if (semesterValue && semesterValue !== '') {
            constraints.push(where('semester', '==', semesterValue));
        }
        if (normalizedSubject && normalizedSubject !== '') {
            constraints.push(where('subject', '==', normalizedSubject));
        }
        if (normalizedTeacher && normalizedTeacher !== '') {
            constraints.push(where('teacher', '==', normalizedTeacher));
        }
        if (contributorNameValue && contributorNameValue !== '') {
            constraints.push(where('contributorName', '==', contributorNameValue));
        }
        if (contributorMajorValue && contributorMajorValue !== '') {
            constraints.push(where('contributorMajor', '==', contributorMajorValue));
        }
        if (normalizedSection && normalizedSection !== '') {
            constraints.push(where('section', '==', normalizedSection));
        }
        if (normalizedMaterialType && normalizedMaterialType !== '') {
            constraints.push(where('materialType', '==', normalizedMaterialType));
        }
        if (normalizedMaterialSequence && normalizedMaterialSequence !== '') {
            constraints.push(where('materialSequence', '==', normalizedMaterialSequence));
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
    pageSize?: number;
    lastDocSnapshot?: QueryDocumentSnapshot<DocumentData> | null;
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
    pageSize = 10,
    lastDocSnapshot = null,
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
            const normalizedContributor = normalizeForStorage(contributorName);
            constraints.push(where('contributorName', '==', normalizedContributor));
        }

        // Order by uploadedAt desc for stable pagination
        constraints.push(orderBy('uploadedAt', 'desc'));
        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        constraints.push(limit(pageSize));

        let querySnapshot: any
        try {
            const profileQuery = query(notesCollection, ...constraints)
            const performFetch = async () => await getDocs(profileQuery)
            const isFirstPage = !lastDocSnapshot
            if (isFirstPage) {
                const cacheKey = `profileNotes:${uploadedBy || contributorName}:page=${pageSize}`
                querySnapshot = await cachedFetch(cacheKey, performFetch, 300000)
            } else {
                querySnapshot = await performFetch()
            }
            const notes = querySnapshot.docs.map(mapNoteSnapshot)
            const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1] || null
            const hasMore = querySnapshot.docs.length === pageSize
            return { notes, lastDocSnapshot: lastDoc, hasMore }
        } catch (err: any) {
            console.warn('getNotesForProfile: composite index missing or query failed, using fallback.', err?.message || err)
            const fallbackConstraints: any[] = []
            if (uploadedBy) fallbackConstraints.push(where('uploadedBy', '==', uploadedBy))
            if (contributorName) {
                const normalizedContributor = normalizeForStorage(contributorName)
                fallbackConstraints.push(where('contributorName', '==', normalizedContributor))
            }
            fallbackConstraints.push(limit(pageSize))
            const fallbackQuery = query(notesCollection, ...fallbackConstraints)
            const fallbackSnap = await getDocs(fallbackQuery)
            let notes = fallbackSnap.docs.map(mapNoteSnapshot)
            notes.sort((a, b) => toMillis(b.uploadedAt) - toMillis(a.uploadedAt))
            return { notes, lastDocSnapshot: null, hasMore: false }
        }
    } catch (error) {
        console.error('Error fetching profile notes:', error);
        throw error;
    }
};

export const getAllNotesWithFilters = async (filters: any = {}, searchTerm = ''): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');

        // Normalize incoming filter values to match stored format
        const normalizedFilters = {
            semester: filters.semester ? filters.semester.toString().trim() : '',
            subject: filters.subject ? normalizeForStorage(filters.subject) : '',
            teacher: filters.teacher ? normalizeForStorage(filters.teacher) : '',
            contributorName: filters.contributorName ? normalizeForStorage(filters.contributorName) : '',
            section: filters.section ? (filters.section || '').toString().trim().toUpperCase() : '',
            contributorMajor: filters.contributorMajor ? normalizeForStorage(filters.contributorMajor) : '',
            materialType: filters.materialType ? normalizeForStorage(filters.materialType) : '',
            materialSequence: filters.materialSequence ? (filters.materialSequence || '').toString().trim() : '',
        };

        const filterKeys = Object.keys(normalizedFilters) as Array<keyof typeof normalizedFilters>;
        const filterKeySignature = filterKeys
            .filter((k) => !!normalizedFilters[k])
            .sort()
            .map((k) => `${k}:${normalizedFilters[k]}`)
            .join('&');
        const filterCacheKey = `filters:${filterKeySignature}|term:${normalizeForStorage(searchTerm || '')}`;
        const cached = getCachedResult(FILTER_SEARCH_CACHE, filterCacheKey);
        if (cached) {
            return cached;
        }
        let constraints: any[] = [orderBy('uploadedAt', 'desc')];
        const appliedKeys: string[] = [];
        for (const k of filterKeys) {
            const v = normalizedFilters[k];
            if (v) {
                constraints.push(where(k, '==', v));
                appliedKeys.push(k);
            }
        }

        // Cap reads to keep cost bounded even when only searchTerm is present.
        const HARD_LIMIT = 200;
        constraints.push(limit(HARD_LIMIT));

        let querySnapshot;
        try {
            const q = query(notesCollection, ...constraints);
            querySnapshot = await getDocs(q);
        } catch (err: any) {
            console.warn('Composite index missing or query failed; using fallback limited scan.', err?.message || err);
            const fallbackQ = query(notesCollection, orderBy('uploadedAt', 'desc'), limit(HARD_LIMIT));
            querySnapshot = await getDocs(fallbackQ);
            filterFallbackCount += 1;
        }

        // Map results and apply any remaining filters client-side to preserve behavior
        let notes = querySnapshot.docs.map(mapNoteSnapshot);

        const applyEq = (val: any, target: any) => (val ?? '').toString() === (target ?? '').toString();

        if (normalizedFilters.semester && !appliedKeys.includes('semester')) {
            notes = notes.filter((note) => applyEq(note.semester, normalizedFilters.semester));
        }
        if (normalizedFilters.subject && !appliedKeys.includes('subject')) {
            notes = notes.filter((note) => normalizeForStorage(note.subject || '') === normalizedFilters.subject);
        }
        if (normalizedFilters.teacher && !appliedKeys.includes('teacher')) {
            notes = notes.filter((note) => normalizeForStorage(note.teacher || '') === normalizedFilters.teacher);
        }
        if (normalizedFilters.contributorName && !appliedKeys.includes('contributorName')) {
            notes = notes.filter((note) => normalizeForStorage(note.contributorName || '') === normalizedFilters.contributorName);
        }
        if (normalizedFilters.section && !appliedKeys.includes('section')) {
            notes = notes.filter((note) => ((note.section || '').toString().trim().toUpperCase()) === normalizedFilters.section);
        }
        if (normalizedFilters.contributorMajor && !appliedKeys.includes('contributorMajor')) {
            notes = notes.filter((note) => normalizeForStorage(note.contributorMajor || '') === normalizedFilters.contributorMajor);
        }
        if (normalizedFilters.materialType && !appliedKeys.includes('materialType')) {
            notes = notes.filter((note) => normalizeForStorage(note.materialType || '') === normalizedFilters.materialType);
        }
        if (normalizedFilters.materialSequence && !appliedKeys.includes('materialSequence')) {
            notes = notes.filter((note) => ((note.materialSequence || '').toString().trim()) === normalizedFilters.materialSequence);
        }

        // Apply search term client-side across limited result set
        if (searchTerm && searchTerm.trim() !== '') {
            const searchLower = searchTerm.toLowerCase();
            notes = notes.filter((note) =>
                (note.subject?.toLowerCase() || '').includes(searchLower) ||
                (note.contributorName?.toLowerCase() || '').includes(searchLower) ||
                (note.name?.toLowerCase() || '').includes(searchLower)
            );
        }

        const result: NotesQueryResult = {
            notes,
            lastDocSnapshot: null,
            hasMore: false,
        };
        setCachedResult(FILTER_SEARCH_CACHE, filterCacheKey, result);
        return result;
    } catch (error) {
        console.error('Error fetching all filtered notes (server-side): ', error);
        throw error;
    }
};

// Client-side vote/save mutations have been migrated to server APIs.
// These legacy functions have been removed to prevent direct Firestore writes.

export const getInitialNotes = async () => {
    return await cacheQuery('initial_notes', { limit: 9 }, async () => {
        return await getNotesWithPagination(9, null, {})
    }, { ttlMs: 60 * 1000, tags: ['notes', 'initial'] })
};

export const getRecentNotesByMajorSemester = async (major: string, semester: string, limitCount = 9) => {
    const filters = { contributorMajor: normalizeForStorage(major || ''), semester: (semester || '').toString().trim() }
    const pageSize = Math.max(limitCount, 1)
    return await cacheQuery('recent_notes', { ...filters, limit: pageSize }, async () => {
        return await getNotesWithPagination(pageSize, null, filters)
    }, { ttlMs: 2 * 60 * 1000, tags: ['notes', `major:${filters.contributorMajor}`, `semester:${filters.semester}`] })
}

export const searchNotes = async (searchTerm: string, pageSize = 20, lastDocSnapshot = null): Promise<NotesQueryResult> => {
    try {
        const notesCollection = collection(db, 'notes');

        const KNOWN_MATERIAL_TYPES = [
            'assignment',
            'quiz',
            'lecture',
            'slides',
            'midterm-notes',
            'final-term-notes',
            'books',
        ];

        const normalizedTerm = normalizeForStorage(searchTerm || '').trim();
        const cacheKey = makeSearchKey(normalizedTerm, pageSize, lastDocSnapshot);
        const cached = getCachedResult(SEARCH_CACHE, cacheKey);
        if (cached) {
            return cached;
        }
        const subjectSet = new Set(SUBJECT_NAMES.map((s) => normalizeForStorage(s)));
        const teacherSet = new Set(TEACHER_NAMES.map((t) => normalizeForStorage(t)));
        const materialTypeSet = new Set(KNOWN_MATERIAL_TYPES.map((m) => normalizeForStorage(m)));

        let constraints: any[] = [orderBy('uploadedAt', 'desc')];
        // Choose a primary server-side filter when the term matches canonical sets
        if (normalizedTerm) {
            if (subjectSet.has(normalizedTerm)) {
                constraints.push(where('subject', '==', normalizedTerm));
            } else if (teacherSet.has(normalizedTerm)) {
                constraints.push(where('teacher', '==', normalizedTerm));
            } else if (materialTypeSet.has(normalizedTerm)) {
                constraints.push(where('materialType', '==', normalizedTerm));
            } else if (/^[a-z]$/i.test(normalizedTerm)) {
                constraints.push(where('section', '==', normalizedTerm.toUpperCase()));
            }
        }

        if (lastDocSnapshot) {
            constraints.push(startAfter(lastDocSnapshot));
        }
        const primaryFilterApplied = constraints.some((c: any) => typeof c?.type === 'string' && c.type === 'where');
        let multiplier = 1.5;
        if (primaryFilterApplied) {
            multiplier = 1.2;
        } else if (normalizedTerm) {
            multiplier = normalizedTerm.length >= 5 ? 1.8 : 2.0;
        }
        const effectiveLimit = Math.max(pageSize, Math.ceil(pageSize * multiplier));
        constraints.push(limit(effectiveLimit));

        let querySnapshot;
        try {
            const q = query(notesCollection, ...constraints);
            querySnapshot = await getDocs(q);
        } catch (err: any) {
            // Fallback in case Firestore requires a composite index for the chosen constraint
            console.warn('searchNotes: primary-filter query failed, falling back to broad scan.', err?.message || err);
            const fallbackConstraints: any[] = [orderBy('uploadedAt', 'desc')];
            if (lastDocSnapshot) {
                fallbackConstraints.push(startAfter(lastDocSnapshot));
            }
            const fallbackLimit = Math.max(pageSize, Math.ceil(pageSize * 2));
            fallbackConstraints.push(limit(fallbackLimit));
            const q = query(notesCollection, ...fallbackConstraints);
            querySnapshot = await getDocs(q);
            searchFallbackCount += 1;
        }

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
        const hasMore = querySnapshot.docs.length === effectiveLimit;

        const result: NotesQueryResult = {
            notes,
            lastDocSnapshot: lastDoc,
            hasMore: hasMore && notes.length === pageSize,
        };
        setCachedResult(SEARCH_CACHE, cacheKey, result);
        return result;
    } catch (error) {
        console.error('Error searching notes: ', error);
        throw error;
    }
};

export const getFilterOptions = async () => {
    const fetchFresh = async () => {
        const notesCollection = collection(db, 'notes')
        const q = query(notesCollection, orderBy('uploadedAt', 'desc'), limit(200))
        const querySnapshot = await getDocs(q)
        const notes = querySnapshot.docs.map(mapNoteSnapshot)
        const semesters = [...new Set(notes.map(n => n.semester).filter(Boolean))]
        const subjectSet = new Set<string>(SUBJECT_NAMES.map(s => normalizeForStorage(s)))
        notes.forEach(n => { if (n.subject) subjectSet.add(normalizeForStorage(n.subject)) })
        const subjects = Array.from(subjectSet.values())
        const sortedSubjects = subjects.filter(s => s !== 'not mentioned').sort()
        if (subjects.includes('not mentioned')) sortedSubjects.push('not mentioned')
        const teacherSet = new Set<string>(TEACHER_NAMES.map(t => normalizeForStorage(t)))
        notes.forEach(n => { const v = n.teacher || ''; if (v) teacherSet.add(normalizeForStorage(v)) })
        const teachers = Array.from(teacherSet.values())
        const sections = [...new Set(notes.map(n => (n.section || '').toString().trim().toUpperCase()).filter(Boolean))].sort()
        const materialTypeOrder = ['assignment','quiz','lecture','slides','midterm-notes','final-term-notes','books']
        const materialTypeSet = new Set<string>()
        notes.forEach(n => { if (n.materialType) materialTypeSet.add(normalizeForStorage(n.materialType)) })
        const orderedMaterialTypes = materialTypeOrder.filter(t => materialTypeSet.has(t))
        const leftoverMaterialTypes = [...materialTypeSet].filter(t => !materialTypeOrder.includes(t)).sort()
        const materialTypes = [...orderedMaterialTypes, ...leftoverMaterialTypes]
        const materialSequences = [...new Set(notes.map(n => (n.materialSequence ?? '').toString().trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b))
        return { semesters: semesters.sort(), subjects: sortedSubjects, teachers: teachers.sort(), sections, materialTypes, materialSequences }
    }
    try {
        return await getCachedFilterOptions(fetchFresh)
    } catch (error) {
        console.error('Error fetching filter options: ', error)
        throw error
    }
};

export const getQueryOptimizationMetrics = () => {
    return {
        searchFallbackCount,
        filterFallbackCount,
        searchCacheSize: SEARCH_CACHE.size,
        filterCacheSize: FILTER_SEARCH_CACHE.size,
    };
};

export const getTotalNotesCount = async () => {
    try {
        const notesCollection = collection(db, 'notes');
        const snapshot = await getCountFromServer(notesCollection);
        return snapshot.data().count;
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

