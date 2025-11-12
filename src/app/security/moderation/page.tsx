import { getAdminDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

async function fetchRecentModeration(limit = 50) {
  try {
    const db = getAdminDb()
    const snap = await db.collection('security_events').orderBy('timestamp', 'desc').limit(limit).get()
    // Show only content policy related events
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((e) => (e as any).details?.reason?.includes?.('content_policy') || (e as any).details?.reason?.includes?.('profile_content'))
  } catch (err) {
    return { error: (err as Error)?.message || 'Failed to load data' }
  }
}

export default async function ModerationDashboardPage() {
  const events = await fetchRecentModeration(50)
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Content Moderation Dashboard</h1>
      {Array.isArray(events) ? (
        <div className="space-y-3">
          {events.map((e: any) => (
            <div key={e.id} className="p-3 border rounded">
              <div className="flex justify-between text-sm">
                <span className="font-mono">{e.timestamp}</span>
                <span>{e.type} · {e.severity}</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                <span>cid: {e.correlationId}</span>
                {e.userId ? <span className="ml-2">uid: {e.userId}</span> : null}
                {e.endpoint ? <span className="ml-2">path: {e.endpoint}</span> : null}
              </div>
              {e.details ? (
                <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(e.details, null, 2)}</pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-red-600">{(events as any).error}</p>
      )}
    </div>
  )
}

