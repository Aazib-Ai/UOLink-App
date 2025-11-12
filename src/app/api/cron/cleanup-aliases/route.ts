import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { startRouteSpan, endRouteSpan } from '@/lib/security/logging'

export async function GET(request: NextRequest) {
  const span = startRouteSpan('cron.cleanup_aliases', request)
  const secretHeader = request.headers.get('x-cron-secret') || ''
  const expected = process.env.CRON_SECRET || ''
  if (!expected || secretHeader !== expected) {
    await endRouteSpan(span, 403)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const db = getAdminDb()
    const now = new Date()
    const q = await db
      .collection('username_history')
      .where('aliasExpiresAt', '<=', now)
      .orderBy('aliasExpiresAt', 'asc')
      .limit(500)
      .get()

    if (q.empty) {
      await endRouteSpan(span, 200)
      return NextResponse.json({ deleted: 0, remaining: 0 })
    }

    const batch = db.batch()
    q.docs.forEach((doc) => batch.delete(doc.ref))
    await batch.commit()

    await endRouteSpan(span, 200)
    return NextResponse.json({ deleted: q.size })
  } catch (err: any) {
    await endRouteSpan(span, 500, err)
    return NextResponse.json({ error: err?.message || 'Cleanup failed' }, { status: 500 })
  }
}

