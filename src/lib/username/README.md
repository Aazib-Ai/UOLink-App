# Username Utilities

This module provides comprehensive username validation and generation utilities for the UOLink unique username system.

## Features

- **Format Validation**: Ensures usernames meet system requirements (3-30 chars, alphanumeric + hyphens/underscores)
- **Reserved Username Protection**: Prevents use of system-reserved usernames (admin, api, www, etc.)
- **Display Name Generation**: Converts display names to valid usernames with conflict resolution
- **Sanitization**: Cleans display names by removing special characters and formatting properly
- **Conflict Resolution**: Handles username conflicts with numeric suffixes and alternatives

## Usage

### Basic Validation

```typescript
import { validateUsername } from '@/lib/username';

const result = validateUsername('john-doe');
console.log(result.isValid); // true
console.log(result.errors); // []
```

### Generate Username from Display Name

```typescript
import { generateBaseUsername, processDisplayNameToUsername } from '@/lib/username';

// Simple generation
const username = generateBaseUsername('John Doe'); // 'john-doe'

// Complete processing with conflict resolution
const existingUsernames = new Set(['john-doe', 'alice-smith']);
const result = processDisplayNameToUsername('John Doe', existingUsernames);
console.log(result.username); // 'john-doe-2' (conflict resolved)
console.log(result.suggestions); // ['john-doe-2', 'john-doe-3', ...]
```

### Check Availability

```typescript
import { isUsernameAvailable } from '@/lib/username';

const existingUsernames = new Set(['taken-username']);
const available = isUsernameAvailable('new-username', existingUsernames);
console.log(available); // true
```

## Validation Rules

- **Length**: 3-30 characters
- **Characters**: Letters, numbers, hyphens (-), underscores (_) only
- **Format**: Must start and end with alphanumeric character
- **No consecutive special characters**: Cannot have -- or __
- **Case insensitive**: Usernames are stored and compared in lowercase
- **Reserved names**: System usernames like 'admin', 'api', 'www' are blocked

## Reserved Usernames

The system blocks these reserved usernames:
- System: admin, root, system, moderator
- Technical: api, www, mail, ftp, app
- Routes: profile, user, dashboard, login, signup
- UOLink specific: uolink, upload, notes, leaderboard, aura

## Generation Algorithm

1. **Sanitize**: Remove special characters, convert to lowercase
2. **Format**: Replace spaces with hyphens, ensure valid format
3. **Validate**: Check format rules and reserved names
4. **Resolve conflicts**: Add numeric suffixes if username is taken
5. **Fallback**: Use timestamp-based username if all attempts fail

## Examples

```typescript
// Display name → Username
'John Doe' → 'john-doe'
'Alice@Example.com' → 'aliceexamplecom'
'User Name 123' → 'user-name-123'
'محمد أحمد' → 'user' (fallback for non-Latin)

// Conflict resolution
'John Doe' (taken) → 'john-doe-2'
'Alice Smith' (taken) → 'alice-smith-2'

// Invalid formats
'ab' → Error: too short
'user--name' → Error: consecutive hyphens
'-invalid' → Error: starts with hyphen
```

## Testing

Run the test file to verify functionality:

```bash
npx tsx src/lib/username/__tests__/username-utils.test.ts
```