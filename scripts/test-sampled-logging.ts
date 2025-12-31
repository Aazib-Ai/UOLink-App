import { SecurityLogger } from '@/lib/security/logging-service'
import { generateCorrelationId } from '@/lib/security/logging'

async function testSampledLogging() {
  console.log('🧪 Testing sampled and batched security logging...\n')
  
  const logger = new SecurityLogger()
  
  // Test 1: Critical events should bypass sampling
  console.log('1️⃣ Testing critical events bypass sampling:')
  const criticalEvents = [
    { type: 'AUTH_FAILURE' as const, correlationId: generateCorrelationId() },
    { type: 'SUSPICIOUS_ACTIVITY' as const, correlationId: generateCorrelationId() },
    { type: 'RATE_LIMIT_EXCEEDED' as const, correlationId: generateCorrelationId() },
  ]
  
  for (const event of criticalEvents) {
    const logged = await logger.logEvent(event)
    console.log(`   ${event.type}: ${logged ? 'LOGGED (bypassed sampling)' : 'NOT LOGGED (sampled out)'}`)
  }
  
  // Test 2: Non-critical events should be sampled
  console.log('\n2️⃣ Testing non-critical events sampling (1% rate):')
  process.env.SECURITY_METRICS_SAMPLING_RATE = '0.01' // 1% sampling
  
  const nonCriticalEvents = [
    { type: 'DATA_ACCESS' as const, correlationId: generateCorrelationId() },
    { type: 'AUTH_SUCCESS' as const, correlationId: generateCorrelationId() },
  ]
  
  for (const event of nonCriticalEvents) {
    const logged = await logger.logEvent(event)
    console.log(`   ${event.type}: ${logged ? 'LOGGED (passed sampling)' : 'NOT LOGGED (sampled out)'}`)
  }
  
  // Test 3: Batch collection
  console.log('\n3️⃣ Testing batch collection:')
  process.env.SECURITY_MAX_BATCH_SIZE = '5'
  process.env.SECURITY_BATCH_WINDOW_MS = '2000' // 2 second window
  
  const batchLogger = new SecurityLogger()
  
  // Generate 10 events to test batching
  for (let i = 0; i < 10; i++) {
    const logged = await batchLogger.logEvent({
      type: 'DATA_ACCESS',
      correlationId: generateCorrelationId(),
      details: { batchTest: i + 1 }
    })
    console.log(`   Event ${i + 1} sent to batch ${logged ? '(logged)' : '(sampled out)'}`)
  }
  
  console.log('   Waiting for batch window to complete...')
  await new Promise(resolve => setTimeout(resolve, 2500))
  
  // Test 4: Route metrics sampling
  console.log('\n4️⃣ Testing route metrics sampling:')
  process.env.SECURITY_METRICS_SAMPLING_RATE = '0.1' // 10% for metrics
  
  const metricsLogger = new SecurityLogger()
  
  // Simulate route metrics
  const routeMetrics = {
    route: '/api/test',
    endpoint: 'GET /api/test',
    duration: 150,
    statusCode: 200,
    correlationId: generateCorrelationId()
  }
  
  await metricsLogger.logRouteMetrics(
    routeMetrics.route,
    routeMetrics.endpoint,
    routeMetrics.statusCode,
    routeMetrics.duration,
    routeMetrics.correlationId
  )
  console.log('   Route metrics: SENT (may be sampled based on config)')
  
  // Test 5: Disabled logging
  console.log('\n5️⃣ Testing disabled logging:')
  process.env.SECURITY_LOGGING_ENABLED = 'false'
  
  const disabledLogger = new SecurityLogger()
  const disabledResult = await disabledLogger.logEvent({
    type: 'AUTH_FAILURE',
    correlationId: generateCorrelationId()
  })
  
  console.log(`   Event with logging disabled: ${disabledResult ? 'LOGGED (unexpected)' : 'NOT LOGGED (expected)'}`)
  
  console.log('\n✅ Sampled logging test completed!')
  
  // Cleanup
  delete process.env.SECURITY_LOGGING_ENABLED
  delete process.env.SECURITY_METRICS_SAMPLING_RATE
  delete process.env.SECURITY_MAX_BATCH_SIZE
  delete process.env.SECURITY_BATCH_WINDOW_MS
}

testSampledLogging().catch((err) => {
  console.error('❌ Sampled logging test failed:', err)
  process.exit(1)
})
