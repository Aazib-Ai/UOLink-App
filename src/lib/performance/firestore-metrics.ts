import { getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Firestore write throughput monitoring.
 * Called by subsystems (e.g., security logger) to record write counts per window.
 */
export async function recordWriteThroughput(
  windowStartIso: string,
  windowEndIso: string,
  writesCount: number,
  source: string = 'security_logger'
): Promise<void> {
  try {
    const db = getAdminDb()
    const quotaPerMinRaw = process.env.FIRESTORE_WRITE_QUOTA_PER_MIN || '10000'
    const quotaPerMin = parseInt(quotaPerMinRaw, 10) || 10000
    const utilization = writesCount / quotaPerMin
    const payload = {
      windowStart: windowStartIso,
      windowEnd: windowEndIso,
      writesCount,
      quotaPerMin,
      utilization: Number(utilization.toFixed(4)),
      source,
      timestamp: windowEndIso,
    }
    await db.collection('firestore_metrics').add(payload)

    if (utilization > 0.8) {
      await db.collection('security_alerts').add({
        level: 'MEDIUM',
        eventType: 'FIRESTORE_WRITE_UTILIZATION_HIGH',
        timestamp: windowEndIso,
        details: payload,
      })
      console.warn('[firestore-metrics] utilization > 80%:', payload)
    }
  } catch (e) {
    console.warn('[firestore-metrics] write skipped:', (e as Error)?.message)
  }
}

