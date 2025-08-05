# Test Helpers

This directory contains utility functions and scripts to support testing of the PlayaPlan API.

## Pagination Test Data Helper

### Overview
The `pagination-test-data.ts` helper creates test registrations to verify the pagination fix for admin registration management. This addresses issue #105 where the admin interface was limited to 50 registrations.

### Usage

#### As a CLI tool:
```bash
# Generate 75 test registrations (default)
cd /Users/chris/dev/playa-plan
ts-node apps/api/test/helpers/pagination-test-data.ts generate

# Generate a specific number of registrations
ts-node apps/api/test/helpers/pagination-test-data.ts generate 100

# Clean up test data
ts-node apps/api/test/helpers/pagination-test-data.ts cleanup
```

#### As a module in tests:
```typescript
import { generatePaginationTestData, cleanupPaginationTestData } from './helpers/pagination-test-data';

// In your test
await generatePaginationTestData(prisma, 75);
// ... run tests
await cleanupPaginationTestData(prisma);
```

### Features

- **Smart generation**: Only creates the minimum number of registrations needed to reach the target
- **Realistic data**: Creates users with proper job assignments and varied registration statuses  
- **Safe cleanup**: Only removes users with `@pagination.test` email addresses
- **Batch processing**: Creates data in batches for better performance
- **Error handling**: Proper error reporting and rollback

### Prerequisites

Before running the pagination test data generator:
1. Ensure the database is running and accessible
2. Run the main seed script to create jobs: `npm run seed:dev`
3. The generator needs existing jobs to assign to registrations

### Test Data Pattern

Generated test users follow this pattern:
- **Email**: `testuser{N}@pagination.test`
- **Name**: `Test{N} User`
- **Playa Name**: `TestUser{N}`
- **Role**: `PARTICIPANT`
- **Status**: Cycles through `CONFIRMED`, `PENDING`, `WAITLISTED`

### Why This Helper Was Created

The pagination fix changed the default behavior from limiting results to 50 records to returning unlimited results. This helper ensures we can test scenarios with more than 50 registrations to validate the fix works correctly.
