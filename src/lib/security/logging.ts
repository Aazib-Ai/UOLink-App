import { NextRequest } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { randomUUID as nodeRandomUUID } from 'crypto'
import { getSecurityLogger } from './logging-service'
import type { SecurityEventType, Severity, SecurityEvent } from './logging-config'

// Re-export types for backward compatibility
export type { SecurityEventType, Severity, SecurityEvent } from './logging-config'

export interface AuditEvent {
  action: string
  resource: string
  userId?: string
  timestamp?: Date
  ipAddress?: string | null
  userAgent?: string | null
  correlationId: string
  details?: Record<string, any>
}

function now() {
  return new Date()
}

// Control console logging for security/audit spans.
// Defaults:
// - Development: enabled (helps debug locally)
// - Production: disabled unless SECURITY_LOG_TO_CONSOLE=true or LOG_API_VERBOSE=true/1
const LOG_TO_CONSOLE =
  process.env.SECURITY_LOG_TO_CONSOLE === 'true' ||
  process.env.LOG_API_VERBOSE === 'true' ||
  process.env.LOG_API_VERBOSE === '1' ||
  process.env.NODE_ENV !== 'production'

export function generateCorrelationId(): string {
  try {
    // Prefer crypto UUID where available
    if (typeof nodeRandomUUID === 'function') {
      return nodeRandomUUID()
    }
  } catch {}
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(16).slice(2, 10)
  return `${ts}-${rand}`
}

export function getRequestContext(req?: NextRequest): {
  ipAddress: string | null
  userAgent: string | null
  endpoint: string | undefined
} {
  if (!req) return { ipAddress: null, userAgent: null, endpoint: undefined }
  const hdr = req.headers
  const xff = hdr.get('x-forwarded-for') || hdr.get('X-Forwarded-For') || ''
  const ip = xff ? xff.split(',')[0].trim() : hdr.get('x-real-ip') || hdr.get('X-Real-IP') || null
  const userAgent = (hdr.get('user-agent') || hdr.get('User-Agent') || '')?.trim() || null
  const endpoint = req.nextUrl?.pathname
  return { ipAddress: ip, userAgent, endpoint }
}

function safeFirestoreWrite(collection: string, data: Record<string, any>) {
  try {
    const db = getAdminDb()
    return db.collection(collection).add(data)
  } catch (err) {
    // Environment may not be configured; optionally log a warning
    if (LOG_TO_CONSOLE) {
      console.warn('[security.logging] Firestore write skipped:', (err as Error)?.message)
    }
    return Promise.resolve(undefined as unknown as void)
  }
}

export async function logSecurityEvent(event: SecurityEvent) {
  // Use the enhanced security logger for sampled and batched logging
  const logger = getSecurityLogger()
  const start = Date.now()
  await logger.logEvent(event)
  const overheadMs = Date.now() - start
  try {
    const { recordPerfMetric } = await import('@/lib/performance/bench')
    await recordPerfMetric('security_logging_overhead_ms', overheadMs, {
      endpoint: event.endpoint,
      type: event.type,
      correlationId: event.correlationId,
      phase: 'logSecurityEvent'
    })
  } catch {}
  
  // Keep backward compatibility with existing Firestore writes for critical events
  const record = {
    type: event.type,
    severity: event.severity || inferSeverity(event.type),
    userId: event.userId || null,
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
    endpoint: event.endpoint || null,
    details: event.details || {},
    timestamp: (event.timestamp || now()).toISOString(),
    correlationId: event.correlationId,
  }

  // Separate collection for R2-specific errors
  if (record.type === 'R2_ERROR') {
    await safeFirestoreWrite('r2_errors', record)
  }

  // Generate alerts for critical events (backward compatibility)
  if (record.severity === 'CRITICAL' || record.type === 'RATE_LIMIT_EXCEEDED') {
    const alert = {
      level: record.severity,
      eventType: record.type,
      endpoint: record.endpoint,
      correlationId: record.correlationId,
      timestamp: record.timestamp,
      details: record.details,
    }
    if (LOG_TO_CONSOLE) {
      console.warn(JSON.stringify({ category: 'security_alert', ...alert }))
    }
    await safeFirestoreWrite('security_alerts', alert)
  }
}

// Lightweight helper to log R2 operations for error-rate alerting
export async function logR2Operation(
  operation: 'put' | 'get' | 'delete' | 'head' | 'copy',
  success: boolean,
  details?: Record<string, any>
) {
  const logger = getSecurityLogger()
  await logger.logR2Operation(operation, success, details)
}

export async function logAuditEvent(audit: AuditEvent) {
  // Use the enhanced security logger for audit events
  const logger = getSecurityLogger()
  await logger.logEvent({
    type: 'DATA_ACCESS', // Map audit events to security event type
    severity: 'LOW',
    userId: audit.userId,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
    correlationId: audit.correlationId,
    details: {
      action: audit.action,
      resource: audit.resource,
      ...audit.details
    }
  })
  
  // Keep backward compatibility
  const record = {
    action: audit.action,
    resource: audit.resource,
    userId: audit.userId || null,
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
    timestamp: (audit.timestamp || now()).toISOString(),
    correlationId: audit.correlationId,
    details: audit.details || {},
  }
  if (LOG_TO_CONSOLE) {
    console.log(JSON.stringify({ category: 'audit_event', ...record }))
  }
  await safeFirestoreWrite('audit_logs', record)
}

export function startRouteSpan(route: string, request?: NextRequest, userId?: string) {
  const { ipAddress, userAgent, endpoint } = getRequestContext(request)
  const correlationId = generateCorrelationId()
  const startTs = Date.now()
  if (LOG_TO_CONSOLE) {
    console.log(JSON.stringify({
      category: 'security_span_start',
      route,
      endpoint,
      userId: userId || null,
      ipAddress,
      userAgent,
      correlationId,
      ts: startTs,
    }))
  }
  return {
    route,
    endpoint,
    userId,
    ipAddress,
    userAgent,
    correlationId,
    startTs,
  }
}

export async function endRouteSpan(span: ReturnType<typeof startRouteSpan>, status: number, error?: any) {
  const durationMs = Date.now() - span.startTs
  
  // Use the enhanced security logger for route metrics
  const logger = getSecurityLogger()
  const logStart = Date.now()
  await logger.logRouteMetrics(span.route, span.endpoint || '', status, durationMs, span.correlationId)
  const logOverheadMs = Date.now() - logStart
  // Record security logging overhead (sampled)
  try {
    const { recordPerfMetric } = await import('@/lib/performance/bench')
    await recordPerfMetric('security_logging_overhead_ms', logOverheadMs, {
      route: span.route,
      endpoint: span.endpoint,
      status,
      correlationId: span.correlationId,
      phase: 'endRouteSpan'
    })
  } catch {}
  
  // Keep backward compatibility
  const payload: Record<string, any> = {
    category: 'security_span_end',
    route: span.route,
    endpoint: span.endpoint,
    userId: span.userId || null,
    correlationId: span.correlationId,
    status,
    durationMs,
  }
  if (error) {
    payload.error = error?.message || String(error)
    payload.stack = error?.stack
  }
  if (LOG_TO_CONSOLE) {
    console.log(JSON.stringify(payload))
  }
  
  // Persist metrics sample (backward compatibility)
  await safeFirestoreWrite('security_metrics', {
    route: span.route,
    endpoint: span.endpoint,
    status,
    durationMs,
    correlationId: span.correlationId,
    timestamp: new Date().toISOString(),
  })
}

function inferSeverity(type: SecurityEventType): Severity {
  switch (type) {
    case 'AUTH_FAILURE':
    case 'ACCESS_DENIED':
      return 'MEDIUM'
    case 'RATE_LIMIT_EXCEEDED':
    case 'SUSPICIOUS_ACTIVITY':
      return 'HIGH'
    case 'ERROR':
      return 'LOW'
    case 'AUTH_SUCCESS':
    case 'DATA_ACCESS':
    default:
      return 'LOW'
  }
}
