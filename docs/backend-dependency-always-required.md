# Backend Dependency for "Always Required" Job Categories

## Current Status
- The frontend component now has full support for the "always required" job category functionality
- This includes UI handling, forms, and state management
- Unit tests have been updated to account for this new field

## Implementation Details
- The frontend now displays a new checkbox in the job category form for "Always required for all registrations"
- A new column has been added to the job categories table to show the "Always Required" status
- The necessary schema changes and API client modifications have been made 

## Backend Dependency
Currently, the backend API does not accept the `alwaysRequired` property in job category requests. A temporary workaround has been implemented in the frontend API client:

1. The `alwaysRequired` property is removed before sending data to the backend
2. The property is added back to the response data with a default value of `false`

## Required Backend Changes
The backend needs to be updated to support this new field:

1. Add an `alwaysRequired` boolean field to the JobCategory model in Prisma schema
2. Update the relevant DTOs to include this field
3. Update controllers to handle this field
4. Run database migration to add the column

Once these backend changes are made, we can remove the temporary workaround in the frontend API client.

## Impact on Registration Flow
Once fully implemented, this feature will ensure that job categories marked as "always required" are presented during registration regardless of camping options selected. This is essential for jobs like "tear-down help" that all campers are expected to participate in.
