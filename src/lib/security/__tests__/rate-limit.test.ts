/**
 * Manual tests for rate limiting utilities
 * Run with: npx tsx src/lib/security/__tests__/rate-limit.test.ts
 */

import assert from 'assert'
import { checkRateLimitSlidingWindow, checkCooldown, RATE_LIMITS } from '../rateLimit'

async function testSlidingWindowBasic() {
  process.env.RATE_LIMIT_TEST_MODE = 'memory'
  const key = 'rl:test:basic'
  const windowMs = 1000
  const max = 3

  const r1 = await checkRateLimitSlidingWindow(key, windowMs, max)
  assert.strictEqual(r1.allowed, true)
  assert.strictEqual(r1.remaining, 2)

  const r2 = await checkRateLimitSlidingWindow(key, windowMs, max)
  assert.strictEqual(r2.allowed, true)
  assert.strictEqual(r2.remaining, 1)

  const r3 = await checkRateLimitSlidingWindow(key, windowMs, max)
  assert.strictEqual(r3.allowed, true)
  assert.strictEqual(r3.remaining, 0)

  const r4 = await checkRateLimitSlidingWindow(key, windowMs, max)
  assert.strictEqual(r4.allowed, false)
  assert.strictEqual(r4.remaining, 0)
  assert.ok(r4.resetTime >= Math.floor(Date.now() / 1000))

  await new Promise(res => setTimeout(res, windowMs + 100))
  const r5 = await checkRateLimitSlidingWindow(key, windowMs, max)
  assert.strictEqual(r5.allowed, true)
}

async function testCooldown() {
  process.env.RATE_LIMIT_TEST_MODE = 'memory'
  const base = 'cool:test:action'
  const cdMs = 500

  const c1 = await checkCooldown(base, cdMs)
  assert.strictEqual(c1.blocked, false)

  const c2 = await checkCooldown(base, cdMs)
  assert.strictEqual(c2.blocked, true)

  await new Promise(res => setTimeout(res, cdMs + 100))
  const c3 = await checkCooldown(base, cdMs)
  assert.strictEqual(c3.blocked, false)
}

async function run() {
  console.log('Running rate limit tests...')
  await testSlidingWindowBasic()
  console.log('✅ Sliding window basic passed')
  await testCooldown()
  console.log('✅ Cooldown tests passed')
  console.log('All rate limit tests passed ✅')
}

run()

