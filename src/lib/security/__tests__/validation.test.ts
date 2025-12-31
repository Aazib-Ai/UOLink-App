/**
 * Manual test file for security validation utilities
 * Run with: npx tsx src/lib/security/__tests__/validation.test.ts
 */

import assert from 'assert'
import { z } from 'zod'
import {
  sanitizeText,
  hasExcessiveRepetition,
  validateFileUpload,
  addCommentSchema,
  uploadMetadataSchema,
} from '../validation'

function testSanitizeText() {
  const input = '<script>alert("xss")</script> Hello <b>World</b>'
  const out = sanitizeText(input)
  assert(!out.toLowerCase().includes('<script>'), 'sanitizeText should remove script tags')
  assert(!/<[^>]+>/.test(out), 'sanitizeText should strip HTML tags')
}

function testSanitizeTextLength() {
  const long = 'a'.repeat(2000)
  const out = sanitizeText(long)
  assert(out.length <= 1000, 'sanitizeText should enforce max length of 1000')
}

function testRepetitionDetection() {
  const repeated = 'abc abc abc abc abc abc'
  assert(hasExcessiveRepetition(repeated) === true, 'should detect excessive repetition')
  const normal = 'This is a normal sentence with variety.'
  assert(hasExcessiveRepetition(normal) === false, 'should not flag normal text')
}

function testFileValidationValid() {
  const result = validateFileUpload({ name: 'doc.pdf', size: 1024 * 1024, type: 'application/pdf' })
  assert(result.isValid, 'PDF file should be valid')
  assert(result.sanitizedData?.extension === 'pdf', 'extension should be pdf')
}

function testFileValidationInvalid() {
  const result = validateFileUpload({ name: 'evil.exe', size: 1024 * 1024, type: 'application/x-msdownload' })
  assert(!result.isValid, 'Unsupported file type should be rejected')
}

function testCommentSchema() {
  const ok = addCommentSchema.safeParse({ text: 'Hello world' })
  assert(ok.success, 'Valid comment text should parse')
  const bad = addCommentSchema.safeParse({ text: 'aaaaaa aaaaaa aaaaaa aaaaaa aaaaaa' })
  assert(!bad.success, 'Excessive repetition should fail')
}

function testUploadMetadataSchema() {
  const ok = uploadMetadataSchema.safeParse({
    name: 'Assignment 2',
    subject: 'Algebra',
    teacher: 'Dr. Smith',
    semester: '2',
    section: 'A',
    materialType: 'assignment',
    materialSequence: '2',
    contributorName: 'John Doe',
    contributorMajor: 'Math',
  })
  assert(ok.success, 'Valid upload metadata should parse')

  const bad = uploadMetadataSchema.safeParse({
    name: '',
    subject: 'Algebra',
    teacher: 'Dr. Smith',
    semester: '9', // invalid
    section: 'Z', // invalid
    materialType: 'assignment',
    contributorName: 'John Doe',
  })
  assert(!bad.success, 'Invalid metadata should fail')
}

function run() {
  console.log('Running validation tests...')
  testSanitizeText()
  testSanitizeTextLength()
  testRepetitionDetection()
  testFileValidationValid()
  testFileValidationInvalid()
  testCommentSchema()
  testUploadMetadataSchema()
  console.log('All validation tests passed ✅')
}

run()

