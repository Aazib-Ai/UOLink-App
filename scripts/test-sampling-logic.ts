import { getLoggingConfig, shouldSampleEvent, isCriticalEvent } from '@/lib/security/logging-config'
import type { SecurityEvent } from '@/lib/security/logging-config'

async function testSampling() {
  console.log('Testing security logging sampling functionality...\n')

  // Test 1: Configuration
  console.log('1. Testing configuration:')
  const config = getLoggingConfig()
  console.log('   Default config:', JSON.stringify(config, null, 2))

  // Test 2: Critical event detection
  console.log('\n2. Testing critical event detection:')
  const criticalEvents: SecurityEvent[] = [
    { type: 'AUTH_FAILURE', correlationId: 'test-1' },
    { type: 'SUSPICIOUS_ACTIVITY', correlationId: 'test-2' },
    { type: 'RATE_LIMIT_EXCEEDED', correlationId: 'test-3' },
    { type: 'AUTH_SUCCESS', correlationId: 'test-4' },
    { type: 'DATA_ACCESS', correlationId: 'test-5' },
  ]

  criticalEvents.forEach(event => {
    const isCritical = isCriticalEvent(event.type)
    console.log(`   ${event.type}: ${isCritical ? 'CRITICAL' : 'normal'}`)
  })

  // Test 3: Sampling logic
  console.log('\n3. Testing sampling logic:')
  const testEvents: SecurityEvent[] = [
    { type: 'DATA_ACCESS', correlationId: 'sample-1' }, // This should be sampled
    { type: 'AUTH_SUCCESS', correlationId: 'sample-2' }, // This should be sampled
    { type: 'ACCESS_DENIED', correlationId: 'sample-3' }, // This should NOT be sampled (always true)
    { type: 'ERROR', correlationId: 'sample-4' }, // This should NOT be sampled (always true)
  ]

  // Test with different sampling rates
  const samplingRates = [0.01, 0.05, 0.10]
  
  samplingRates.forEach(rate => {
    console.log(`   Sampling rate: ${(rate * 100).toFixed(0)}%`)
    let sampledCount = 0
    let dataAccessCount = 0
    
    // Simulate 1000 events, but only count DATA_ACCESS and AUTH_SUCCESS
    for (let i = 0; i < 1000; i++) {
      const event = testEvents[i % testEvents.length]
      if (shouldSampleEvent(event, rate)) {
        sampledCount++
        if (event.type === 'DATA_ACCESS' || event.type === 'AUTH_SUCCESS') {
          dataAccessCount++
        }
      }
    }
    
    const actualRate = sampledCount / 1000
    const dataAccessRate = dataAccessCount / 500 // 500 DATA_ACCESS/AUTH_SUCCESS events in 1000 iterations
    console.log(`     Total sampled: ${sampledCount}/1000 events (${(actualRate * 100).toFixed(1)}%)`)
    console.log(`     DATA_ACCESS/AUTH_SUCCESS sampled: ${dataAccessCount}/500 events (${(dataAccessRate * 100).toFixed(1)}%)`)
  })

  // Test 4: Critical events bypass sampling
  console.log('\n4. Testing critical events bypass sampling:')
  const criticalEvent: SecurityEvent = { type: 'AUTH_FAILURE', correlationId: 'critical-test' }
  
  // Even with 1% sampling rate, critical events should always be sampled
  const shouldAlwaysSample = shouldSampleEvent(criticalEvent, 0.01)
  console.log(`   AUTH_FAILURE with 1% sampling rate: ${shouldAlwaysSample ? 'SAMPLED' : 'NOT SAMPLED'}`)
  
  // Non-critical events should respect sampling rate
  const normalEvent: SecurityEvent = { type: 'DATA_ACCESS', correlationId: 'normal-test' }
  const normalSampled = shouldSampleEvent(normalEvent, 0.01)
  console.log(`   DATA_ACCESS with 1% sampling rate: ${normalSampled ? 'SAMPLED' : 'NOT SAMPLED'}`)

  console.log('\n✅ Sampling functionality test completed successfully!')
}

testSampling().catch(err => {
  console.error('❌ Sampling test failed:', err)
  process.exit(1)
})
