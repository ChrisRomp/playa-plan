# Shift Active Flag Implementation

## Overview
Implement a soft-delete mechanism for shifts using an `isActive` flag to preserve historical registration data while allowing shifts to be deactivated from appearing in registration workflows.

## Problem Statement
- Currently, shifts can be deleted, risking loss of historical registration data
- There is no way to retire shifts without losing reference integrity
- Past registrations need to remain queryable and auditable
- Admins need a way to hide outdated shifts from new registrations

## Solution Design

### 1. Database Schema Changes
**Shift Model Update** (in `prisma/schema.prisma`):
```prisma
model Shift {
  id          String    @id @default(uuid())
  name        String
  description String?
  startTime   String    // HH:MM format (24-hour time)
  endTime     String    // HH:MM format (24-hour time)
  dayOfWeek   DayOfWeek
  isActive    Boolean   @default(true)  // NEW: soft-delete flag
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  jobs        Job[]

  @@map("shifts")
}
```

**Create Migration**:
- Add `isActive` Boolean column to `shifts` table
- Default all existing shifts to `true`
- Migration name: `add_is_active_to_shifts`

### 2. Backend Changes

#### ShiftsService (`apps/api/src/shifts/shifts.service.ts`)
- **findAll()**: Add filter to return only `isActive: true` shifts by default
- **findAllIncludingInactive()**: New method to fetch all shifts (admin use)
- **findOne()**: Can return inactive shifts (for historical data access)
- **deactivate()**: New method to set `isActive: false` (soft delete)
  - Should NOT delete the shift record
  - Should preserve all related jobs and registrations
  - Should log audit record if using AdminAudit
- **update()**: Prevent deletion if `isActive: true` is being changed on shift with registrations
- **remove()**: Deprecate or modify to use soft delete via deactivate()

#### ShiftsController (`apps/api/src/shifts/shifts.controller.ts`)
- **GET /shifts**: Return only active shifts (default filtering)
- **GET /shifts/all**: (Admin only) Return all shifts including inactive
- **PATCH /shifts/:id/deactivate**: (Admin only) Soft-delete endpoint
  - Return the deactivated shift
  - Log the action

#### Validation Logic
Add checks before deactivating:
- Can deactivate even if shift has jobs with registrations
- This is intentional to hide old shifts from new registrations
- Historical data remains intact

### 3. Frontend Changes

#### AdminJobsPage / Shifts Management (`apps/web/src/pages/Admin...`)
- **Filter Toggle**: Add dropdown/checkbox to show "Active Only" vs "All Shifts"
- **Default View**: Show only active shifts by default
- **Inactive Indicator**: Show visual indicator (grayed out, "Inactive" badge) for inactive shifts
- **Deactivate Button**: Replace "Delete" with "Deactivate" for shifts
- **Reactivate Option**: Option to toggle `isActive: true` for inactive shifts

#### API Hook Changes (`apps/web/src/hooks/useShifts.tsx`)
- **getAllShifts()**: Add optional parameter `includeInactive?: boolean`
- **deactivateShift()**: New function to call `/shifts/:id/deactivate`
- **reactivateShift()**: New function to call `PATCH /shifts/:id` with `isActive: true`

#### Registration Flow
- Shifts endpoint used by participants should only return `isActive: true` shifts
- No UI changes needed on registration side (filter handled by API)

### 4. API Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/shifts` | Public | Get active shifts (for registration) |
| GET | `/shifts/all` | Admin | Get all shifts (for admin management) |
| PATCH | `/shifts/:id/deactivate` | Admin | Soft-delete a shift |
| PATCH | `/shifts/:id` | Admin | Update shift + reactivate |
| DELETE | `/shifts/:id` | Admin | _(deprecated)_ Use deactivate instead |

### 5. Data Preservation Guarantees
- ✅ All historical registrations remain intact
- ✅ Registration data maintains foreign key integrity
- ✅ Job records linked to inactive shifts remain queryable
- ✅ Audit trail preserved (past registrations still auditable)
- ✅ No data loss or cascading deletes

## Implementation Tasks

- [ ] Create and run Prisma migration to add `isActive` column
- [ ] Update Shift model in `schema.prisma`
- [ ] Update `ShiftsService` with new methods and filtering logic
- [ ] Update `ShiftsController` with new endpoints
- [ ] Add validation and error handling
- [ ] Create unit tests for new service methods
- [ ] Create E2E tests for deactivate workflow
- [ ] Update `useShifts` hook with new API calls
- [ ] Update `AdminShiftsPage` (or shift management UI) with filter and UI changes
- [ ] Update registration flow endpoints to use active-only filter
- [ ] Add JSDoc comments documenting the isActive behavior
- [ ] Update API documentation/OpenAPI specs

## Testing Checklist

### Backend Tests
- [ ] Deactivating a shift preserves all related jobs
- [ ] Deactivating a shift preserves all registrations
- [ ] `findAll()` excludes inactive shifts
- [ ] `findAllIncludingInactive()` includes inactive shifts
- [ ] Audit records created for deactivations
- [ ] Reactivating an inactive shift works correctly

### Frontend Tests
- [ ] Filter toggle shows/hides inactive shifts
- [ ] Default view shows only active shifts
- [ ] Deactivate button calls correct endpoint
- [ ] Inactive shifts show proper visual indicator
- [ ] Registration flow only receives active shifts

### E2E Tests
- [ ] Admin can deactivate a shift with jobs and registrations
- [ ] Registration data remains queryable after shift deactivation
- [ ] Admin can reactivate an inactive shift
- [ ] Registrations tied to inactive shifts still appear in reports

## Breaking Changes
- None. Existing API clients will get filtered results; old behavior can be accessed via `/shifts/all`

## Backward Compatibility
- All existing shifts default to `isActive: true`
- `DELETE /shifts/:id` remains available but should be deprecated in favor of deactivate endpoint
- Public registration endpoints automatically filter to active shifts

## Future Considerations
- Bulk deactivation for end-of-season cleanup
- Scheduled archival (auto-deactivate shifts after event date)
- Shift templates for recurring events
