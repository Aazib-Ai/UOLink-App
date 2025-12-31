import { logSecurityEvent, logAuditEvent, generateCorrelationId } from '@/lib/security/logging'

async function run() {
  const cid = generateCorrelationId()
  console.log('Testing security logging with correlationId:', cid)

  await logSecurityEvent({
    type: 'AUTH_FAILURE',
    severity: 'MEDIUM',
    ipAddress: '127.0.0.1',
    userAgent: 'UnitTest',
    endpoint: '/api/test',
    correlationId: cid,
    details: { reason: 'Invalid token' },
  })

  await logAuditEvent({
    action: 'NOTE_DELETE',
    resource: 'note_123',
    userId: 'user_abc',
    ipAddress: '127.0.0.1',
    userAgent: 'UnitTest',
    correlationId: cid,
    details: { storageKey: 'path/to/file.pdf' },
  })

  console.log('Security logging test completed.')
}

run().catch((err) => {
  console.error('Security logging test failed:', err)
  process.exit(1)
})

