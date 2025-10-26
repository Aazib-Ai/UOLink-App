import { serverTimestamp } from 'firebase/firestore';
import { NoteScoreInputs, NoteScoreState } from './types';
import { toNumber, clampNonNegative } from './common';

export const computeCredibilityScore = (counts: NoteScoreInputs): number => (
    (toNumber(counts.upvotes) * 2) +
    (toNumber(counts.saves) * 5) -
    (toNumber(counts.downvotes) * 3) -
    (toNumber(counts.reports) * 10)
);

export const readNoteScoreState = (data: any): NoteScoreState => ({
    upvoteCount: clampNonNegative(toNumber(data?.upvoteCount)),
    downvoteCount: clampNonNegative(toNumber(data?.downvoteCount)),
    saveCount: clampNonNegative(toNumber(data?.saveCount)),
    reportCount: clampNonNegative(toNumber(data?.reportCount)),
});

export const buildNoteScoreUpdate = (
    base: NoteScoreState,
    overrides: Partial<NoteScoreState>,
    timestamp: ReturnType<typeof serverTimestamp>
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
        credibilityScore: computeCredibilityScore({
            upvotes: upvoteCount,
            saves: saveCount,
            downvotes: downvoteCount,
            reports: reportCount,
        }),
        credibilityUpdatedAt: timestamp,
        lastInteractionAt: timestamp,
    };
};