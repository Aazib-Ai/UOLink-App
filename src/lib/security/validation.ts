import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { apiErrorByKey } from '@/lib/api/errors'
import {
  SUPPORTED_UPLOAD_EXTENSIONS,
  SUPPORTED_UPLOAD_MIME_TYPES,
  resolveUploadDescriptorByExtension,
  resolveUploadDescriptorByMime,
  getSupportedFileTypeSummary,
} from '@/constants/uploadFileTypes'

export interface ValidationConfig {
  maxTextLength: number
  allowedFileTypes: string[]
  maxFileSize: number // in bytes
  requiredFields: string[]
}

export interface ValidationError {
  field?: string
  message: string
}

export interface ValidationResult<T = any> {
  isValid: boolean
  errors: ValidationError[]
  sanitizedData?: T
}

// Default configuration aligned with security design
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxTextLength: Number(process.env.MAX_TEXT_LENGTH || 1000),
  allowedFileTypes: Array.from(SUPPORTED_UPLOAD_EXTENSIONS),
  maxFileSize: (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '25') * 1024 * 1024),
  requiredFields: [],
}

// Basic HTML and script sanitization (defense-in-depth; UI should not render raw HTML)
export function sanitizeText(input: string, maxLen = DEFAULT_VALIDATION_CONFIG.maxTextLength): string {
  if (!input || typeof input !== 'string') return ''
  let s = input
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim()
  // Strip script tags and most HTML tags
  s = s.replace(/<\/?script[^>]*>/gi, '')
  s = s.replace(/<[^>]+>/g, '')
  // Remove dangerous unicode control characters
  s = s.replace(/[\u0000-\u001F\u007F]/g, '')
  // Collapse excessive punctuation sequences
  s = s.replace(/([!?.])\1{4,}/g, '$1$1$1')
  // Truncate
  if (s.length > maxLen) s = s.slice(0, maxLen)
  return s
}

// Detect repeated blocks to mitigate spam (e.g., "aaaaaa" or repeated words)
export function hasExcessiveRepetition(input: string, minBlock = 3, minRepeats = 3): boolean {
  if (!input) return false
  const s = input.trim()
  // Same char repeated many times
  if (/([\p{L}\p{N}\W])\1{6,}/u.test(s)) return true
  const words = s.split(/\s+/)

  // Single-word consecutive repetition (e.g., "abc abc abc abc abc abc")
  let run = 1
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      run++
      if (run >= Math.max(5, minRepeats)) return true
    } else {
      run = 1
    }
  }

  // Multi-word block consecutive repetition
  if (minBlock > 1) {
    for (let i = 0; i + minBlock * minRepeats <= words.length; i++) {
      const firstBlock = words.slice(i, i + minBlock).join(' ')
      let repeats = 1
      for (let j = i + minBlock; j + minBlock <= words.length; j += minBlock) {
        const nextBlock = words.slice(j, j + minBlock).join(' ')
        if (nextBlock === firstBlock) {
          repeats++
          if (repeats >= minRepeats) return true
        } else {
          break
        }
      }
    }
  }

  return false
}

export function sanitizeUrl(input?: string, maxLen = 2048): string {
  if (!input || typeof input !== 'string') return ''
  const s = input.trim()
  if (!s) return ''
  try {
    const url = new URL(s)
    const sanitized = url.toString()
    return sanitized.length > maxLen ? sanitized.slice(0, maxLen) : sanitized
  } catch {
    return ''
  }
}

// Generic JSON request validation helper
export async function validateRequestJSON<T>(request: NextRequest, schema: z.ZodSchema<T>): Promise<{ ok: boolean; data?: T; error?: NextResponse }> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return { ok: false, error: apiErrorByKey(400, 'VALIDATION_ERROR', 'Invalid JSON body') }
  }

  const parse = schema.safeParse(body)
  if (!parse.success) {
    const fields = parse.error.issues.map((i) => i.path.join('.') || 'root')
    const details = fields.length ? `Invalid fields: ${Array.from(new Set(fields)).join(', ')}` : undefined
    return { ok: false, error: apiErrorByKey(400, 'VALIDATION_ERROR', details) }
  }

  return { ok: true, data: parse.data }
}

// File upload validation that accepts minimal File-like object
export function validateFileUpload(file: Pick<File, 'name' | 'size' | 'type'>, cfg: ValidationConfig = DEFAULT_VALIDATION_CONFIG): ValidationResult<{ extension: string; contentType: string }> {
  const errors: ValidationError[] = []
  if (!file) {
    return { isValid: false, errors: [{ message: 'No file received' }] }
  }

  const name = (file.name || '').trim()
  const type = (file.type || '').toLowerCase()
  const size = Number(file.size || 0)

  if (!name) errors.push({ field: 'file', message: 'Missing file name' })
  if (!Number.isFinite(size) || size <= 0) errors.push({ field: 'file', message: 'Invalid file size' })

  if (size > cfg.maxFileSize) {
    errors.push({ field: 'file', message: `File exceeds the ${Math.floor(cfg.maxFileSize / (1024 * 1024))} MB limit` })
  }

  const ext = name.includes('.') ? (name.split('.').pop() || '').toLowerCase() : ''
  const mimeMatch = type ? resolveUploadDescriptorByMime(type) : undefined
  const extMatch = ext ? resolveUploadDescriptorByExtension(ext) : undefined

  if (!mimeMatch && !extMatch) {
    const summary = getSupportedFileTypeSummary()
    errors.push({ field: 'file', message: summary ? `Only ${summary} are supported` : 'Unsupported file type' })
  } else {
    // Validate against known lists
    if (type && !SUPPORTED_UPLOAD_MIME_TYPES.has(type)) {
      errors.push({ field: 'file', message: 'Unsupported MIME type' })
    }
    if (ext && !SUPPORTED_UPLOAD_EXTENSIONS.has(ext)) {
      errors.push({ field: 'file', message: 'Unsupported file extension' })
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: {
      extension: extMatch?.extension ?? mimeMatch?.extension ?? (ext || 'pdf'),
      contentType: type || mimeMatch?.mimeTypes[0] || extMatch?.mimeTypes[0] || 'application/octet-stream',
    },
  }
}

// ===== Zod Schemas for Endpoints =====

// Upload metadata schema (form fields)
export const uploadMetadataSchema = z.object({
  name: z.string().min(1).max(200).transform((v) => sanitizeText(v, 200)),
  subject: z.string().min(1).max(200).transform((v) => sanitizeText(v, 200)),
  teacher: z.string().min(1).max(200).transform((v) => sanitizeText(v, 200)),
  semester: z.enum(['1', '2', '3', '4', '5', '6', '7', '8']),
  section: z.enum(['A', 'B', 'C']),
  materialType: z.enum(['assignment', 'quiz', 'lecture', 'slides', 'midterm-notes', 'final-term-notes', 'books']),
  materialSequence: z.string().optional().refine((v) => v === undefined || ['1', '2', '3', '4'].includes(String(v)), {
    message: 'Select a valid assignment or quiz number (1-4)'
  }),
  contributorName: z.string().min(1).max(100).transform((v) => sanitizeText(v, 100)),
  contributorMajor: z.string().optional().transform((v) => sanitizeText(v || '', 100)),
}).superRefine((val, ctx) => {
  if ((val.materialType === 'assignment' || val.materialType === 'quiz') && !val.materialSequence) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['materialSequence'], message: 'Sequence required for assignments/quizzes' })
  }
})

// Comment body schema
export const addCommentSchema = z.object({
  text: z.string().min(1).max(DEFAULT_VALIDATION_CONFIG.maxTextLength).transform((v) => sanitizeText(v)),
  userName: z.string().optional().transform((v) => sanitizeText(v || '')),
  userDisplayName: z.string().optional().transform((v) => sanitizeText(v || '')),
  userUsername: z.string().optional().transform((v) => sanitizeText(v || '')),
}).refine((obj) => !hasExcessiveRepetition(obj.text), {
  message: 'Text contains excessive repetition',
  path: ['text']
})

// Reply body schema (aligned with server route requirements)
export const addReplySchema = z.object({
  text: z.string().min(1).max(2000).transform((v) => sanitizeText(v, 2000)),
  userName: z.string().optional().transform((v) => sanitizeText(v || '')),
  userDisplayName: z.string().optional().transform((v) => sanitizeText(v || '')),
  userUsername: z.string().optional().transform((v) => sanitizeText(v || '')),
}).refine((obj) => !hasExcessiveRepetition(obj.text), {
  message: 'Text contains excessive repetition',
  path: ['text']
})

// Profile update schema
export const profileUpdateSchema = z.object({
  fullName: z.string().optional().transform((v) => sanitizeText(v || '', 200)),
  major: z.string().optional().transform((v) => sanitizeText(v || '', 100)),
  semester: z.enum(['1', '2', '3', '4', '5', '6', '7', '8']).optional(),
  section: z.enum(['A', 'B', 'C']).optional(),
  bio: z.string().optional().transform((v) => sanitizeText(v || '')),
  about: z.string().optional().transform((v) => sanitizeText(v || '')),
  skills: z.array(z.string().transform((v) => sanitizeText(v, 50))).max(50).optional(),
  githubUrl: z.string().optional().transform((v) => sanitizeUrl(v)),
  linkedinUrl: z.string().optional().transform((v) => sanitizeUrl(v)),
  instagramUrl: z.string().optional().transform((v) => sanitizeUrl(v)),
  facebookUrl: z.string().optional().transform((v) => sanitizeUrl(v)),
  profilePicture: z.string().nullable().optional(),
  profilePictureStorageKey: z.string().nullable().optional(),
})

// Helper to get sanitized FormData values
export function parseAndValidateUploadFormData(formData: FormData): ValidationResult<{ meta: z.infer<typeof uploadMetadataSchema> }> {
  const obj: Record<string, any> = {}
  for (const key of ['name', 'subject', 'teacher', 'semester', 'section', 'materialType', 'materialSequence', 'contributorName', 'contributorMajor']) {
    const v = formData.get(key)
    obj[key] = typeof v === 'string' ? v.trim() : v
  }
  const parsed = uploadMetadataSchema.safeParse(obj)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'root')
    return { isValid: false, errors: [{ message: `Invalid fields: ${Array.from(new Set(fields)).join(', ')}` }] }
  }
  if (hasExcessiveRepetition(parsed.data.name) || hasExcessiveRepetition(parsed.data.subject)) {
    return { isValid: false, errors: [{ field: 'text', message: 'Input contains excessive repetition' }] }
  }
  return { isValid: true, errors: [], sanitizedData: { meta: parsed.data } }
}
