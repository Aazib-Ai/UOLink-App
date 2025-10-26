import { useCallback, useState } from 'react';
import {
    reportContent,
    getReportStatus,
    undoReport,
} from '../../lib/firebase/reports';

export interface ReportStatus {
    hasReported: boolean;
    reportCount: number;
}

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
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            console.error('Reports API Error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const api = {
        loading,
        error,

        reportContent: useCallback((noteId: string, reason: string, description?: string): Promise<boolean | null> =>
            handleAsync(() => reportContent(noteId, reason, description)), [handleAsync]),

        getReportStatus: useCallback((noteId: string): Promise<ReportStatus | null> =>
            handleAsync(() => getReportStatus(noteId)), [handleAsync]),

        undoReport: useCallback((noteId: string): Promise<boolean | null> =>
            handleAsync(() => undoReport(noteId)), [handleAsync]),

        clearError: useCallback(() => setError(null), []),
    };

    return api;
};