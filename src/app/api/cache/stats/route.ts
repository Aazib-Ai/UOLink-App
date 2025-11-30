import { NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/cache/query-cache'
import { getFilterCacheMetrics } from '@/lib/cache/filter-cache'
import { getQueryOptimizationMetrics } from '@/lib/firebase/notes'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const qc = getCacheStats()
    const fc = getFilterCacheMetrics()
    const qm = getQueryOptimizationMetrics()
    return NextResponse.json({ queryCache: qc, filterCache: fc, queryMetrics: qm }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'metrics_unavailable' }, { status: 500 })
  }
}
