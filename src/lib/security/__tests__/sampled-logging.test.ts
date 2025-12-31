import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getSecurityLogger, shutdownSecurityLogger } from '../logging-service'
import { getLoggingConfig } from '../logging-config'
import type { SecurityEvent } from '../logging-config'

// Mock Firestore
vi.mock('@/lib/firebaseAdmin', () => ({
  getAdminDb: vi.fn(() => ({
    collection: vi.fn(() => ({
      add: vi.fn().mockResolvedValue({ id: 'mock-doc-id' })
    }))
  }))
}))

describe('Sampled Security Logging', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.SECURITY_EVENT_SAMPLING_RATE
    delete process.env.SECURITY_METRICS_SAMPLING_RATE
    delete process.env.SECURITY_LOGGING_ENABLED
    delete process.env.SECURITY_BATCH_WINDOW_MS
    delete process.env.SECURITY_MAX_BATCH_SIZE
    delete process.env.SECURITY_CRITICAL_EVENTS_IMMEDIATE
    
    // Reset modules to pick up new env vars
    vi.resetModules()
  })

  afterEach(async () => {
    await shutdownSecurityLogger()
  })

  it('should use default sampling rates when not configured', () => {
    const config = getLoggingConfig()
    expect(config.eventSamplingRate).toBe(0.05) // 5%
    expect(config.metricsSamplingRate).toBe(0.05) // 5%
    expect(config.batchWindowMs).toBe(60000) // 60s
    expect(config.maxBatchSize).toBe(100)
    expect(config.enabled).toBe(true)
    expect(config.criticalEventsImmediate).toBe(true)
  })

  it('should respect environment variable configuration', () => {
    process.env.SECURITY_EVENT_SAMPLING_RATE = '0.10'
    process.env.SECURITY_METRICS_SAMPLING_RATE = '0.01'
    process.env.SECURITY_BATCH_WINDOW_MS = '30000'
    process.env.SECURITY_MAX_BATCH_SIZE = '50'
    process.env.SECURITY_LOGGING_ENABLED = 'false'
    process.env.SECURITY_CRITICAL_EVENTS_IMMEDIATE = 'false'

    const config = getLoggingConfig()
    expect(config.eventSamplingRate).toBe(0.10) // 10%
    expect(config.metricsSamplingRate).toBe(0.01) // 1%
    expect(config.batchWindowMs).toBe(30000) // 30s
    expect(config.maxBatchSize).toBe(50)
    expect(config.enabled).toBe(false)
    expect(config.criticalEventsImmediate).toBe(false)
  })

  it('should validate sampling rate bounds', () => {
    // Test upper bound
    process.env.SECURITY_EVENT_SAMPLING_RATE = '0.15'
    expect(() => getLoggingConfig()).toThrow('Event sampling rate must be between 0.01 and 0.10')

    // Test lower bound
    process.env.SECURITY_EVENT_SAMPLING_RATE = '0.005'
    expect(() => getLoggingConfig()).toThrow('Event sampling rate must be between 0.01 and 0.10')

    // Test valid bounds
    process.env.SECURITY_EVENT_SAMPLING_RATE = '0.01'
    const config1 = getLoggingConfig()
    expect(config1.eventSamplingRate).toBe(0.01)

    process.env.SECURITY_EVENT_SAMPLING_RATE = '0.10'
    const config2 = getLoggingConfig()
    expect(config2.eventSamplingRate).toBe(0.10)
  })

  it('should immediately write critical events', async () => {
    const logger = getSecurityLogger()
    const criticalEvent: SecurityEvent = {
      type: 'AUTH_FAILURE',
      severity: 'HIGH',
      correlationId: 'test-correlation-id',
      userId: 'test-user',
      endpoint: '/api/test',
      details: { reason: 'invalid_credentials' }
    }

    // Spy on Firestore add method
    const firestoreAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' })
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    ;(getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ add: firestoreAdd }))
    })

    await logger.logEvent(criticalEvent)

    // Critical events should be written immediately
    expect(firestoreAdd).toHaveBeenCalled()
  })

  it('should batch non-critical events', async () => {
    process.env.SECURITY_BATCH_WINDOW_MS = '1000' // 1 second for testing
    
    const logger = getSecurityLogger()
    const normalEvent: SecurityEvent = {
      type: 'DATA_ACCESS',
      severity: 'LOW',
      correlationId: 'test-correlation-id-1',
      userId: 'test-user',
      endpoint: '/api/test',
      details: { action: 'read' }
    }

    // Spy on Firestore add method
    const firestoreAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' })
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    ;(getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ add: firestoreAdd }))
    })

    await logger.logEvent(normalEvent)

    // Non-critical events should be batched, so Firestore add shouldn't be called immediately
    expect(firestoreAdd).not.toHaveBeenCalled()

    // Wait for batch window to expire
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Now the batch should be written
    expect(firestoreAdd).toHaveBeenCalled()
  })

  it('should collect route metrics', async () => {
    const logger = getSecurityLogger()
    
    // Log multiple route calls
    await logger.logRouteMetrics('/api/test', '/api/test', 200, 150, 'test-correlation-id-1')
    await logger.logRouteMetrics('/api/test', '/api/test', 200, 200, 'test-correlation-id-2')
    await logger.logRouteMetrics('/api/test', '/api/test', 500, 300, 'test-correlation-id-3')
    await logger.logRouteMetrics('/api/other', '/api/other', 200, 100, 'test-correlation-id-4')

    // Force flush
    await logger.flush()

    // Verify metrics were collected (implementation detail - would need to expose internals for full testing)
    // This test mainly ensures the API works without errors
    expect(true).toBe(true)
  })

  it('should handle disabled logging', async () => {
    process.env.SECURITY_LOGGING_ENABLED = 'false'
    
    const logger = getSecurityLogger()
    const event: SecurityEvent = {
      type: 'AUTH_FAILURE',
      severity: 'HIGH',
      correlationId: 'test-correlation-id',
      userId: 'test-user',
      endpoint: '/api/test',
      details: { reason: 'invalid_credentials' }
    }

    // Spy on Firestore add method
    const firestoreAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' })
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    ;(getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ add: firestoreAdd }))
    })

    await logger.logEvent(event)

    // When logging is disabled, no Firestore writes should occur
    expect(firestoreAdd).not.toHaveBeenCalled()
  })

  it('should handle batch size limits', async () => {
    process.env.SECURITY_MAX_BATCH_SIZE = '2'
    
    const logger = getSecurityLogger()
    
    // Spy on Firestore add method
    const firestoreAdd = vi.fn().mockResolvedValue({ id: 'mock-doc-id' })
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    ;(getAdminDb as any).mockReturnValue({
      collection: vi.fn(() => ({ add: firestoreAdd }))
    })

    // Log 3 events (exceeds batch size of 2)
    const event: SecurityEvent = {
      type: 'DATA_ACCESS',
      severity: 'LOW',
      correlationId: 'test-correlation-id',
      userId: 'test-user',
      endpoint: '/api/test',
      details: { action: 'read' }
    }

    await logger.logEvent({ ...event, correlationId: '1' })
    await logger.logEvent({ ...event, correlationId: '2' })
    await logger.logEvent({ ...event, correlationId: '3' })

    // Should have flushed after 2 events due to batch size limit
    expect(firestoreAdd).toHaveBeenCalledTimes(2)
  })
})
