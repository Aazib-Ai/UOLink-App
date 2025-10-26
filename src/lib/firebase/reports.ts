import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './app';
import { toNumber } from '../data/common';
import { readNoteScoreState, buildNoteScoreUpdate } from '../data/note-utils';
import { queueAuraAdjustment } from './aura';

export const reportContent = async (noteId: string, reason: string, description?: string) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to report content');
    }

    const currentUser = auth.currentUser;

    try {
        const reportRef = doc(db, 'reports', `${noteId}_${currentUser.uid}`);
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

            transaction.set(reportRef, {
                noteId,
                userId: currentUser.uid,
                userEmail: currentUser.email ?? null,
                reason,
                description: description?.trim() || null,
                status: 'pending',
                createdAt: timestamp,
                reviewedAt: null,
                reviewedBy: null
            });

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

export const getReportStatus = async (noteId: string) => {
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

export const undoReport = async (noteId: string) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to undo a report');
    }

    const currentUser = auth.currentUser;

    try {
        const reportRef = doc(db, 'reports', `${noteId}_${currentUser.uid}`);
        const noteRef = doc(db, 'notes', noteId);

        await runTransaction(db, async (transaction) => {
            const reportSnap = await transaction.get(reportRef);
            if (!reportSnap.exists()) {
                throw new Error('No report found to undo');
            }

            const noteSnap = await transaction.get(noteRef);
            if (!noteSnap.exists()) {
                throw new Error('Content not found');
            }

            const timestamp = serverTimestamp();
            const noteData = noteSnap.data();
            const scoreState = readNoteScoreState(noteData);
            const reportCount = Math.max(0, scoreState.reportCount - 1);
            const noteScoreUpdate = buildNoteScoreUpdate(
                scoreState,
                { reportCount },
                timestamp
            );

            transaction.delete(reportRef);

            transaction.set(
                noteRef,
                {
                    ...noteScoreUpdate,
                    lastReportedAt: null
                },
                { merge: true }
            );

            const uploaderId = typeof noteData.uploadedBy === 'string' ? noteData.uploadedBy : undefined;
            queueAuraAdjustment(transaction, uploaderId, 10, timestamp); // Restore 10 aura points
        });

        return true;
    } catch (error) {
        console.error("Error undoing report:", error);
        throw error;
    }
};