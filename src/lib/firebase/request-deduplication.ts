import { normalizeForStorage } from '@/lib/utils'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import type { NotesQueryResult, UserProfile } from '../data/types'
import { getNotesWithPagination, searchNotes, getFilterOptions } from './notes'
import { getUserProfile } from './profiles'
import { useEffect, useRef, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

type DedupOptions = { ttlMs?: number; timeoutMs?: number }
type DedupMetrics = { duplicatesPrevented: number; savedReadsEstimated: number }

const inFlight = new Map<string, Promise<any>>()
let metrics: DedupMetrics = { duplicatesPrevented: 0, savedReadsEstimated: 0 }

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Request timed out')), ms)
    p.then(v => { clearTimeout(t); resolve(v) }).catch(e => { clearTimeout(t); reject(e) })
  })
}

export async function dedupeRequest<T>(key: string, fn: () => Promise<T>, options?: DedupOptions): Promise<T> {
  const ttl = options?.ttlMs ?? 5000
  const timeout = options?.timeoutMs ?? 15000
  if (inFlight.has(key)) {
    const existing = inFlight.get(key) as Promise<T>
    metrics.duplicatesPrevented += 1
    metrics.savedReadsEstimated += 1
    console.info('[Dedup] Duplicate request prevented', { key })
    return existing
  }
  const p = withTimeout(fn(), timeout)
  inFlight.set(key, p as Promise<any>)
  const clear = () => { inFlight.delete(key) }
  const finalize = () => { setTimeout(clear, ttl) }
  try {
    const v = await p
    finalize()
    return v
  } catch (e) {
    clear()
    throw e
  }
}

export function clearDedupCache(): void {
  inFlight.clear()
}

export function getDedupMetrics(): DedupMetrics {
  return { ...metrics }
}

function keyForNotesPagination(pageSize?: number, lastDocSnapshot?: QueryDocumentSnapshot<DocumentData> | null, filters?: any): string {
  const f = filters || {}
  const subject = f.subject ? normalizeForStorage(f.subject) : ''
  const teacher = f.teacher ? normalizeForStorage(f.teacher) : ''
  const materialType = f.materialType ? normalizeForStorage(f.materialType) : ''
  const section = f.section ? String(f.section).trim().toUpperCase() : ''
  const materialSequence = f.materialSequence != null && f.materialSequence !== '' ? String(f.materialSequence).trim() : ''
  const semester = f.semester ?? ''
  const contributorName = f.contributorName ?? ''
  const contributorMajor = f.contributorMajor ?? ''
  const cursor = lastDocSnapshot?.id || 'none'
  return `notes:page:${pageSize || 10}|cursor:${cursor}|filters:${semester}|${subject}|${teacher}|${contributorName}|${contributorMajor}|${section}|${materialType}|${materialSequence}`
}

function keyForSearch(term: string, pageSize?: number, lastDocSnapshot?: QueryDocumentSnapshot<DocumentData> | null): string {
  const normalized = normalizeForStorage(term || '').trim()
  const cursor = lastDocSnapshot?.id || 'none'
  return `search:${normalized}|size:${pageSize || 20}|cursor:${cursor}`
}

export async function getNotesWithPaginationDeduped(pageSize = 10, lastDocSnapshot: any = null, filters: any = {}): Promise<NotesQueryResult> {
  const key = keyForNotesPagination(pageSize, lastDocSnapshot, filters)
  return dedupeRequest(key, () => getNotesWithPagination(pageSize, lastDocSnapshot, filters))
}

export async function searchNotesDeduped(searchTerm: string, pageSize = 20, lastDocSnapshot: any = null): Promise<NotesQueryResult> {
  const key = keyForSearch(searchTerm, pageSize, lastDocSnapshot)
  return dedupeRequest(key, () => searchNotes(searchTerm, pageSize, lastDocSnapshot))
}

export async function getFilterOptionsDeduped(): Promise<{ semesters: string[]; subjects: string[]; teachers: string[]; sections: string[]; materialTypes: string[]; materialSequences: string[] }> {
  const key = 'filters:options'
  return dedupeRequest(key, () => getFilterOptions())
}

export async function getUserProfileDeduped(userId: string): Promise<UserProfile | null> {
  const key = `profile:${userId}`
  return dedupeRequest(key, () => getUserProfile(userId))
}

export function useDedupedQuery<T>(key: string, fetcher: () => Promise<T>, deps: any[] = [], options?: DedupOptions & { clearOnNavigate?: boolean }) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  const pathname = usePathname()

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (options?.clearOnNavigate) clearDedupCache()
  }, [pathname, options?.clearOnNavigate])

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await dedupeRequest(key, fetcher, options)
      if (mounted.current) setData(result)
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : 'Error'
      if (mounted.current) setError(msg)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [key, fetcher, options, ...deps])

  useEffect(() => { run() }, [run])

  const refetch = useCallback(async () => { await run() }, [run])

  return { data, loading, error, refetch }
}
