import { z } from 'zod'

// Schema for write operations to the notes collection
// Enforces string types for semester, section, and materialSequence with coercion
export const noteWriteSchema = z
  .object({
    semester: z.coerce.string().optional(),
    section: z.coerce.string().optional(),
    materialType: z.string().optional(),
    materialSequence: z.coerce.string().optional(),
  })
  .transform((val) => {
    const semester = (val.semester ?? '').toString().trim()
    const section = (val.section ?? '').toString().trim()

    const isSequenced = (val.materialType || '').toLowerCase() === 'assignment' ||
      (val.materialType || '').toLowerCase() === 'quiz'

    const materialSequenceRaw = (val.materialSequence ?? '').toString().trim()
    const materialSequence = isSequenced ? materialSequenceRaw : ''

    return {
      semester,
      section,
      materialSequence,
    }
  })

export type NoteWriteNormalized = z.infer<typeof noteWriteSchema>

// Helper to enforce schema on arbitrary write payloads
export function enforceNoteSchemaOnWrite<T extends Record<string, any>>(payload: T): T & NoteWriteNormalized {
  const parsed = noteWriteSchema.safeParse(payload)
  if (parsed.success) {
    return { ...payload, ...parsed.data }
  }
  // Fallback normalization when parsing fails for unexpected inputs
  const semester = typeof payload.semester === 'string'
    ? payload.semester.trim()
    : payload.semester != null
      ? String(payload.semester).trim()
      : ''

  const section = typeof payload.section === 'string'
    ? payload.section.trim()
    : payload.section != null
      ? String(payload.section).trim()
      : ''

  const mt = typeof payload.materialType === 'string' ? payload.materialType.toLowerCase() : ''
  const isSequenced = mt === 'assignment' || mt === 'quiz'
  const seq = payload.materialSequence != null ? String(payload.materialSequence).trim() : ''

  return {
    ...payload,
    semester,
    section,
    materialSequence: isSequenced ? seq : '',
  }
}

