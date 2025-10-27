/**
 * Test script to debug large file upload issues
 * Run with: node scripts/test-upload.js
 */

const fs = require('fs')
const path = require('path')

// Create a test file of specified size (in MB)
function createTestFile(sizeInMB, filename) {
  const sizeInBytes = sizeInMB * 1024 * 1024
  const buffer = Buffer.alloc(sizeInBytes, 'A') // Fill with 'A' characters
  
  fs.writeFileSync(filename, buffer)
  console.log(`Created test file: ${filename} (${sizeInMB}MB)`)
}

// Test different file sizes
const testSizes = [1, 5, 10, 15, 20, 25] // MB

console.log('Creating test files for upload testing...')

testSizes.forEach(size => {
  const filename = `test-file-${size}mb.txt`
  createTestFile(size, filename)
})

console.log('\nTest files created. You can now test uploading these files through the UI.')
console.log('Files created:')
testSizes.forEach(size => {
  console.log(`- test-file-${size}mb.txt`)
})

console.log('\nTo clean up test files, run:')
testSizes.forEach(size => {
  console.log(`rm test-file-${size}mb.txt`)
})