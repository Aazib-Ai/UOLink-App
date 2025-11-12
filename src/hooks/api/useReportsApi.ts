import { useCallback, useState } from 'react';
import {
    reportNote,
    getReportStatus,
    undoReport,
    type ReportStatus,
} from '../../lib/api/reports';
import { parseApiError, userFriendlyMessage } from '@/lib/api/client';

// Re-export type for convenience in consumers
export type { ReportStatus } from '../../lib/api/reports';

export const useReportsApi = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAsync = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await asyncFn();
            return result;
        } catch (err) {
            const parsed = parseApiError(err);
            const errorMessage = userFriendlyMessage(parsed);
            setError(errorMessage);
            console.error('Reports API Error:', {
                original: err,
                parsed,
                message: errorMessage,
            });
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        reportContent: useCallback((noteId: string, reason: string, description?: string): Promise<boolean | null> =>
            handleAsync(() => reportNote(noteId, reason, description)), [handleAsync]),

        getReportStatus: useCallback((noteId: string): Promise<ReportStatus | null> =>
            handleAsync(() => getReportStatus(noteId)), [handleAsync]),

        undoReport: useCallback((noteId: string): Promise<boolean | null> =>
            handleAsync(() => undoReport(noteId)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};
