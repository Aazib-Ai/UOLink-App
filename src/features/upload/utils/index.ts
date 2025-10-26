import { SUBJECT_NAMES, TEACHER_NAMES } from '@/constants/universityData'
import { MAX_SUGGESTIONS } from '../constants'

export const normalizeValue = (value: string) =>
    value
        .toLowerCase()
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

export const buildSuggestions = (
    query: string,
    entries: Array<{ original: string; normalized: string }>
) => {
    const trimmed = query.trim()
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
    const seen = new Set<string>()
    const results: string[] = []

    for (const entry of combined) {
        if (!seen.has(entry.original)) {
            seen.add(entry.original)
            results.push(entry.original)
        }

        if (results.length >= MAX_SUGGESTIONS) {
            break
        }
    }

    return results
}

export const createSubjectEntries = () =>
    SUBJECT_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) }))

export const createTeacherEntries = () =>
    TEACHER_NAMES.map((name) => ({ original: name, normalized: normalizeValue(name) }))

export const createLookupMap = (entries: Array<{ original: string; normalized: string }>) => {
    const map = new Map<string, string>()
    entries.forEach((entry) => {
        if (!map.has(entry.normalized)) {
            map.set(entry.normalized, entry.original)
        }
    })
    return map
}