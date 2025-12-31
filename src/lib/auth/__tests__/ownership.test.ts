/**
 * Manual tests for ownership validation utilities
 * Run with: npx tsx src/lib/auth/__tests__/ownership.test.ts
 */

import assert from 'assert'
import { validateNoteOwnership, validateCommentOwnership, validateProfileOwnership } from '../ownership'

function testNoteOwnership() {
  const note = { uploadedBy: 'u1' }
  assert.doesNotThrow(() => validateNoteOwnership(note, 'u1'))
  assert.throws(() => validateNoteOwnership(note, 'u2'))
}

function testCommentOwnership() {
  const comment = { userId: 'abc' }
  assert.doesNotThrow(() => validateCommentOwnership(comment, 'abc'))
  assert.throws(() => validateCommentOwnership(comment, 'def'))
}

function testProfileOwnership() {
  assert.doesNotThrow(() => validateProfileOwnership('p1', 'p1'))
  assert.throws(() => validateProfileOwnership('p1', 'p2'))
}

function run() {
  console.log('Running ownership tests...')
  testNoteOwnership()
  testCommentOwnership()
  testProfileOwnership()
  console.log('All ownership tests passed ✅')
}

run()

