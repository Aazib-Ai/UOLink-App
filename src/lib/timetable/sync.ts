import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2SendWithRetry, getR2BucketName } from '@/lib/r2'
import { parseTimetableCsv, TimetableEntry } from './csv_parser'

export type TabGid = { day: string; gid: string }

const buildCsvUrl = (sheetId: string, gid: string) =>
  `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

export async function fetchGoogleSheetCsv(sheetId: string, gid: string): Promise<string> {
  const url = buildCsvUrl(sheetId, gid)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/csv,*/*;q=0.8',
      'User-Agent': 'UoLink-Timetable-Fetch/1.0',
    },
  })
  if (!res.ok) throw new Error(`Failed to fetch CSV (gid=${gid}): ${res.status} ${res.statusText}`)
  return await res.text()
}

export async function buildTimetableJson(): Promise<{ day: string; entries: TimetableEntry[] }[]> {
  const sheetId = process.env.SHEET_ID || ''
  const tabGidsRaw = process.env.TAB_GIDS || '[]'
  if (!sheetId) throw new Error('SHEET_ID is not configured')

  let tabs: TabGid[] = []
  try {
    tabs = JSON.parse(tabGidsRaw)
  } catch (e) {
    throw new Error('TAB_GIDS is not valid JSON')
  }

  const results: { day: string; entries: TimetableEntry[] }[] = []
  for (const { day, gid } of tabs) {
    const csv = await fetchGoogleSheetCsv(sheetId, gid)
    const entries = parseTimetableCsv(csv)
    results.push({ day, entries })
  }
  return results
}

export async function publishTimetableJson(objectKey = 'master_timetable.json'): Promise<{ key: string }> {
  const json = await buildTimetableJson()
  const body = Buffer.from(JSON.stringify(json, null, 2), 'utf-8')
  const bucket = getR2BucketName()

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: body,
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'no-cache, no-store, must-revalidate',
  })

  await r2SendWithRetry(command, { operation: 'put', objectKey })
  return { key: objectKey }
}
