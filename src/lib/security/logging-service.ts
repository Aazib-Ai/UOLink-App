import { getAdminDb } from '@/lib/firebaseAdmin'
import { recordWriteThroughput } from '@/lib/performance/firestore-metrics'
import { 
  LoggingConfig, 
  BatchedLogEntry, 
  AggregatedMetrics, 
  SecurityEvent, 
  SecurityEventType,
  Severity,
  getLoggingConfig,
  isCriticalEvent,
  shouldSampleEvent
} from './logging-config'

/**
 * Enhanced security logger with sampling and batching capabilities
 */
export class SecurityLogger {
  private config: LoggingConfig
  private metricsBuffer: SecurityEvent[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private metricsAggregation: Map<string, RouteMetrics> = new Map()
  private isShuttingDown = false
  private r2Counters: R2Counters = { totalOps: 0, errorOps: 0, byOperation: {} }

  constructor(config?: LoggingConfig) {
    this.config = config || getLoggingConfig()
  }

  /**
   * Log a security event with sampling and batching
   * Returns true if event was logged, false if it was sampled out
   */
  async logEvent(event: SecurityEvent): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    // Ensure timestamp is set
    if (!event.timestamp) {
      event.timestamp = new Date()
    }

    // Determine if event should be sampled
    const shouldLog = shouldSampleEvent(event, this.config.metricsSamplingRate)
    if (!shouldLog) {
      return false
    }

    // Mark as sampled for tracking
    event.sampled = true

    // Critical events: write immediately
    if (isCriticalEvent(event.type)) {
      await this.writeEventToFirestore(event)
      return true
    }

    // Non-critical events: add to batch buffer
    this.metricsBuffer.push(event)
    this.scheduleBatchFlush()
    return true
  }

  /**
   * Log route metrics for aggregation
   */
  async logRouteMetrics(
    route: string,
    endpoint: string,
    status: number,
    durationMs: number,
    correlationId: string
  ): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    // Sample metrics based on configured rate
    if (Math.random() > this.config.metricsSamplingRate) {
      return
    }

    const key = `${route}|${endpoint}`
    let metrics = this.metricsAggregation.get(key)
    
    if (!metrics) {
      metrics = {
        route,
        endpoint,
        requestCount: 0,
        errorCount: 0,
        durations: [],
        statusCodes: {},
        correlationIds: [],
        windowStart: Date.now()
      }
      this.metricsAggregation.set(key, metrics)
    }

    metrics.requestCount++
    if (status >= 400) {
      metrics.errorCount++
    }
    metrics.durations.push(durationMs)
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1
    
    // Keep a sample of correlation IDs for debugging
    if (metrics.correlationIds.length < 10) {
      metrics.correlationIds.push(correlationId)
    }

    this.scheduleBatchFlush()
  }

  /**
   * Schedule batch flush if not already scheduled
   */
  private scheduleBatchFlush(): void {
    if (this.batchTimer || this.isShuttingDown) {
      return
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatch()
      this.batchTimer = null
    }, this.config.batchWindowMs)
  }

  /**
   * Flush current batch to Firestore
   */
  private async flushBatch(): Promise<void> {
    if (this.isShuttingDown) {
      return
    }

    const events = [...this.metricsBuffer]
    const metrics = new Map(this.metricsAggregation)
    const r2CountersSnapshot = { ...this.r2Counters, byOperation: { ...this.r2Counters.byOperation } }
    
    // Clear buffers
    this.metricsBuffer = []
    this.metricsAggregation.clear()
    this.r2Counters = { totalOps: 0, errorOps: 0, byOperation: {} }

    if (events.length === 0 && metrics.size === 0) {
      return
    }

    try {
      // Write individual events
      if (events.length > 0) {
        await this.writeBatchEvents(events)
      }

      // Write aggregated metrics
      if (metrics.size > 0) {
        await this.writeAggregatedMetrics(metrics)
      }

      // Evaluate R2 error rate and alert if threshold exceeded
      await this.evaluateAndAlertR2Errors(r2CountersSnapshot)

      // Evaluate security event rates and top violators within the window
      if (events.length > 0) {
        await this.evaluateEventRatesAndViolators(events)
      }
    } catch (error) {
      console.error('[SecurityLogger] Failed to flush batch:', error)
      // Don't throw - logging failures shouldn't break the application
    }
  }

  /**
   * Write batch of events to Firestore
   */
  private async writeBatchEvents(events: SecurityEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    const db = getAdminDb()
    const batch = db.batch()
    const collection = db.collection('security_events')

    for (const event of events) {
      const docRef = collection.doc()
      const record = {
        type: event.type,
        severity: event.severity || this.inferSeverity(event.type),
        userId: event.userId || null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        endpoint: event.endpoint || null,
        details: event.details || {},
        timestamp: (event.timestamp || new Date()).toISOString(),
        correlationId: event.correlationId,
        sampled: event.sampled || false,
      }
      batch.set(docRef, record)
    }

    await batch.commit()
    try {
      const now = new Date()
      const windowEnd = now.toISOString()
      const windowStart = new Date(now.getTime() - this.config.batchWindowMs).toISOString()
      await recordWriteThroughput(windowStart, windowEnd, events.length, 'security_events')
    } catch {}
  }

  /**
   * Write aggregated metrics to Firestore
   */
  private async writeAggregatedMetrics(metrics: Map<string, RouteMetrics>): Promise<void> {
    const db = getAdminDb()
    const batch = db.batch()
    const collection = db.collection('security_metrics_aggregated')
    const now = new Date()
    const windowEnd = now.toISOString()
    const windowStart = new Date(now.getTime() - this.config.batchWindowMs).toISOString()

    for (const [_, routeMetrics] of metrics) {
      if (routeMetrics.durations.length === 0) {
        continue
      }

      const aggregated = this.calculateAggregatedMetrics(routeMetrics, windowStart, windowEnd)
      const docRef = collection.doc()
      batch.set(docRef, aggregated)

      // Alert when per-route p95 latency exceeds 300ms (Requirement 9.3)
      if (aggregated.p95DurationMs > 300) {
        try {
          await db.collection('security_alerts').add({
            level: 'MEDIUM',
            eventType: 'API_P95_LATENCY_HIGH',
            timestamp: windowEnd,
            details: {
              route: aggregated.route,
              endpoint: aggregated.endpoint,
              p95DurationMs: aggregated.p95DurationMs,
              windowStart,
              windowEnd,
            },
          })
          console.warn('[SecurityLogger] API p95 latency high:', aggregated.route, aggregated.endpoint, aggregated.p95DurationMs)
        } catch (e) {
          console.error('[SecurityLogger] Failed to write p95 alert:', e)
        }
      }

      // Alert when 429 response rate exceeds 1%
      const total = aggregated.requestCount
      const s429 = (aggregated.statusCodes && (aggregated.statusCodes['429'] || aggregated.statusCodes[429])) || 0
      if (total > 0) {
        const rate = s429 / total
        if (rate > 0.01) {
          try {
            await db.collection('security_alerts').add({
              level: 'LOW',
              eventType: 'HTTP_429_RATE_HIGH',
              timestamp: windowEnd,
              details: {
                route: aggregated.route,
                endpoint: aggregated.endpoint,
                rate: Number(rate.toFixed(4)),
                s429,
                total,
                windowStart,
                windowEnd,
              },
            })
            console.warn('[SecurityLogger] 429 rate exceeded 1%:', aggregated.route, aggregated.endpoint, rate)
          } catch (e) {
            console.error('[SecurityLogger] Failed to write 429 alert:', e)
          }
        }
      }
    }

    await batch.commit()

    // Record write throughput for the window (events + aggregated metrics)
    try {
      const writesCount = metrics.size // aggregated metrics count; event writes recorded separately
      await recordWriteThroughput(windowStart, windowEnd, writesCount, 'security_metrics_aggregated')
    } catch {}
  }

  /**
   * Evaluate security event rates and track top violators (Requirement 9)
   */
  private async evaluateEventRatesAndViolators(events: SecurityEvent[]): Promise<void> {
    try {
      const db = getAdminDb()
      const now = new Date()
      const windowEnd = now.toISOString()
      const windowStart = new Date(now.getTime() - this.config.batchWindowMs).toISOString()

      // Count event rates for specific types
      const typesToTrack: SecurityEventType[] = ['AUTH_FAILURE', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY']
      const counts: Record<string, number> = {}
      const ipCounts: Record<string, Record<string, number>> = {}
      const userCounts: Record<string, Record<string, number>> = {}

      for (const t of typesToTrack) {
        counts[t] = 0
        ipCounts[t] = {}
        userCounts[t] = {}
      }

      for (const ev of events) {
        if (!typesToTrack.includes(ev.type)) continue
        counts[ev.type] = (counts[ev.type] || 0) + 1
        const ip = (ev.ipAddress || '').trim()
        const uid = (ev.userId || '').trim()
        if (ip) {
          ipCounts[ev.type][ip] = (ipCounts[ev.type][ip] || 0) + 1
        }
        if (uid) {
          userCounts[ev.type][uid] = (userCounts[ev.type][uid] || 0) + 1
        }
      }

      // Write event rate summary
      await db.collection('security_event_rates').add({
        windowStart,
        windowEnd,
        timestamp: windowEnd,
        counts,
      })

      // Thresholds from design.md
      const thresholds: Record<string, number> = {
        AUTH_FAILURE: 10,          // per minute
        SUSPICIOUS_ACTIVITY: 5,    // per minute
        RATE_LIMIT_EXCEEDED: 100,  // per minute
      }

      // Generate alerts when counts exceed thresholds
      for (const t of typesToTrack) {
        const c = counts[t] || 0
        const threshold = thresholds[t]
        if (threshold && c > threshold) {
          await db.collection('security_alerts').add({
            level: t === 'AUTH_FAILURE' ? 'HIGH' : 'MEDIUM',
            eventType: `${t}_RATE_HIGH`,
            timestamp: windowEnd,
            details: { count: c, threshold, windowStart, windowEnd },
          })
          console.warn(`[SecurityLogger] ${t} rate high:`, c, '>', threshold)
        }
      }

      // Compute top violators (IP and userId) per type
      function topN(countMap: Record<string, number>, n = 5) {
        return Object.entries(countMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, n)
          .map(([key, count]) => ({ key, count }))
      }

      const violators: Record<string, { topIps: { key: string; count: number }[]; topUsers: { key: string; count: number }[] }> = {}
      for (const t of typesToTrack) {
        violators[t] = {
          topIps: topN(ipCounts[t], 5),
          topUsers: topN(userCounts[t], 5),
        }
      }

      await db.collection('security_top_violators').add({
        windowStart,
        windowEnd,
        timestamp: windowEnd,
        violators,
      })
    } catch (e) {
      console.error('[SecurityLogger] Failed to evaluate event rates/violators:', e)
    }
  }

  /**
   * Record an R2 operation result for error-rate tracking
   */
  async logR2Operation(
    operation: 'put' | 'get' | 'delete' | 'head' | 'copy',
    success: boolean,
    details?: Record<string, any>
  ): Promise<void> {
    if (!this.config.enabled) return
    this.r2Counters.totalOps++
    const byOp = this.r2Counters.byOperation[operation] || { total: 0, errors: 0 }
    byOp.total++
    if (!success) {
      this.r2Counters.errorOps++
      byOp.errors++
    }
    this.r2Counters.byOperation[operation] = byOp
    this.scheduleBatchFlush()
  }

  /**
   * Check R2 error rates and emit alerts if over threshold (1%)
   */
  private async evaluateAndAlertR2Errors(counters: R2Counters): Promise<void> {
    const total = counters.totalOps
    const errors = counters.errorOps
    if (total === 0) return
    const rate = errors / total
    if (rate > 0.01) {
      try {
        const db = getAdminDb()
        const payload = {
          level: 'MEDIUM',
          eventType: 'R2_ERROR_RATE',
          timestamp: new Date().toISOString(),
          details: {
            errorRate: Number(rate.toFixed(4)),
            totalOps: total,
            errorOps: errors,
            byOperation: counters.byOperation,
          },
        }
        await db.collection('security_alerts').add(payload)
        await db.collection('r2_metrics').add({
          timestamp: payload.timestamp,
          ...payload.details,
        })
        console.warn('[SecurityLogger] R2 error rate exceeded 1%:', payload.details)
      } catch (e) {
        console.error('[SecurityLogger] Failed to write R2 alert:', e)
      }
    }
  }

  /**
   * Calculate aggregated metrics from raw data
   */
  private calculateAggregatedMetrics(
    routeMetrics: RouteMetrics,
    windowStart: string,
    windowEnd: string
  ): AggregatedMetrics {
    const durations = routeMetrics.durations.sort((a, b) => a - b)
    const p50 = this.percentile(durations, 0.5)
    const p95 = this.percentile(durations, 0.95)
    const p99 = this.percentile(durations, 0.99)
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length

    return {
      route: routeMetrics.route,
      endpoint: routeMetrics.endpoint,
      windowStart,
      windowEnd,
      requestCount: routeMetrics.requestCount,
      errorCount: routeMetrics.errorCount,
      avgDurationMs: Math.round(avg),
      p50DurationMs: Math.round(p50),
      p95DurationMs: Math.round(p95),
      p99DurationMs: Math.round(p99),
      statusCodes: routeMetrics.statusCodes,
      correlationIds: routeMetrics.correlationIds.slice(0, 5), // Keep only first 5
      timestamp: windowEnd,
    }
  }

  /**
   * Write single event to Firestore (for critical events)
   */
  private async writeEventToFirestore(event: SecurityEvent): Promise<void> {
    try {
      const db = getAdminDb()
      const record = {
        type: event.type,
        severity: event.severity || this.inferSeverity(event.type),
        userId: event.userId || null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        endpoint: event.endpoint || null,
        details: event.details || {},
        timestamp: (event.timestamp || new Date()).toISOString(),
        correlationId: event.correlationId,
        sampled: event.sampled || false,
      }

      await db.collection('security_events').add(record)

      // Generate alerts for critical events
      if (record.severity === 'CRITICAL' || event.type === 'RATE_LIMIT_EXCEEDED') {
        const alert = {
          level: record.severity,
          eventType: record.type,
          endpoint: record.endpoint,
          correlationId: record.correlationId,
          timestamp: record.timestamp,
          details: record.details,
        }
        await db.collection('security_alerts').add(alert)
      }
    } catch (error) {
      console.error('[SecurityLogger] Failed to write critical event:', error)
      // Don't throw - logging failures shouldn't break the application
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0
    const index = Math.ceil(sortedArray.length * p) - 1
    return sortedArray[Math.max(0, index)]
  }

  /**
   * Infer severity from event type
   */
  private inferSeverity(type: SecurityEventType): Severity {
    switch (type) {
      case 'AUTH_FAILURE':
      case 'ACCESS_DENIED':
        return 'MEDIUM'
      case 'RATE_LIMIT_EXCEEDED':
      case 'SUSPICIOUS_ACTIVITY':
        return 'HIGH'
      case 'R2_ERROR':
        return 'MEDIUM'
      case 'ERROR':
        return 'LOW'
      case 'AUTH_SUCCESS':
      case 'DATA_ACCESS':
      default:
        return 'LOW'
    }
  }

  /**
   * Graceful shutdown - flush any remaining events
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    await this.flushBatch()
  }
}

/**
 * Route metrics aggregation data
 */
interface RouteMetrics {
  route: string
  endpoint: string
  requestCount: number
  errorCount: number
  durations: number[]
  statusCodes: Record<string, number>
  correlationIds: string[]
  windowStart: number
}

/**
 * R2 operation counters for error-rate tracking
 */
interface R2Counters {
  totalOps: number
  errorOps: number
  byOperation: Record<string, { total: number; errors: number }>
}

/**
 * Global logger instance
 */
let globalLogger: SecurityLogger | null = null

/**
 * Get or create the global logger instance
 */
export function getSecurityLogger(): SecurityLogger {
  if (!globalLogger) {
    globalLogger = new SecurityLogger()
  }
  return globalLogger
}

/**
 * Initialize the security logger with custom config
 */
export function initializeSecurityLogger(config: LoggingConfig): SecurityLogger {
  globalLogger = new SecurityLogger(config)
  return globalLogger
}

/**
 * Graceful shutdown for the logger
 */
export async function shutdownSecurityLogger(): Promise<void> {
  if (globalLogger) {
    await globalLogger.shutdown()
    globalLogger = null
  }
}
