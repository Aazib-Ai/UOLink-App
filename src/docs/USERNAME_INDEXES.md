Username Collections: Required Firestore Indexes

- Overview
  - The username system uses two collections: `usernames` and `username_history`.
  - To support queries used in availability checks, active username lookups, cooldown enforcement, and alias redirection, the following indexes must be configured.

- Required Indexes
  - `usernames`
    - Single-field: `userId` (ASC), `isActive` (ASC), `createdAt` (DESC)
    - Compound:
      - `userId` (ASC), `isActive` (ASC)
      - `isActive` (ASC), `createdAt` (DESC)
  - `username_history`
    - Single-field: `userId` (ASC), `changedAt` (DESC), `aliasExpiresAt` (ASC)
    - Compound:
      - `userId` (ASC), `changedAt` (DESC)
      - `aliasExpiresAt` (ASC), `oldUsername` (ASC)
      - `aliasExpiresAt` (ASC), `oldUsernameLower` (ASC)
      - (Optional) `userId` (ASC), `oldUsernameLower` (ASC) — for user-scoped alias audits
    - Additional single-field:
      - `oldUsernameLower` (ASC) — used by alias lookups

- firestore.indexes.json Example
```
{
  "indexes": [
    {
      "collectionGroup": "usernames",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "isActive", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "usernames",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "username_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "changedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "username_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aliasExpiresAt", "order": "ASCENDING" },
        { "fieldPath": "oldUsername", "order": "ASCENDING" }
      ]
    }
    ,
    {
      "collectionGroup": "username_history",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "aliasExpiresAt", "order": "ASCENDING" },
        { "fieldPath": "oldUsernameLower", "order": "ASCENDING" }
      ]
    }
  ]
}
```

- CLI Setup
- If using Firebase CLI:
  - Generate or update `firestore.indexes.json` with the above entries.
  - Deploy: `firebase deploy --only firestore:indexes --project <YOUR_PROJECT_ID>`

- Notes
  - The `userId + isActive` index powers deactivation lookups inside transactions.
  - The `aliasExpiresAt + oldUsername` index is used by alias redirection with expiry.
  - The `aliasExpiresAt + oldUsernameLower` index is used by normalized alias lookups.
  - Keep `createdAt` indexed to support admin analytics and maintenance.

- Monitoring
  - Use the Firebase console Indexes tab to monitor “Index usage” and spot missing indexes.
  - Enable “automatically collect index suggestions” to capture queries that need new indexes.
  - Review Firestore logs: watch for “FAILED_PRECONDITION: The query requires an index” errors.
  - Periodically run synthetic checks for alias lookup queries to confirm no index-required errors.
