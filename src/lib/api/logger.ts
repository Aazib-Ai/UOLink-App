import { NextRequest } from 'next/server'

// Control API request logging verbosity via env. By default, only errors are logged.
// Set LOG_API_VERBOSE=true to enable start/end structured logs.
const VERBOSE_API_LOGS =
  process.env.LOG_API_VERBOSE === 'true' ||
  process.env.LOG_API_VERBOSE === '1'

interface LogContext {
  id: string
  route: string
  method: string
  start: number
  userId?: string
}

function now() { return Date.now() }
function rid() { return Math.random().toString(36).slice(2, 10) }

export function logRequestStart(route: string, request: NextRequest, userId?: string): LogContext {
  const ctx: LogContext = {
    id: rid(),
    route,
    method: request.method,
    start: now(),
    userId,
  }
  // Structured log for observability systems
  if (VERBOSE_API_LOGS) {
    console.log(JSON.stringify({
      type: 'api_request_start',
      id: ctx.id,
      route: ctx.route,
      method: ctx.method,
      userId: ctx.userId || null,
      url: request.nextUrl?.pathname,
      ts: ctx.start,
    }))
  }
  return ctx
}

export function logRequestEnd(ctx: LogContext, status: number, extra?: Record<string, any>) {
  const duration = now() - ctx.start
  if (VERBOSE_API_LOGS) {
    console.log(JSON.stringify({
      type: 'api_request_end',
      id: ctx.id,
      route: ctx.route,
      method: ctx.method,
      status,
      duration_ms: duration,
      userId: ctx.userId || null,
      ...extra,
    }))
  }
}

export function logApiError(route: string, error: any, extra?: Record<string, any>) {
  const message = error?.message || String(error)
  console.error(JSON.stringify({
    type: 'api_error',
    route,
    message,
    stack: error?.stack,
    ...extra,
  }))
}

export function logAuthFailure(request: NextRequest, reason: string) {
  console.warn(JSON.stringify({
    type: 'auth_failure',
    route: request.nextUrl?.pathname,
    method: request.method,
    reason,
    ts: now(),
  }))
}
