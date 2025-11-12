import { NextResponse } from 'next/server'
import { publishTimetableJson } from '@/lib/timetable/sync'
import { logSecurityEvent, generateCorrelationId } from '@/lib/security/logging'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { key } = await publishTimetableJson()
    await logSecurityEvent({
      type: 'DATA_ACCESS',
      correlationId: generateCorrelationId(),
      details: { action: 'timetable_sync_success', key }
    })
    return NextResponse.json({ ok: true, key })
  } catch (error: any) {
    await logSecurityEvent({
      type: 'ERROR',
      correlationId: generateCorrelationId(),
      details: { action: 'timetable_sync_error', message: error?.message }
    })
    return NextResponse.json({ ok: false, error: error?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function GET() {
  // Convenience for quick manual testing
  return POST()
}
