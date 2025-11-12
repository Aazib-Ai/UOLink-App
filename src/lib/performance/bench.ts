import { getAdminDb } from '@/lib/firebaseAdmin'

/**
 * Lightweight server-side performance benchmarking utilities.
 * Sampling keeps write costs low while providing useful visibility.
 */
const DEFAULT_SAMPLING_RATE = 0.05 // 5%

function getPerfSamplingRate(): number {
  const raw = process.env.PERF_METRICS_SAMPLING_RATE
  const rate = raw ? parseFloat(raw) : DEFAULT_SAMPLING_RATE
  if (isNaN(rate)) return DEFAULT_SAMPLING_RATE
  return Math.max(0.01, Math.min(0.5, rate))
}

/**
 * Record a single performance metric sample to Firestore (sampled).
 */
export async function recordPerfMetric(
  name: string,
  valueMs: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const samplingRate = getPerfSamplingRate()
    if (Math.random() > samplingRate) return
    const db = getAdminDb()
    await db.collection('performance_metrics').add({
      name,
      valueMs,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
      sampled: true,
    })
  } catch (e) {
    // Do not throw from perf recording; fail silently
    console.warn('[perf.bench] write skipped:', (e as Error)?.message)
  }
}

/**
 * Measure an async function's execution time and record it.
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    await recordPerfMetric(name, duration, metadata)
    return result
  } catch (error) {
    const duration = Date.now() - start
    await recordPerfMetric(name, duration, { ...(metadata || {}), error: String((error as any)?.message || error) })
    throw error
  }
}

