'use client'

// Minimal IndexedDB wrapper for timetable persistence with version/etag metadata

export type TimetableEntry = {
  day: string
  department: string
  sub_department: string
  time_slot: string
  room_name: string
  subject: string
  course_code: string
  program: string
  semester: string
  section: string
  teacher_name: string
  teacher_sap_id: string
  raw_text: string
  is_lab_session?: string
  lab_duration?: string
  is_merged_class?: string
  merged_programs?: { program: string; semester: string; section: string }[] | string
}

export type TimetableRecord = {
  key: string // always 'master'
  data: TimetableEntry[]
  meta: {
    version: string
    etag?: string
    updatedAt: number // server-derived timestamp when payload was produced
    expiresAt: number // ms epoch for next daily refresh cutover
  }
}

const DB_NAME = 'uolink'
const DB_VERSION = 1
const STORE_NAME = 'kv'
export const TIMETABLE_KEY = 'timetable:master'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDB()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    fn(store)
      .then((result) => {
        tx.oncomplete = () => resolve(result)
        tx.onerror = () => reject(tx.error)
      })
      .catch((e) => reject(e))
  })
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  return withStore<T | null>('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => resolve((req.result as T) ?? null)
      req.onerror = () => reject(req.error)
    })
  })
}

export async function idbSet<T = unknown>(key: string, value: T): Promise<void> {
  return withStore<void>('readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.put(value as any, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

export async function idbDel(key: string): Promise<void> {
  return withStore<void>('readwrite', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.delete(key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  })
}

export async function getTimetable(): Promise<TimetableRecord | null> {
  const value = await idbGet<TimetableRecord>(TIMETABLE_KEY)
  if (!value) return null
  if (!value?.meta?.expiresAt || !Array.isArray(value?.data)) return null
  return value
}

export async function setTimetable(record: TimetableRecord): Promise<void> {
  const safe: TimetableRecord = {
    key: 'master',
    data: Array.isArray(record.data) ? record.data : [],
    meta: {
      version: String(record.meta.version || ''),
      etag: record.meta.etag,
      updatedAt: Number(record.meta.updatedAt || Date.now()),
      expiresAt: Number(record.meta.expiresAt || Date.now()),
    },
  }
  await idbSet(TIMETABLE_KEY, safe)
}

export async function clearTimetable(): Promise<void> {
  await idbDel(TIMETABLE_KEY)
}
