/**
 * Manual tests for enhanced authentication helpers
 * Run with: npx tsx src/lib/auth/__tests__/auth-enhanced.test.ts
 */

import assert from 'assert'
import {
  isAllowedEmail,
  isSuspiciousUserAgent,
  computeRiskScore,
  normalizeUserAgent,
  generateCorrelationId,
} from '../authenticate'

function testEmailDomain() {
  assert.strictEqual(isAllowedEmail('12345678@student.uol.edu.pk'), true, 'Allowed student email should pass')
  assert.strictEqual(isAllowedEmail('john@other.edu'), false, 'Non-UOL domain should fail')
  assert.strictEqual(isAllowedEmail(undefined), false, 'Missing email should fail')
}

function testUserAgentNormalization() {
  const ua = normalizeUserAgent('  Mozilla/5.0 (Windows NT)  ')
  assert.ok(ua && ua.startsWith('Mozilla'), 'UA normalization trims and preserves content')
}

function testSuspiciousUA() {
  assert.strictEqual(isSuspiciousUserAgent('curl/8.0'), true, 'curl user agent should be suspicious')
  assert.strictEqual(isSuspiciousUserAgent('Mozilla/5.0 Chrome/120'), false, 'Browser UA should not be suspicious')
  assert.strictEqual(isSuspiciousUserAgent(null), true, 'Missing UA is suspicious')
}

function testRiskScore() {
  const r1 = computeRiskScore({ ua: 'Mozilla/5.0', emailVerified: true, emailDomainOk: true })
  assert.strictEqual(r1.score, 0, 'Low risk context should score 0')
  const r2 = computeRiskScore({ ua: 'curl/8.0', emailVerified: false, emailDomainOk: false })
  assert.ok(r2.score >= 7, 'High risk context should score high')
  assert.strictEqual(r2.flags.suspiciousUserAgent, true)
  assert.strictEqual(r2.flags.emailUnverified, true)
  assert.strictEqual(r2.flags.emailDomainMismatch, true)
}

function testCorrelationId() {
  const id = generateCorrelationId()
  assert.ok(typeof id === 'string' && id.includes('-'), 'Correlation ID should be string with hyphen')
}

function run() {
  console.log('Running enhanced auth tests...')
  testEmailDomain()
  testUserAgentNormalization()
  testSuspiciousUA()
  testRiskScore()
  testCorrelationId()
  console.log('All enhanced auth tests passed ✅')
}

run()

