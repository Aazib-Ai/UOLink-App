const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const firestore = admin.firestore()

// Initialize Firebase Admin (even if unused, keeps parity with project setup)
try {
  admin.app()
} catch (_) {
  admin.initializeApp()
}

const { parseTimetableCsv } = require('./csv_parser')

const buildCsvUrl = (sheetId, gid) => `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

async function fetchGoogleSheetCsv(sheetId, gid) {
  const res = await fetch(buildCsvUrl(sheetId, gid), {
    method: 'GET',
    headers: {
      'Accept': 'text/csv,*/*;q=0.8',
      'User-Agent': 'UoLink-Timetable-Fetch/1.0',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch CSV (gid=${gid}): ${res.status} ${res.statusText}`)
  return await res.text()
}

async function buildTimetableJson() {
  const sheetId = (process.env.SHEET_ID || '').trim()
  const tabGidsRaw = (process.env.TAB_GIDS || '[]').trim()
  if (!sheetId) throw new Error('SHEET_ID is not configured')

  let tabs = []
  try {
    tabs = JSON.parse(tabGidsRaw)
  } catch (e) {
    throw new Error('TAB_GIDS is not valid JSON')
  }

  const results = []
  for (const { day, gid } of tabs) {
    const csv = await fetchGoogleSheetCsv(sheetId, gid)
    const entries = parseTimetableCsv(csv)
    results.push({ day, entries })
  }
  return results
}

function getR2Client() {
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '').trim()
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || '').trim()
  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('Missing R2 credentials (ACCESS_KEY_ID/SECRET_ACCESS_KEY/ACCOUNT_ID)')
  }
  const endpoint = (process.env.CLOUDFLARE_R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`).trim()
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
}

async function publishTimetableJson(objectKey = 'master_timetable.json') {
  const json = await buildTimetableJson()
  const body = Buffer.from(JSON.stringify(json, null, 2), 'utf-8')
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.CLOUDFLARE_R2_BUCKET || '').trim()
  if (!bucket) throw new Error('CLOUDFLARE_R2_BUCKET_NAME (or CLOUDFLARE_R2_BUCKET) is not configured')
  const client = getR2Client()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-cache, no-store, must-revalidate',
  })
  await client.send(command)
  return { key: objectKey }
}

exports.scheduleTimetableFetch = onSchedule({
  // Run daily at 06:00 Pakistan Standard Time (Asia/Karachi)
  schedule: '0 6 * * *',
  timeZone: 'Asia/Karachi',
  timeoutSeconds: 120,
  memory: '256MiB',
  secrets: [
    'SHEET_ID',
    'TAB_GIDS',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_ENDPOINT',
  ],
}, async () => {
  try {
    const { key } = await publishTimetableJson()
    console.log('[Timetable Sync] Published to R2:', key)
  } catch (e) {
    console.error('[Timetable Sync] Error:', e?.message || e)
    throw e
  }
})

exports.runTimetableFetch = onRequest({
  timeoutSeconds: 120,
  memory: '256MiB',
  secrets: [
    'SHEET_ID',
    'TAB_GIDS',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_ACCOUNT_ID',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_ENDPOINT',
  ],
}, async (req, res) => {
  try {
    const { key } = await publishTimetableJson()
    res.json({ ok: true, key })
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || 'Unknown error' })
  }
})

// ---- Username Alias Cleanup (scheduled) ----
async function cleanupExpiredAliases(limit = 500) {
  const now = admin.firestore.Timestamp.now()
  const col = firestore.collection('username_history')
  const snap = await col
    .where('aliasExpiresAt', '<=', now)
    .orderBy('aliasExpiresAt', 'asc')
    .limit(limit)
    .get()

  if (snap.empty) {
    console.log('[Alias Cleanup] No expired aliases found')
    return { deleted: 0 }
  }

  const batch = firestore.batch()
  let count = 0
  for (const doc of snap.docs) {
    batch.delete(doc.ref)
    count++
  }
  await batch.commit()
  console.log(`[Alias Cleanup] Deleted ${count} expired alias records`)
  return { deleted: count }
}

exports.cleanupExpiredAliases = onSchedule({
  schedule: '*/30 * * * *', // every 30 minutes
  timeZone: 'UTC',
  timeoutSeconds: 60,
  memory: '256MiB',
}, async () => {
  try {
    const { deleted } = await cleanupExpiredAliases(500)
    console.log('[Alias Cleanup] Completed run; deleted:', deleted)
  } catch (e) {
    console.error('[Alias Cleanup] Error:', e?.message || e)
    throw e
  }
})

