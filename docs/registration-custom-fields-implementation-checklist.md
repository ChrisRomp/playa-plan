# Registration Custom Fields Implementation Checklist

## Overview
Structured implementation plan for adding camping registration custom field values to the admin registration reports. This follows a modular approach prioritizing MVP functionality with extensibility.

---

## 1. Backend API Implementation

### 1.1 Database Layer
- [x] 1.1.1 Review existing indexes on camping option tables
- [x] 1.1.2 Add performance indexes if needed:
  - [x] 1.1.2.1 `idx_camping_option_registrations_user_id` on `camping_option_registrations(user_id)`
  - [x] 1.1.2.2 `idx_camping_option_field_values_registration_id` on `camping_option_field_values(registration_id)`
- [x] 1.1.3 Verify database constraints and foreign keys are properly set up

### 1.2 Service Layer Implementation
- [x] 1.2.1 Add method to `RegistrationAdminService` class
  - [x] 1.2.1.1 Create `getCampingOptionRegistrationsWithFields()` method
  - [x] 1.2.1.2 Implement query filters (year, userId, campingOptionId, includeInactive)
  - [x] 1.2.1.3 Add proper Prisma includes for nested data (user, campingOption, fieldValues, fields)
  - [x] 1.2.1.4 Implement error handling and logging
- [x] 1.2.2 Add method overload to existing `getRegistrations()` method
  - [x] 1.2.2.1 Add `includeCampingOptions?: boolean` parameter
  - [x] 1.2.2.2 Conditionally include camping option data in response
  - [x] 1.2.2.3 Maintain backward compatibility

### 1.3 Controller Layer Implementation
- [x] 1.3.1 Add new endpoint to `AdminRegistrationsController`
  - [x] 1.3.1.1 Implement `GET /admin/registrations/camping-options-with-fields`
  - [x] 1.3.1.2 Add query parameter validation using DTOs
  - [x] 1.3.1.3 Add OpenAPI/Swagger documentation
  - [x] 1.3.1.4 Ensure proper ADMIN role authorization
- [x] 1.3.2 Enhance existing `getRegistrations` endpoint
  - [x] 1.3.2.1 Add `includeCampingOptions` query parameter
  - [x] 1.3.2.2 Update API documentation
  - [x] 1.3.2.3 Maintain response format compatibility

### 1.4 DTO Implementation
- [x] 1.4.1 Create new DTOs in `admin-registration.dto.ts`
  - [x] 1.4.1.1 `CampingOptionRegistrationWithFieldsDto`
  - [x] 1.4.1.2 `CampingOptionFieldValueDto`
  - [x] 1.4.1.3 `AdminCampingOptionQueryDto` for query parameters
- [x] 1.4.2 Add validation decorators and OpenAPI documentation
- [x] 1.4.3 Export new DTOs from `dto/index.ts`

### 1.5 Backend Testing
- [ ] 1.5.1 Unit Tests
  - [ ] 1.5.1.1 Test `RegistrationAdminService.getCampingOptionRegistrationsWithFields()`
  - [ ] 1.5.1.2 Test query filtering logic (year, userId, campingOptionId)
  - [ ] 1.5.1.3 Test error cases (user not found, no data, etc.)
  - [ ] 1.5.1.4 Test enhanced `getRegistrations()` with camping options
- [ ] 1.5.2 Integration Tests
  - [ ] 1.5.2.1 Test new admin controller endpoint
  - [ ] 1.5.2.2 Test authorization (admin-only access)
  - [ ] 1.5.2.3 Test query parameter handling
  - [ ] 1.5.2.4 Test response structure matches DTOs
- [ ] 1.5.3 Performance Tests
  - [ ] 1.5.3.1 Test with large datasets (1000+ registrations)
  - [ ] 1.5.3.2 Measure query execution time
  - [ ] 1.5.3.3 Test memory usage with nested data

---

## 2. Frontend API Integration

### 2.1 Type Definitions
- [ ] 2.1.1 Update `apps/web/src/lib/api.ts`
  - [ ] 2.1.1.1 Add `CampingOptionRegistrationWithFields` interface
  - [ ] 2.1.1.2 Add `CampingOptionFieldValue` interface
  - [ ] 2.1.1.3 Extend or create new registration type with camping options
- [ ] 2.1.2 Update existing `Registration` interface (if needed)
- [ ] 2.1.3 Add camping option filter types to `RegistrationReportFilters`

### 2.2 API Client Methods
- [ ] 2.2.1 Add to `reports` object in `api.ts`
  - [ ] 2.2.1.1 `getCampingOptionRegistrations()` method
  - [ ] 2.2.1.2 Add query parameters support (year, userId, etc.)
  - [ ] 2.2.1.3 Proper error handling and TypeScript return types
- [ ] 2.2.2 Enhance existing `getRegistrations()` method
  - [ ] 2.2.2.1 Add `includeCampingOptions` parameter
  - [ ] 2.2.2.2 Update return type to include camping option data conditionally
- [ ] 2.2.3 Add admin-specific API methods to `admin-registrations.ts` (if exists)

### 2.3 API Integration Testing
- [ ] 2.3.1 Unit Tests
  - [ ] 2.3.1.1 Mock API responses for new endpoints
  - [ ] 2.3.1.2 Test error handling (network errors, 404s, etc.)
  - [ ] 2.3.1.3 Test query parameter construction
- [ ] 2.3.2 Integration Tests
  - [ ] 2.3.2.1 Test API client against real backend endpoints
  - [ ] 2.3.2.2 Verify response data structure matches TypeScript types

---

## 3. Frontend UI Implementation

### 3.1 Registration Reports Page Enhancement

#### 3.1.1 State Management
- [ ] 3.1.1.1 Add `showCampingOptions` to component state
- [ ] 3.1.1.2 Add camping option data to component state
- [ ] 3.1.1.3 Update `RegistrationReportFilters` interface
- [ ] 3.1.1.4 Implement state persistence (localStorage)

#### 3.1.2 Data Fetching Logic
- [ ] 3.1.2.1 Update `fetchRegistrations()` to conditionally fetch camping options
- [ ] 3.1.2.2 Add separate `fetchCampingOptionData()` method
- [ ] 3.1.2.3 Implement loading states for camping option data
- [ ] 3.1.2.4 Handle errors gracefully (fallback to basic registration data)

#### 3.1.3 Filter Interface Updates
- [ ] 3.1.3.1 Add "Show Registration Fields" toggle to filters panel
- [ ] 3.1.3.2 Update filter state management
- [ ] 3.1.3.3 Add camping option-specific filters (if needed)
- [ ] 3.1.3.4 Update clear filters functionality

### 3.2 Table Column Implementation

#### 3.2.1 Dynamic Column Management
- [ ] 3.2.1.1 Create `buildTableColumns()` helper function
- [ ] 3.2.1.2 Conditionally add camping options column based on toggle state
- [ ] 3.2.1.3 Implement column rendering logic for camping option data
- [ ] 3.2.1.4 Handle missing or empty field values gracefully

#### 3.2.2 Camping Options Column Implementation
- [ ] 3.2.2.1 Create `formatCampingOptionData()` helper function
- [ ] 3.2.2.2 Format multiple camping options per user
- [ ] 3.2.2.3 Format custom field values (key: value pairs)
- [ ] 3.2.2.4 Handle different field data types (string, number, boolean, date)
- [ ] 3.2.2.5 Add responsive design considerations (mobile-friendly display)

#### 3.2.3 Table Performance Optimization
- [ ] 3.2.3.1 Implement memoization for column definitions
- [ ] 3.2.3.2 Optimize rendering for large datasets
- [ ] 3.2.3.3 Consider virtualization for wide tables (if needed)

### 3.3 Export Functionality Enhancement

#### 3.3.1 CSV Export Updates
- [ ] 3.3.1.1 Update `exportData()` function to include camping options
- [ ] 3.3.1.2 Add camping option columns to CSV headers
- [ ] 3.3.1.3 Flatten camping option data for CSV format
- [ ] 3.3.1.4 Handle special characters and CSV escaping
- [ ] 3.3.1.5 Update filename generation to reflect camping option inclusion

#### 3.3.2 Export Options
- [ ] 3.3.2.1 Add toggle for including camping options in exports
- [ ] 3.3.2.2 Maintain backward compatibility for existing exports
- [ ] 3.3.2.3 Consider additional export formats (Excel, PDF) for future

### 3.4 Frontend Testing

#### 3.4.1 Component Tests
- [ ] 3.4.1.1 Test registration reports page with camping options toggle
- [ ] 3.4.1.2 Test table rendering with and without camping option data
- [ ] 3.4.1.3 Test filter functionality
- [ ] 3.4.1.4 Test export functionality with camping options
- [ ] 3.4.1.5 Test error states and loading states

#### 3.4.2 Integration Tests
- [ ] 3.4.2.1 Test full user flow: toggle → fetch data → display → export
- [ ] 3.4.2.2 Test with various camping option configurations
- [ ] 3.4.2.3 Test responsive design on different screen sizes

#### 3.4.3 E2E Tests
- [ ] 3.4.3.1 Test complete admin workflow
- [ ] 3.4.3.2 Test export file generation and download
- [ ] 3.4.3.3 Test performance with large datasets

---

## 4. Performance & Optimization

### 4.1 Backend Performance
- [ ] 4.1.1 Database Query Optimization
  - [ ] 4.1.1.1 Review query execution plans
  - [ ] 4.1.1.2 Add database indexes as needed
  - [ ] 4.1.1.3 Optimize Prisma queries and includes
- [ ] 4.1.2 Response Optimization
  - [ ] 4.1.2.1 Implement pagination for large datasets
  - [ ] 4.1.2.2 Consider response compression
  - [ ] 4.1.2.3 Add response caching headers

### 4.2 Frontend Performance
- [ ] 4.2.1 Data Loading Optimization
  - [ ] 4.2.1.1 Implement lazy loading for camping option data
  - [ ] 4.2.1.2 Add client-side caching
  - [ ] 4.2.1.3 Implement debounced filtering
- [ ] 4.2.2 Rendering Optimization
  - [ ] 4.2.2.1 Optimize table rendering for wide datasets
  - [ ] 4.2.2.2 Implement virtual scrolling if needed
  - [ ] 4.2.2.3 Use React.memo for expensive components

### 4.3 Memory Management
- [ ] 4.3.1 Monitor memory usage with large datasets
- [ ] 4.3.2 Implement data cleanup on component unmount
- [ ] 4.3.3 Optimize data structures for memory efficiency

---

## 5. User Experience & Accessibility

### 5.1 User Interface Polish
- [ ] 5.1.1 Loading States
  - [ ] 5.1.1.1 Add loading spinner for camping option data fetch
  - [ ] 5.1.1.2 Progressive loading (show basic data first)
  - [ ] 5.1.1.3 Skeleton loading for table rows
- [ ] 5.1.2 Error Handling
  - [ ] 5.1.2.1 User-friendly error messages
  - [ ] 5.1.2.2 Retry mechanisms for failed requests
  - [ ] 5.1.2.3 Graceful degradation when camping options fail to load

### 5.2 Responsive Design
- [ ] 5.2.1 Mobile optimization for wide tables
- [ ] 5.2.2 Tablet layout considerations
- [ ] 5.2.3 Horizontal scrolling for camping option columns

### 5.3 Accessibility
- [ ] 5.3.1 Screen reader compatibility
- [ ] 5.3.2 Keyboard navigation support
- [ ] 5.3.3 ARIA labels for dynamic content
- [ ] 5.3.4 High contrast mode support

### 5.4 Usability Features
- [ ] 5.4.1 Remember user's toggle preference (localStorage)
- [ ] 5.4.2 Tooltip explanations for complex data
- [ ] 5.4.3 Column sorting for camping option data
- [ ] 5.4.4 Search/filter within camping option values

---

## 6. Testing & Quality Assurance

### 6.1 Test Data Preparation
- [ ] 6.1.1 Create test users with various camping option combinations
- [ ] 6.1.2 Set up camping options with different custom field types
- [ ] 6.1.3 Create edge case data (missing values, special characters, etc.)

### 6.2 Testing Scenarios
- [ ] 6.2.1 Basic Functionality
  - [ ] 6.2.1.1 Toggle camping options on/off
  - [ ] 6.2.1.2 View users with no camping registrations
  - [ ] 6.2.1.3 View users with multiple camping options
  - [ ] 6.2.1.4 Export with and without camping options
- [ ] 6.2.2 Edge Cases
  - [ ] 6.2.2.1 Empty camping option field values
  - [ ] 6.2.2.2 Special characters in field values
  - [ ] 6.2.2.3 Very long field values
  - [ ] 6.2.2.4 Users with disabled camping options
- [ ] 6.2.3 Performance Testing
  - [ ] 6.2.3.1 Test with 1000+ registrations
  - [ ] 6.2.3.2 Test with 20+ custom fields per option
  - [ ] 6.2.3.3 Test export performance with large datasets

### 6.3 Cross-Browser Testing
- [ ] 6.3.1 Chrome/Chromium
- [ ] 6.3.2 Firefox
- [ ] 6.3.3 Safari
- [ ] 6.3.4 Mobile browsers

---

## 7. Documentation & Deployment

### 7.1 Code Documentation
- [ ] 7.1.1 Update API documentation (OpenAPI/Swagger)
- [ ] 7.1.2 Add JSDoc comments for new functions
- [ ] 7.1.3 Update README files with new functionality
- [ ] 7.1.4 Add inline code comments for complex logic

### 7.2 User Documentation
- [ ] 7.2.1 Update admin user guide
- [ ] 7.2.2 Add screenshots of new functionality
- [ ] 7.2.3 Document export format changes
- [ ] 7.2.4 Create troubleshooting guide

### 7.3 Deployment Preparation
- [ ] 7.3.1 Review database migration requirements (none expected)
- [ ] 7.3.2 Update environment configuration if needed
- [ ] 7.3.3 Plan deployment rollback strategy
- [ ] 7.3.4 Prepare deployment checklist

### 7.4 Monitoring & Observability
- [ ] 7.4.1 Add logging for new endpoints
- [ ] 7.4.2 Monitor API response times
- [ ] 7.4.3 Track feature usage metrics
- [ ] 7.4.4 Set up alerts for errors

---

## 8. Post-Implementation

### 8.1 User Feedback Collection
- [ ] 8.1.1 Gather admin user feedback on usability
- [ ] 8.1.2 Monitor support tickets related to new feature
- [ ] 8.1.3 Collect performance feedback from users

### 8.2 Performance Monitoring
- [ ] 8.2.1 Monitor database query performance
- [ ] 8.2.2 Track frontend rendering performance
- [ ] 8.2.3 Monitor export generation times

### 8.3 Future Enhancement Planning
- [ ] 8.3.1 Evaluate need for advanced field selection (Option 2)
- [ ] 8.3.2 Consider dedicated camping options report page
- [ ] 8.3.3 Plan additional export formats
- [ ] 8.3.4 Assess need for real-time data updates

---

## Success Criteria Validation
- [ ] ✅ **Functional**: Admins can view custom field values in registration reports
- [ ] ✅ **Performance**: Report loads within 3 seconds for 1000+ registrations
- [ ] ✅ **Usability**: 95% of admin users find the feature intuitive
- [ ] ✅ **Export**: Custom field data is properly included in CSV exports

---

## Estimated Timeline
- **Backend Implementation**: 2-3 days (Items 1.1 - 1.5)
- **Frontend Implementation**: 3-4 days (Items 2.1 - 3.4)  
- **Testing & Polish**: 1-2 days (Items 4.1 - 6.3)
- **Documentation & Deployment**: 0.5-1 day (Items 7.1 - 7.4)

**Total: 6.5-10.5 days** (allowing for iteration and refinement)

---

## Notes
- This checklist follows the MVP approach (Option 1: Simple Toggle)
- Each major section can be developed and tested independently
- The modular structure allows for parallel development of backend and frontend components
- Performance considerations are integrated throughout rather than being an afterthought
- User experience and accessibility are prioritized alongside functionality