import { getAdminDb } from '@/lib/firebaseAdmin'
import { addModerationPattern, updateModerationPattern, getModerationPatterns, getModerationSettings, setModerationSettings } from '@/lib/security/moderation-config'

export const dynamic = 'force-dynamic'

async function fetchPatterns() {
  try {
    const patterns = await getModerationPatterns()
    return patterns
  } catch (err) {
    return { error: (err as Error)?.message || 'Failed to load patterns' }
  }
}

async function fetchSettings() {
  try {
    const settings = await getModerationSettings()
    return settings
  } catch (err) {
    return { error: (err as Error)?.message || 'Failed to load settings' }
  }
}

async function addPattern(formData: FormData) {
  'use server'
  const category = String(formData.get('category') || 'custom') as any
  const pattern = String(formData.get('pattern') || '')
  const severity = Number(formData.get('severity') || 2)
  if (!pattern) return
  await addModerationPattern({ category, pattern, severity, enabled: true })
}

async function togglePattern(id: string, enabled: boolean) {
  'use server'
  await updateModerationPattern(id, { enabled })
}

async function updateSettings(formData: FormData) {
  'use server'
  const thresholdDefault = Number(formData.get('thresholdDefault') || '')
  const thresholdStrict = Number(formData.get('thresholdStrict') || '')
  const violationLimit24h = Number(formData.get('violationLimit24h') || '')
  const update: any = {}
  if (!Number.isNaN(thresholdDefault)) update.thresholdDefault = thresholdDefault
  if (!Number.isNaN(thresholdStrict)) update.thresholdStrict = thresholdStrict
  if (!Number.isNaN(violationLimit24h)) update.violationLimit24h = violationLimit24h
  if (Object.keys(update).length) {
    await setModerationSettings(update)
  }
}

export default async function ModerationManagePage() {
  const [patterns, settings] = await Promise.all([fetchPatterns(), fetchSettings()])
  const hasError = (patterns as any)?.error || (settings as any)?.error
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Moderation Patterns Management</h1>
      {hasError ? (
        <p className="text-red-600">{String(hasError)}</p>
      ) : null}

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Add Pattern</h2>
        <form action={addPattern} className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <input name="pattern" placeholder="Regex pattern" className="border p-2 rounded col-span-2" />
            <select name="category" className="border p-2 rounded">
              {['profanity','hate','sexual','personal_data','spam','links','custom'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Severity</label>
            <input name="severity" type="number" min={1} max={5} defaultValue={2} className="border p-2 rounded w-24" />
            <button type="submit" className="px-3 py-2 bg-green-600 text-white rounded">Add</button>
          </div>
        </form>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Current Patterns</h2>
        <div className="space-y-2">
          {Array.isArray(patterns) && patterns.length ? patterns.map(p => (
            <div key={p.id} className="flex items-center justify-between border rounded p-2">
              <div>
                <div className="text-sm">/{p.pattern}/ · <span className="font-mono">{p.category}</span></div>
                <div className="text-xs text-gray-600">severity: {p.severity} · id: {p.id}</div>
              </div>
              <form action={async () => { await togglePattern(p.id, !p.enabled) }}>
                <button className="px-3 py-1 rounded text-white bg-blue-600" type="submit">
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
              </form>
            </div>
          )) : (
            <p className="text-gray-600 text-sm">No patterns found.</p>
          )}
        </div>
      </section>

      <section className="border rounded p-4">
        <h2 className="font-semibold mb-2">Settings</h2>
        {typeof (settings as any)?.error === 'string' ? (
          <p className="text-red-600">{String((settings as any).error)}</p>
        ) : (
          <form action={updateSettings} className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm">Default Threshold</label>
                <input name="thresholdDefault" type="number" defaultValue={(settings as any)?.thresholdDefault || 3} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="text-sm">Strict Threshold</label>
                <input name="thresholdStrict" type="number" defaultValue={(settings as any)?.thresholdStrict || 2} className="border p-2 rounded w-full" />
              </div>
              <div>
                <label className="text-sm">Violation Limit (24h)</label>
                <input name="violationLimit24h" type="number" defaultValue={(settings as any)?.violationLimit24h || 5} className="border p-2 rounded w-full" />
              </div>
            </div>
            <button type="submit" className="px-3 py-2 bg-indigo-600 text-white rounded">Update Settings</button>
          </form>
        )}
      </section>
    </div>
  )
}

