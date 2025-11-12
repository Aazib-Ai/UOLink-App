import { getAdminDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

async function fetchRecent(collection: string, limit = 25) {
  try {
    const db = getAdminDb()
    const snap = await db.collection(collection).orderBy('timestamp', 'desc').limit(limit).get()
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (err) {
    return { error: (err as Error)?.message || 'Failed to load data' }
  }
}

function ItemList({ title, items }: { title: string; items: any[] | { error: string } }) {
  if (!Array.isArray(items)) {
    return (
      <div className="p-4 border rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-red-600">{(items as any).error}</p>
      </div>
    )
  }
  return (
    <div className="p-4 border rounded mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="space-y-2">
        {items.map((e) => (
          <div key={e.id} className="text-sm p-2 bg-gray-50 rounded">
            <div className="flex justify-between">
              <span className="font-mono">{e.timestamp}</span>
              <span className="font-semibold">{e.type || e.action || e.eventType}</span>
            </div>
            <div className="text-xs text-gray-600">
              <span>cid: {e.correlationId}</span>
              {e.userId ? <span className="ml-2">uid: {e.userId}</span> : null}
              {e.endpoint ? <span className="ml-2">path: {e.endpoint}</span> : null}
              {e.severity ? <span className="ml-2">sev: {e.severity}</span> : null}
            </div>
            {e.details ? (
              <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(e.details, null, 2)}</pre>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function SecurityMonitoringPage() {
  const [events, alerts, metrics, aggregated, eventRates, violators] = await Promise.all([
    fetchRecent('security_events', 50),
    fetchRecent('security_alerts', 20),
    fetchRecent('security_metrics', 50),
    fetchRecent('security_metrics_aggregated', 20),
    fetchRecent('security_event_rates', 10),
    fetchRecent('security_top_violators', 5),
  ])

  const stats = Array.isArray(events)
    ? {
        totalEvents: events.length,
        authFailures: events.filter((e: any) => e.type === 'AUTH_FAILURE').length,
        rateLimitExceeded: events.filter((e: any) => e.type === 'RATE_LIMIT_EXCEEDED').length,
        suspicious: events.filter((e: any) => e.type === 'SUSPICIOUS_ACTIVITY').length,
      }
    : null

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Security Monitoring</h1>
      {stats ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 border rounded"><div className="text-sm">Total Events</div><div className="text-2xl font-semibold">{stats.totalEvents}</div></div>
          <div className="p-4 border rounded"><div className="text-sm">Auth Failures</div><div className="text-2xl font-semibold">{stats.authFailures}</div></div>
          <div className="p-4 border rounded"><div className="text-sm">Rate Limit Exceeded</div><div className="text-2xl font-semibold">{stats.rateLimitExceeded}</div></div>
          <div className="p-4 border rounded"><div className="text-sm">Suspicious Activity</div><div className="text-2xl font-semibold">{stats.suspicious}</div></div>
        </div>
      ) : null}
      <ItemList title="Recent Aggregated Metrics (p95)" items={aggregated as any} />
      {/* Event rate summaries */}
      <div className="p-4 border rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Event Rates</h2>
        {Array.isArray(eventRates) ? (
          <div className="space-y-2">
            {eventRates.map((r: any) => (
              <div key={r.id} className="text-sm p-2 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <span className="font-mono">{r.timestamp}</span>
                  <span className="font-semibold">Window</span>
                </div>
                <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(r.counts, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-red-600">{(eventRates as any)?.error || 'Failed to load'}</p>
        )}
      </div>
      {/* Top violators */}
      <div className="p-4 border rounded mb-6">
        <h2 className="text-lg font-semibold mb-2">Top Violators</h2>
        {Array.isArray(violators) ? (
          <div className="space-y-2">
            {violators.map((v: any) => (
              <div key={v.id} className="text-sm p-2 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <span className="font-mono">{v.timestamp}</span>
                  <span className="font-semibold">Window</span>
                </div>
                <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(v.violators, null, 2)}</pre>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-red-600">{(violators as any)?.error || 'Failed to load'}</p>
        )}
      </div>
      <ItemList title="Recent Alerts" items={alerts as any} />
      <ItemList title="Recent Security Events" items={events as any} />
      <ItemList title="Recent Metrics" items={metrics as any} />
    </div>
  )
}
