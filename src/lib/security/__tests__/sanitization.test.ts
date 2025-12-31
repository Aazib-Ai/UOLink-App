/**
 * Manual test file for output sanitization utilities
 * Run with: npx tsx src/lib/security/__tests__/sanitization.test.ts
 */

import assert from 'assert'
import { escapeHtml, safeText, toPublicProfile, getEmailPrefix, getInitialsFromName, computeDisplayName } from '../sanitization'

function testEscapeHtmlXss() {
  const input = '<img src=x onerror=alert(1)>'
  const out = escapeHtml(input)
  assert(out.includes('&lt;img'), 'escapeHtml should escape opening tag')
  assert(!out.includes('<img'), 'escapeHtml should not contain raw tag')
}

function testSafeTextLengthAndControlChars() {
  const input = 'a'.repeat(1200) + '\u0000\u0007\u007F'
  const out = safeText(input)
  assert(out.length <= 1000, 'safeText should clamp to default max 1000')
  assert(!/[\u0000-\u001F\u007F]/.test(out), 'safeText should strip control characters')
}

function testSafeTextEscapesHtml() {
  const input = '<script>alert("xss")</script> Hello'
  const out = safeText(input)
  assert(!out.toLowerCase().includes('<script>'), 'safeText should escape script tag')
  assert(out.includes('&lt;script&gt;'), 'safeText should reflect escaped script tag')
}

function testEmailPrefixComputation() {
  assert(getEmailPrefix('john@example.com') === 'john', 'Should extract email prefix')
  assert(getEmailPrefix('invalidEmail') === undefined, 'Invalid email should return undefined')
}

function testInitialsComputation() {
  assert(getInitialsFromName('John Doe') === 'JD', 'Should compute initials from name')
  assert(getInitialsFromName('') === undefined, 'Empty name returns undefined')
}

function testComputeDisplayNameOrder() {
  const name = computeDisplayName(undefined, 'John Doe', undefined, 'john')
  assert(name.startsWith('J'), 'Display name capitalizes first letter')
}

function testToPublicProfilePrivacyAndSanitization() {
  const profile = {
    id: 'uid123',
    fullName: 'John Doe',
    email: 'john@example.com',
    username: 'johnny',
    bio: '<b>Bold</b> student',
    about: '<script>alert(1)</script>About me',
    skills: ['JS<script>', ' TS '],
    githubUrl: 'https://github.com/john',
    linkedinUrl: 'https://linkedin.com/in/john',
    semester: '4',
    section: 'A',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const out = toPublicProfile(profile)
  assert(out.id === 'uid123', 'Public profile retains id')
  assert(!('email' in out), 'Public profile must not include full email')
  assert(typeof out.emailPrefix === 'string' && out.emailPrefix === 'john', 'Exposes emailPrefix only')
  assert(typeof out.displayName === 'string', 'Includes sanitized displayName')
  assert(out.initials === 'JD', 'Includes computed initials')
  assert(!out.bio?.includes('<'), 'bio should be sanitized (escaped)')
  assert(!out.about?.includes('<script>'), 'about script tags must be sanitized')
  assert(Array.isArray(out.skills), 'skills are normalized to array')
}

function run() {
  console.log('Running sanitization tests...')
  testEscapeHtmlXss()
  testSafeTextLengthAndControlChars()
  testSafeTextEscapesHtml()
  testEmailPrefixComputation()
  testInitialsComputation()
  testComputeDisplayNameOrder()
  testToPublicProfilePrivacyAndSanitization()
  console.log('All sanitization tests passed ✅')
}

run()

