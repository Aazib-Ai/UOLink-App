/**
 * Manual test file for username utilities
 * Run with: npx tsx src/lib/username/__tests__/username-utils.test.ts
 */

import {
    validateUsername,
    validateUsernameFormat,
    isReservedUsername,
    generateBaseUsername,
    generateUsernameWithConflicts,
    sanitizeDisplayName,
    processDisplayNameToUsername,
    isUsernameAvailable
} from '../index';

// Test data
const testCases = {
    validUsernames: [
        'john-doe',
        'alice123',
        'user_name',
        'test-user-123',
        'a1b',
        'username-with-numbers-123'
    ],
    invalidUsernames: [
        'ab', // too short
        'a'.repeat(31), // too long
        '-invalid', // starts with hyphen
        'invalid-', // ends with hyphen
        'user--name', // consecutive hyphens
        'user@name', // invalid character
        'user name', // space
        'user.name' // period
    ],
    reservedUsernames: [
        'admin',
        'api',
        'www',
        'root',
        'system'
    ],
    displayNames: [
        'John Doe',
        'Alice Smith',
        'محمد أحمد', // Arabic
        'José García',
        'User@Example.com',
        'Test User 123',
        '   Spaced   Name   ',
        'Special!@#$%Characters'
    ]
};

function runTests() {
    console.log('🧪 Running Username Utilities Tests\n');

    // Test 1: Username Format Validation
    console.log('1️⃣ Testing Username Format Validation');
    testCases.validUsernames.forEach(username => {
        const result = validateUsernameFormat(username);
        console.log(`✅ "${username}": ${result.isValid ? 'VALID' : 'INVALID'} ${result.errors.join(', ')}`);
    });

    testCases.invalidUsernames.forEach(username => {
        const result = validateUsernameFormat(username);
        console.log(`❌ "${username}": ${result.isValid ? 'VALID' : 'INVALID'} - ${result.errors.join(', ')}`);
    });

    // Test 2: Reserved Username Check
    console.log('\n2️⃣ Testing Reserved Username Check');
    testCases.reservedUsernames.forEach(username => {
        const isReserved = isReservedUsername(username);
        console.log(`🚫 "${username}": ${isReserved ? 'RESERVED' : 'AVAILABLE'}`);
    });

    // Test 3: Display Name Sanitization
    console.log('\n3️⃣ Testing Display Name Sanitization');
    testCases.displayNames.forEach(displayName => {
        const sanitized = sanitizeDisplayName(displayName);
        console.log(`🧹 "${displayName}" → "${sanitized}"`);
    });

    // Test 4: Username Generation
    console.log('\n4️⃣ Testing Username Generation');
    testCases.displayNames.forEach(displayName => {
        const generated = generateBaseUsername(displayName);
        const validation = validateUsername(generated);
        console.log(`🎯 "${displayName}" → "${generated}" (${validation.isValid ? 'VALID' : 'INVALID'})`);
    });

    // Test 5: Conflict Resolution
    console.log('\n5️⃣ Testing Conflict Resolution');
    const existingUsernames = new Set(['john-doe', 'alice-smith', 'test-user']);

    const conflictTests = ['John Doe', 'Alice Smith', 'Test User'];
    conflictTests.forEach(displayName => {
        const resolved = generateUsernameWithConflicts(displayName, existingUsernames);
        console.log(`⚔️ "${displayName}" → "${resolved}" (conflict resolved)`);
    });

    // Test 6: Complete Processing
    console.log('\n6️⃣ Testing Complete Processing');
    testCases.displayNames.slice(0, 3).forEach(displayName => {
        const result = processDisplayNameToUsername(displayName, existingUsernames);
        console.log(`🔄 "${displayName}":`);
        console.log(`   Username: "${result.username}"`);
        console.log(`   Valid: ${result.isValid}`);
        console.log(`   Errors: ${result.errors.join(', ') || 'None'}`);
        console.log(`   Suggestions: ${result.suggestions.join(', ') || 'None'}`);
    });

    // Test 7: Availability Check
    console.log('\n7️⃣ Testing Availability Check');
    const availabilityTests = ['new-user', 'john-doe', 'admin', 'available-username'];
    availabilityTests.forEach(username => {
        const available = isUsernameAvailable(username, existingUsernames);
        console.log(`🔍 "${username}": ${available ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    });

    console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

export { runTests };