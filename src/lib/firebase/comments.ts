import {
    collection,
    getDocs,
    addDoc,
    query,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    doc,
    deleteDoc,
    onSnapshot,
    runTransaction,
    increment,
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from './app';
import { toNumber, clampNonNegative, readString, readNumber } from '../data/common';
import { CommentRecord, CommentReplyRecord, CommentsPageResult } from '../data/types';
import { queueAuraAdjustment } from './aura';

const pickNonEmptyString = (...values: unknown[]): string | undefined => {
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

const mapCommentDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): CommentRecord => {
    const data = snapshot.data() ?? {};

    const text = readString(data.text) ?? '';
    const userId = readString(data.userId) ?? '';
    const userEmail = readString(data.userEmail) ?? '';

    return {
        id: snapshot.id,
        text,
        userId,
        userEmail,
        userPhotoURL: readString(data.userPhotoURL),
        userName: readString(data.userName),
        userDisplayName: readString(data.userDisplayName) ?? readString(data.userName) ?? undefined,
        userUsername: readString(data.userUsername) ?? undefined,
        likes: readNumber(data.likes) ?? 0,
        replyCount: readNumber(data.replyCount) ?? 0,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    };
};

const mapReplyDocument = (snapshot: QueryDocumentSnapshot<DocumentData>): CommentReplyRecord => {
    const data = snapshot.data() ?? {};

    const text = readString(data.text) ?? '';
    const userId = readString(data.userId) ?? '';
    const userEmail = readString(data.userEmail) ?? '';

    return {
        id: snapshot.id,
        text,
        userId,
        userEmail,
        userPhotoURL: readString(data.userPhotoURL),
        userName: readString(data.userName),
        userDisplayName: readString(data.userDisplayName) ?? readString(data.userName) ?? undefined,
        userUsername: readString(data.userUsername) ?? undefined,
        likes: readNumber(data.likes) ?? 0,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    };
};

export const addComment = async (noteId: string, commentData: any) => {
    try {
        if (!auth.currentUser) {
            throw new Error('User must be authenticated to add a comment');
        }

        const commentsCollection = collection(db, 'notes', noteId, 'comments');
        const displayName =
            pickNonEmptyString(commentData.userDisplayName, commentData.userName) ?? null;
        const username = pickNonEmptyString(commentData.userUsername) ?? null;

        const docRef = await addDoc(commentsCollection, {
            ...commentData,
            userId: auth.currentUser.uid,
            userEmail: auth.currentUser.email,
            userPhotoURL: auth.currentUser.photoURL,
            userName: displayName ?? null,
            userDisplayName: displayName,
            userUsername: username,
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

export const fetchCommentsPage = async (
    noteId: string,
    pageSize = 15,
    cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<CommentsPageResult> => {
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

export const getComments = (noteId: string, callback: (comments: CommentRecord[]) => void) => {
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

export const likeComment = async (noteId: string, commentId: string) => {
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

export const deleteComment = async (noteId: string, commentId: string, userId: string) => {
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

export const addReply = async (noteId: string, commentId: string, replyData: any) => {
    if (!auth.currentUser) {
        throw new Error('User must be authenticated to add a reply');
    }

    const commentRef = doc(db, 'notes', noteId, 'comments', commentId);
    const repliesCollection = collection(commentRef, 'replies');
    const replyRef = doc(repliesCollection);
    const displayName = pickNonEmptyString(replyData.userDisplayName, replyData.userName) ?? null;
    const username = pickNonEmptyString(replyData.userUsername) ?? null;

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
            userName: displayName ?? null,
            userDisplayName: displayName,
            userUsername: username,
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

export const fetchReplies = async (noteId: string, commentId: string, limitCount = 50): Promise<CommentReplyRecord[]> => {
    const repliesCollection = collection(db, 'notes', noteId, 'comments', commentId, 'replies');
    const repliesQuery = query(repliesCollection, orderBy('createdAt', 'asc'), limit(limitCount));
    const snapshot = await getDocs(repliesQuery);
    return snapshot.docs.map(mapReplyDocument);
};
