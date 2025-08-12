# Registration Custom Fields in Reports - Requirements Analysis

## Overview

This document analyzes the requirements to enable camping registration custom field values to be displayed in the registration reports. Currently, users can enter custom field values when registering for camping options, but these values are not visible in the admin registration reports.

## Current State Analysis

### Database Structure (✅ Complete)

The database schema already supports custom fields and their values:

- **CampingOption**: Base camping options (RV, tent, etc.)
- **CampingOptionField**: Custom fields defined for each camping option (e.g., "Vehicle License Plate", "Dietary Restrictions")
- **CampingOptionRegistration**: Links users to camping options they've registered for
- **CampingOptionFieldValue**: Stores the actual values users entered for custom fields

### Existing API Endpoints

#### ✅ Available
- `GET /camping-options/:id/fields` - Get custom fields for a camping option
- `GET /registrations/camp/me` - Get user's complete camp registration including camping options and custom field values
- `GET /admin/registrations/:id/camping-options` - Get camping options for a specific registration (but NO field values)

#### ❌ Missing
- **No admin endpoint to get ALL users' camping option registrations with field values for reporting**

### Current Frontend Report

The registration report (`/reports/registrations`) currently displays:
- ✅ User information (name, email)
- ✅ Registration status and date
- ✅ Work shifts/jobs assigned
- ❌ **Missing: Camping option selections and custom field values**

## Requirements for Implementation

### 1. Backend API Requirements

#### New Admin Endpoint Required
```
GET /admin/registrations/camping-options-with-fields
```

**Purpose**: Return all users' camping option registrations with their custom field values for admin reporting.

**Query Parameters**:
- `year?: number` - Filter by registration year
- `userId?: string` - Filter by specific user
- `campingOptionId?: string` - Filter by specific camping option
- `includeInactive?: boolean` - Include disabled camping options (default: false)

**Response Structure**:
```typescript
interface CampingOptionRegistrationWithFields {
  id: string;
  userId: string;
  campingOptionId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    playaName?: string;
  };
  campingOption: {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    fields: CampingOptionField[];
  };
  fieldValues: Array<{
    id: string;
    value: string;
    fieldId: string;
    field: {
      id: string;
      displayName: string;
      dataType: FieldType;
      required: boolean;
    };
  }>;
}
```

**Implementation Location**:
- Controller: `apps/api/src/registrations/controllers/admin-registrations.controller.ts`
- Service: `apps/api/src/registrations/services/registration-admin.service.ts`
- Add to existing admin registrations module (requires ADMIN role)

#### Alternative: Enhance Existing Endpoint
Could enhance `GET /admin/registrations` to include camping option data:

**Option A** (Recommended): Add query parameter `includeCampingOptions=true`
- Less disruptive to existing consumers
- Backward compatible
- Avoids data bloat when camping options aren't needed

**Option B**: Always include camping options
- Simpler API but larger payload
- May impact performance for large datasets

### 2. Frontend Requirements

#### Enhanced Registration Report Interface

**New Features Required**:

1. **Camping Options Toggle**
   ```typescript
   interface ReportFilters {
     showCampingOptions: boolean; // New toggle
     selectedCampingOptionFields?: string[]; // Optional: specific field selection
   }
   ```

2. **Dynamic Column Management**
   - Toggle to show/hide camping option columns
   - Camping option name as column header
   - Custom field values as sub-columns or combined display

3. **Table Column Structure (Option 1: Simple)**
   ```
   | User | Email | Status | Shifts | Camping Options |
   |------|-------|--------|--------|----------------|
   | John Doe | john@... | Confirmed | Kitchen | RV (License: ABC123, Size: 32ft) |
   ```

4. **Table Column Structure (Option 2: Detailed)**
   ```
   | User | Email | Status | Shifts | RV License | RV Size | Tent Capacity | Dietary Notes |
   |------|-------|--------|--------|-----------|---------|---------------|---------------|
   | John | john@... | Confirmed | Kitchen | ABC123 | 32ft | - | Vegetarian |
   ```

5. **CSV Export Enhancement**
   - Include camping option data in exports
   - Flatten custom field values into separate columns
   - Maintain backward compatibility for existing exports

#### Implementation Files to Modify

1. **API Integration**
   - `apps/web/src/lib/api.ts` - Add new `reports.getRegistrationsWithCampingOptions()`
   - `apps/web/src/lib/api/admin-registrations.ts` - Add camping options methods

2. **Report Page**
   - `apps/web/src/pages/RegistrationReportsPage.tsx` - Add toggle and column logic
   - Update column definitions to include camping option fields
   - Enhance filter interface

3. **Types**
   - `apps/web/src/lib/api.ts` - Extend Registration interface or create new type
   - Add TypeScript definitions for camping option data

### 3. Implementation Approach Options

#### Option 1: Simple Toggle (Recommended for MVP)
- Add single toggle: "Show Camping Options"
- When enabled, adds one column showing all camping options and field values as formatted text
- Minimal UI changes required
- Quick to implement

#### Option 2: Advanced Field Selection
- Allow admins to select which custom fields to display as columns
- More complex UI with field picker
- Better for camps with many custom fields
- Requires more development effort

#### Option 3: Separate Camping Options Report
- Create dedicated report page for camping option data
- Full-featured interface optimized for camping option analysis
- Most flexible but requires additional development

### 4. Performance Considerations

#### Database Queries
- The new endpoint will require complex joins across multiple tables
- Consider pagination for large datasets
- Add database indexes if needed:
  ```sql
  CREATE INDEX idx_camping_option_registrations_user_id ON camping_option_registrations(user_id);
  CREATE INDEX idx_camping_option_field_values_registration_id ON camping_option_field_values(registration_id);
  ```

#### Frontend Performance
- Large datasets with many custom fields could create wide tables
- Consider virtualization for tables with many columns
- Implement client-side filtering and sorting

#### Caching Strategy
- Cache camping option metadata (field definitions)
- Consider Redis caching for frequently accessed report data

### 5. User Experience Requirements

#### Admin Interface Enhancements
1. **Settings Persistence**: Remember user's column preferences
2. **Responsive Design**: Handle wide tables on mobile devices
3. **Export Flexibility**: Multiple export formats (CSV, Excel, PDF)
4. **Data Validation**: Handle missing or invalid field values gracefully

#### Accessibility
- Ensure screen reader compatibility with dynamic columns
- Maintain keyboard navigation
- Provide alternative text for complex data visualizations

### 6. Security Considerations

- ✅ Existing admin authentication already in place
- ✅ Role-based access control for admin endpoints
- Ensure sensitive custom field data is properly protected
- Consider PII implications of custom field values in exports

### 7. Testing Requirements

#### Backend Testing
- Unit tests for new admin service methods
- Integration tests for camping option data retrieval
- Performance tests with large datasets

#### Frontend Testing
- Component tests for enhanced report interface
- E2E tests for toggling camping option display
- Export functionality tests

### 8. Migration Considerations

#### Data Migration
- No database schema changes required (✅)
- Existing data will work immediately

#### API Versioning
- New endpoints are additive (no breaking changes)
- Consider API versioning for future enhancements

### 9. Estimated Development Effort

#### Backend (2-3 days)
- New admin endpoint implementation: 1 day
- Testing and optimization: 1-2 days

#### Frontend (3-4 days)
- API integration: 1 day  
- UI enhancements: 2 days
- Testing and refinement: 1 day

#### Total: 5-7 days for MVP implementation

### 10. Success Metrics

1. **Functional**: Admins can view custom field values in registration reports
2. **Performance**: Report loads within 3 seconds for 1000+ registrations
3. **Usability**: 95% of admin users find the feature intuitive
4. **Export**: Custom field data is properly included in CSV exports

## Conclusion

The implementation requires:
1. **New backend API endpoint** to fetch camping option registrations with field values
2. **Frontend enhancements** to display the new data with toggle controls
3. **Export functionality updates** to include custom fields in CSV downloads

The database structure is already complete, so this is primarily an API and UI enhancement project. The recommended approach is to start with a simple toggle implementation (Option 1) that can be enhanced later based on user feedback.