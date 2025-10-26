import {
    runTransaction,
    serverTimestamp,
    doc,
    increment,
    Transaction,
} from 'firebase/firestore';
import { db } from './app';
import { getAuraLeaderboard } from './profiles';

const queueAuraAdjustment = (
    transaction: Transaction,
    userId: string | undefined,
    auraDelta: number,
    timestamp: ReturnType<typeof serverTimestamp>
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

export const adjustUserAura = async (userId: string, auraDelta: number) => {
    if (!Number.isFinite(auraDelta) || auraDelta === 0) {
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const timestamp = serverTimestamp();
            queueAuraAdjustment(transaction, userId, auraDelta, timestamp);
        });
    } catch (error) {
        console.error("Error adjusting user aura:", error);
        throw error;
    }
};

export { queueAuraAdjustment };
export { getAuraLeaderboard };