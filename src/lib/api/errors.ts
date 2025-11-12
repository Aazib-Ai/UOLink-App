import { NextResponse } from 'next/server'

export interface APIErrorPayload {
  error: string
  code?: string
  details?: string
}

export const ErrorResponses: Record<string, APIErrorPayload> = {
  UNAUTHORIZED: { error: 'Authentication required', code: 'AUTH_REQUIRED' },
  FORBIDDEN: { error: 'Access denied', code: 'ACCESS_DENIED' },
  NOT_FOUND: { error: 'Resource not found', code: 'NOT_FOUND' },
  VALIDATION_ERROR: { error: 'Invalid input data', code: 'VALIDATION_FAILED' },
  COOLDOWN_ACTIVE: { error: 'Action on cooldown', code: 'COOLDOWN_ACTIVE' },
  ALREADY_EXISTS: { error: 'Resource already exists', code: 'DUPLICATE' },
}

export function apiError(status: number, payload: APIErrorPayload) {
  return NextResponse.json(payload, { status })
}

export function apiErrorByKey(status: number, key: keyof typeof ErrorResponses, details?: string) {
  const base = ErrorResponses[key]
  return apiError(status, details ? { ...base, details } : base)
}

