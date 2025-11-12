export interface LoggingConfig {
  metricsSamplingRate: number // 0.01 to 0.1 (1% to 10%)
  batchWindowMs: number // Time window for batching writes (default 60000ms)
  criticalEventsImmediate: boolean // Write critical events immediately
  maxBatchSize: number // Maximum number of events per batch
  enabled: boolean // Master switch for logging
}

export interface BatchedLogEntry {
  events: SecurityEvent[]
  windowStart: number
  windowEnd: number
  aggregated: boolean
}

export interface AggregatedMetrics {
  route: string
  endpoint: string
  windowStart: string // ISO 8601
  windowEnd: string // ISO 8601
  requestCount: number
  errorCount: number
  avgDurationMs: number
  p50DurationMs: number
  p95DurationMs: number
  p99DurationMs: number
  statusCodes: Record<string, number>
  correlationIds: string[] // Sample of correlation IDs
  timestamp: string
}

export type SecurityEventType =
  | 'AUTH_FAILURE'
  | 'AUTH_SUCCESS'
  | 'ACCESS_DENIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DATA_ACCESS'
  | 'ERROR'
  | 'R2_ERROR' // R2-specific access or deletion errors

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SecurityEvent {
  type: SecurityEventType
  severity?: Severity
  userId?: string
  ipAddress?: string | null
  userAgent?: string | null
  endpoint?: string
  details?: Record<string, any>
  timestamp?: Date
  correlationId: string
  sampled?: boolean // NEW: indicates if this is a sampled event
}

/**
 * Get logging configuration from environment variables
 */
export function getLoggingConfig(): LoggingConfig {
  const metricsSamplingRate = parseFloat(process.env.SECURITY_METRICS_SAMPLING_RATE || '0.05') // Default 5%
  const batchWindowMs = parseInt(process.env.SECURITY_BATCH_WINDOW_MS || '60000', 10) // Default 60s
  const criticalEventsImmediate = process.env.SECURITY_CRITICAL_EVENTS_IMMEDIATE !== 'false' // Default true
  const maxBatchSize = parseInt(process.env.SECURITY_MAX_BATCH_SIZE || '100', 10) // Default 100 events
  const enabled = process.env.SECURITY_LOGGING_ENABLED !== 'false' // Default true

  // Validate sampling rate is within acceptable bounds (1-10%)
  const clampedSamplingRate = Math.max(0.01, Math.min(0.1, metricsSamplingRate))

  return {
    metricsSamplingRate: clampedSamplingRate,
    batchWindowMs: Math.max(1000, batchWindowMs), // Minimum 1 second
    criticalEventsImmediate,
    maxBatchSize: Math.max(10, maxBatchSize), // Minimum 10 events
    enabled
  }
}

/**
 * Determine if an event type should be considered critical
 */
export function isCriticalEvent(eventType: SecurityEventType): boolean {
  return ['AUTH_FAILURE', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED'].includes(eventType)
}

/**
 * Determine if an event should be sampled based on type and sampling rate
 */
export function shouldSampleEvent(event: SecurityEvent, samplingRate: number): boolean {
  // Critical events are never sampled (always logged)
  if (isCriticalEvent(event.type)) {
    return true
  }

  // Sample non-critical metrics based on rate
  if (event.type === 'DATA_ACCESS' || event.type === 'AUTH_SUCCESS') {
    return Math.random() <= samplingRate
  }

  // Other events are logged by default
  return true
}
