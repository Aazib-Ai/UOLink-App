import { useCallback, useState, useEffect, useRef } from 'react';
import {
    addComment,
    fetchCommentsPage,
    getComments,
    likeComment,
    deleteComment,
    addReply,
    fetchReplies,
} from '@/lib/firebase';
import { CommentRecord, CommentReplyRecord, CommentsPageResult } from '../../lib/data/types';

export const useCommentsApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
        };
    }, []);

    const handleAsync = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await asyncFn();
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            console.error('Comments API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        addComment: useCallback((noteId: string, commentData: any) =>
            handleAsync(() => addComment(noteId, commentData)), [handleAsync]),

        fetchCommentsPage: useCallback((noteId: string, pageSize?: number, cursor?: any): Promise<CommentsPageResult | null> =>
            handleAsync(() => fetchCommentsPage(noteId, pageSize, cursor)), [handleAsync]),

        subscribeToComments: useCallback((noteId: string, callback: (comments: CommentRecord[]) => void) => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }

            try {
                unsubscribeRef.current = getComments(noteId, callback);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An error occurred';
                setError(errorMessage);
                console.error('Comments API Error:', err);
            }

            return unsubscribeRef.current;
        }, [setError]),

        unsubscribeFromComments: useCallback(() => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
        }, []),

        likeComment: useCallback((noteId: string, commentId: string): Promise<boolean | null> =>
            handleAsync(() => likeComment(noteId, commentId)), [handleAsync]),

        deleteComment: useCallback((noteId: string, commentId: string, userId: string): Promise<boolean | null> =>
            handleAsync(() => deleteComment(noteId, commentId, userId)), [handleAsync]),

        addReply: useCallback((noteId: string, commentId: string, replyData: any) =>
            handleAsync(() => addReply(noteId, commentId, replyData)), [handleAsync]),

        fetchReplies: useCallback((noteId: string, commentId: string, limitCount?: number): Promise<CommentReplyRecord[] | null> =>
            handleAsync(() => fetchReplies(noteId, commentId, limitCount)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};
