'use client'

import { useMemo } from 'react'
import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import { toTitleCase } from '@/lib/utils'

const MAX_SUGGESTIONS = 8

const normalizeValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const buildSuggestions = (
  queryValue: string,
  entries: Array<{ original: string; normalized: string }>
) => {
  const trimmed = queryValue.trim()
  if (!trimmed) return []

  const normalizedQuery = normalizeValue(trimmed)
  if (!normalizedQuery) return []

  const startsWithMatches = entries.filter((entry) =>
    entry.normalized.startsWith(normalizedQuery)
  )
  const containsMatches = entries.filter(
    (entry) =>
      entry.normalized.includes(normalizedQuery) &&
      !entry.normalized.startsWith(normalizedQuery)
  )

  const combined = [...startsWithMatches, ...containsMatches]
  const deduped: string[] = []
  const seen = new Set<string>()

  for (const entry of combined) {
    if (!seen.has(entry.original)) {
      seen.add(entry.original)
      deduped.push(entry.original)
    }
    if (deduped.length >= MAX_SUGGESTIONS) break
  }

  return deduped
}

const resolveLabel = (
  value: string,
  lookup: Map<string, string>,
  fallback: (input: string) => string = toTitleCase
) => {
  const normalized = normalizeValue(value)
  if (!normalized) return ''
  return lookup.get(normalized) ?? fallback(value)
}

interface UseSuggestionEngineReturn {
  subjectEntries: Array<{ original: string; normalized: string }>
  subjectLookup: Map<string, string>
  subjectSuggestions: string[]
  teacherEntries: Array<{ original: string; normalized: string }>
  teacherLookup: Map<string, string>
  teacherSuggestions: string[]
  normalizeValue: (value: string) => string
  resolveLabel: (value: string, lookup: Map<string, string>, fallback?: (input: string) => string) => string
}

export function useSuggestionEngine(
  noteEditingId: string | null,
  noteDraft: { subject: string; teacher: string }
): UseSuggestionEngineReturn {
  const subjectEntries = useMemo(
    () => SUBJECT_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )

  const subjectLookup = useMemo(() => {
    const map = new Map<string, string>()
    subjectEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [subjectEntries])

  const subjectSuggestions = useMemo(
    () => (noteEditingId ? buildSuggestions(noteDraft.subject, subjectEntries) : []),
    [noteDraft.subject, noteEditingId, subjectEntries]
  )

  const teacherEntries = useMemo(
    () => TEACHER_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) })),
    []
  )

  const teacherLookup = useMemo(() => {
    const map = new Map<string, string>()
    teacherEntries.forEach((entry) => {
      if (!map.has(entry.normalized)) {
        map.set(entry.normalized, entry.original)
      }
    })
    return map
  }, [teacherEntries])

  const teacherSuggestions = useMemo(
    () => (noteEditingId ? buildSuggestions(noteDraft.teacher, teacherEntries) : []),
    [noteDraft.teacher, noteEditingId, teacherEntries]
  )

  return {
    subjectEntries,
    subjectLookup,
    subjectSuggestions,
    teacherEntries,
    teacherLookup,
    teacherSuggestions,
    normalizeValue,
    resolveLabel,
  }
}