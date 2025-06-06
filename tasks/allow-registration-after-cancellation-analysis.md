# Analysis: Enable Registration After Cancellation

## Current System Analysis

### Database Schema Constraints
From `apps/api/prisma/schema.prisma`:
- The `Registration` model has a **unique constraint** on `[userId, year]` (line 175)
- This prevents users from having multiple registrations for the same year, regardless of status
- Registration status enum includes: `PENDING`, `CONFIRMED`, `CANCELLED`, `WAITLISTED` (line 327)

### Current Registration Logic
From `apps/web/src/utils/registrationUtils.ts`:
- `canUserRegister()` function checks if `hasExistingRegistration` is true and blocks registration if so
- `hasExistingRegistration` is determined by any registration for the current year, including cancelled ones
- The system currently treats cancelled registrations the same as active ones for re-registration purposes

### Backend Registration Service
From `apps/api/src/registrations/registrations.service.ts`:
- `create()` method (line 39) checks for existing registration using the unique constraint
- Throws `ConflictException` if any registration exists for the user/year combination
- No distinction made for cancelled registrations

### Frontend Dashboard Display
From `apps/web/src/pages/DashboardPage.tsx`:
- Shows cancelled registrations on the dashboard with status badges
- Currently displays all registration details including work shifts and payments for cancelled registrations

## Chosen Solution: Remove Database Constraint

**Decision**: Remove the unique constraint and enforce "one active registration per year" at the application level.

**Rationale**:
- System is in testing phase with no production data migration concerns
- Existing reporting infrastructure (RegistrationReportsPage.tsx) already handles multiple registrations per user/year
- Provides better audit trail and business intelligence capabilities
- Cleaner long-term architecture for extensibility
- Aligns with existing reporting patterns that filter by status

### Implementation Plan

#### Phase 1: Database Migration ✅ COMPLETED
```sql
-- Simple migration - remove unique constraint
ALTER TABLE registrations DROP CONSTRAINT registrations_userId_year_key;
```
**Status**: Migration `20250606011250_remove_unique_constraint_user_id_year` created and applied successfully.

#### Phase 2: Backend Application Logic Updates ✅ COMPLETED

1. **Update Registration Service** (`apps/api/src/registrations/registrations.service.ts`): ✅
   - Updated `create()` method to check for active registrations only
   - Updated `findByUserAndYear()` method with optional `excludeCancelled` parameter
   - Updated `createCampRegistration()` method to use new logic
   - Updated `getMyCampRegistration()` to distinguish active vs cancelled registrations

2. **Update All Service Methods**: ✅ 
   - Added status filtering to queries that should exclude cancelled registrations
   - Updated tests to use `findFirst` instead of `findUnique`
   - Added comprehensive test case for re-registration after cancellation

#### Phase 3: Frontend Logic Updates ✅ COMPLETED

1. **Update Registration Access Logic** (`apps/web/src/utils/registrationUtils.ts`): ✅
   - Updated `canUserRegister()` to use `hasActiveRegistration` parameter
   - Updated `getRegistrationStatusMessage()` to use active registration logic
   - Added helper functions `getActiveRegistrations()` and `getCancelledRegistrations()`
   - Added `RegistrationStatus` enum for consistency

2. **Update Frontend Registration Checks**: ✅
   - Modified `DashboardPage.tsx` to check for active (non-cancelled) registrations only
   - Updated `RegistrationPage.tsx` to use the same logic
   - Updated tests to reflect new parameter names and logic

#### Phase 4: Dashboard Display Strategy ✅ COMPLETED

**Approach**: Show cancelled registrations in separate "Registration History" section ✅
- Clean current status display for active registrations ✅
- Accessible history for cancelled registrations ✅
- Maintains audit trail transparency ✅
- Aligns with existing reporting patterns ✅

**Implementation**: Added "Registration History" section to `DashboardPage.tsx` that displays cancelled registrations with their work shifts and payment history in a separate, clearly labeled section.

## Detailed Implementation Steps

### Step 1: Database Migration
```sql
-- Execute this migration
ALTER TABLE registrations DROP CONSTRAINT registrations_userId_year_key;
```

### Step 2: Backend Updates

#### Core Registration Service (`apps/api/src/registrations/registrations.service.ts`)
- Update `create()` method to check for active registrations only
- Update `findByUserAndYear()` to optionally filter by status
- Update `getMyCampRegistration()` to distinguish active vs cancelled

#### Admin Registration Service (`apps/api/src/registrations/services/registration-admin.service.ts`)
- Ensure admin queries continue to show all registrations (for reporting)
- Update any validation logic that checks for existing registrations

### Step 3: Frontend Updates

#### Core Utilities (`apps/web/src/utils/registrationUtils.ts`)
- Update `canUserRegister()` to use `hasActiveRegistration` parameter
- Modify helper functions to filter cancelled registrations in user flows

#### Dashboard (`apps/web/src/pages/DashboardPage.tsx`)
- Filter to show only active registration in main view
- Add "Registration History" section for cancelled registrations
- Update registration status checks

#### Registration Page (`apps/web/src/pages/registration/RegistrationPage.tsx`)  
- Update registration access checks to use active registrations only

#### Hooks (`apps/web/src/hooks/`)
- Update `useUserRegistrations.ts` to provide filtering helpers
- Update `useCampRegistration.ts` to distinguish registration status

### Step 4: Testing & Validation
1. Test re-registration flow after cancellation
2. Verify reporting pages continue to work correctly
3. Test admin interfaces show appropriate registration history
4. Validate payment linkage remains intact

## Code Impact Assessment

### Files Requiring Changes:

#### Frontend:
- `apps/web/src/utils/registrationUtils.ts` - Core logic updates
- `apps/web/src/pages/DashboardPage.tsx` - Display logic for cancelled registrations
- `apps/web/src/pages/registration/RegistrationPage.tsx` - Registration access checks
- `apps/web/src/hooks/useUserRegistrations.ts` - Potentially add filtering helpers
- `apps/web/src/hooks/useCampRegistration.ts` - Update registration status logic

#### Backend:
- `apps/api/src/registrations/registrations.service.ts` - Core registration creation logic
- `apps/api/src/registrations/services/registration-admin.service.ts` - Admin service updates
- May need updates to other services that check registration status

#### Tests:
- Update all tests in `apps/web/src/utils/__tests__/registrationUtils.test.ts`
- Add new test cases for cancelled registration scenarios
- Update integration tests

## Risk Assessment

### Low Risk:
- Database migration (simple constraint removal, no production data)
- Frontend display changes
- Registration access logic updates

### Medium Risk:  
- Backend service logic changes
- Ensuring all queries properly filter cancelled registrations
- Race conditions in registration creation (mitigated by application-level checks)

### Mitigations:
- Comprehensive testing of re-registration scenarios
- Code review checklist for status filtering
- Gradual rollout with feature flags if needed

## Alternative Considerations

### Business Logic Questions:
1. **Payment Handling**: What happens to payments from cancelled registrations?
2. **Data Retention**: Should cancelled registrations be archived differently?
3. **Audit Trail**: How to maintain clear audit trail of registration changes?
4. **User Communication**: Should users be notified about ability to re-register?

### Technical Considerations:
1. **Race Conditions**: Multiple simultaneous registrations for same user/year (mitigated by application-level validation)
2. **Data Integrity**: Payment records remain cleanly linked to their specific registrations
3. **Performance**: Minimal impact - adding status filters to existing queries
4. **Audit Trail**: Enhanced with complete registration history maintained
5. **Reporting Compatibility**: Existing reports already handle multiple registrations per user/year

## Benefits of Chosen Approach

### Business Benefits:
- Complete audit trail of registration attempts
- Better analytics on registration patterns and cancellation behavior  
- Clean separation of cancelled vs active registrations
- Transparency for users about their registration history

### Technical Benefits:
- Aligns with existing reporting infrastructure
- Simple database migration with no data transformation
- Clean architecture for future extensibility
- Each registration maintains its own payment and job relationships

### User Experience Benefits:
- Users can re-register after cancellation
- Clear distinction between current and historical registrations
- Maintained transparency about past registration attempts

## Testing Strategy

See [Testing Strategy: Re-registration After Cancellation](./allow-registration-after-cancellation-testing.md) for comprehensive testing guidance covering:
- Backend service tests (registration logic, admin queries)
- Frontend component tests (dashboard, registration page, utilities)
- Integration tests (E2E re-registration flow, admin interfaces)
- Database migration tests
- API integration tests
- Test fixtures and checklist

## Next Steps

1. **Execute database migration** (simple constraint removal)
2. **Update backend services** to enforce active registration limits via application logic
3. **Update frontend components** to filter cancelled registrations from user flows
4. **Implement registration history section** on dashboard
5. **Add comprehensive test coverage** following the testing strategy document
6. **Validate all reporting interfaces** continue to function correctly 