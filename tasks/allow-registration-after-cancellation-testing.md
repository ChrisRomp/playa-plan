# Testing Strategy: Re-registration After Cancellation

This document outlines the comprehensive testing strategy for enabling users to register again after having a cancelled registration.

## Testing Principles

- **User-facing flows** should treat cancelled registrations as "no active registration"
- **Admin/reporting flows** should continue to show complete registration history  
- **Data integrity** must be maintained with proper payment and job linkage
- **Backward compatibility** with existing reporting and admin interfaces

## Backend Tests

### 1. Registration Service Tests (`apps/api/src/registrations/registrations.service.spec.ts`)

#### Existing Tests to Modify:
```typescript
// Update this test - should no longer throw ConflictException for cancelled registrations
describe('create registration validation', () => {
  it('should throw ConflictException only for active registrations', async () => {
    // Setup cancelled registration
    mockPrismaService.registration.findFirst.mockResolvedValue(null);
    
    // Should NOT throw for cancelled registrations
    await expect(service.create(createDto)).resolves.toBeDefined();
    
    // Setup active registration  
    mockPrismaService.registration.findFirst.mockResolvedValue({
      id: 'active-reg',
      status: RegistrationStatus.PENDING
    });
    
    // Should throw for active registrations
    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
  });
});
```

#### New Tests to Add:
```typescript
describe('Registration after cancellation', () => {
  const createDto = {
    userId: 'user-id',
    year: 2024,
    jobIds: ['job-id']
  };

  beforeEach(() => {
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.job.findUnique.mockResolvedValue(mockJob);
    mockPrismaService.registration.create.mockResolvedValue(mockRegistration);
  });

  it('should allow new registration when user has only cancelled registration', async () => {
    mockPrismaService.registration.findFirst.mockResolvedValue(null); // No active registration

    const result = await service.create(createDto);

    expect(result).toBeDefined();
    expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-id',
        year: 2024,
        status: { notIn: [RegistrationStatus.CANCELLED] }
      }
    });
  });

  it('should prevent registration when user has active registration', async () => {
    mockPrismaService.registration.findFirst.mockResolvedValue({
      id: 'existing-id',
      status: RegistrationStatus.PENDING
    });

    await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    expect(mockPrismaService.registration.create).not.toHaveBeenCalled();
  });

  it('should allow registration when user has confirmed registration for different year', async () => {
    mockPrismaService.registration.findFirst.mockResolvedValue(null);

    const result = await service.create({ ...createDto, year: 2025 });
    expect(result).toBeDefined();
  });

  it('should check all non-cancelled statuses as active', async () => {
    const testCases = [
      RegistrationStatus.PENDING,
      RegistrationStatus.CONFIRMED, 
      RegistrationStatus.WAITLISTED
    ];

    for (const status of testCases) {
      mockPrismaService.registration.findFirst.mockResolvedValue({
        id: 'existing-id',
        status
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    }
  });
});

describe('findByUserAndYear with status filtering', () => {
  it('should optionally filter by status', async () => {
    // Test that the method can filter cancelled registrations when needed
    const userId = 'user-id';
    const year = 2024;
    
    await service.findByUserAndYear(userId, year, { excludeCancelled: true });
    
    expect(mockPrismaService.registration.findFirst).toHaveBeenCalledWith({
      where: {
        userId_year: { userId, year },
        status: { not: RegistrationStatus.CANCELLED }
      },
      include: expect.any(Object)
    });
  });
});
```

### 2. Admin Registration Service Tests (`apps/api/src/registrations/services/registration-admin.service.spec.ts`)

```typescript
describe('Admin registration queries with multiple registrations', () => {
  it('should return all registrations including cancelled for admin views', async () => {
    const mockRegistrations = [
      { id: '1', status: RegistrationStatus.CONFIRMED },
      { id: '2', status: RegistrationStatus.CANCELLED },
      { id: '3', status: RegistrationStatus.PENDING }
    ];
    
    mockPrismaService.registration.findMany.mockResolvedValue(mockRegistrations);
    
    const result = await adminService.getRegistrations({});
    
    expect(result.registrations).toHaveLength(3);
    expect(result.registrations.some(r => r.status === 'CANCELLED')).toBe(true);
  });

  it('should handle users with multiple registrations per year', async () => {
    const filters = { userId: 'user-id', year: 2024 };
    
    const result = await adminService.getRegistrations(filters);
    
    // Should not filter out any registrations for admin view
    expect(mockPrismaService.registration.findMany).toHaveBeenCalledWith({
      where: expect.not.objectContaining({
        status: expect.anything()
      })
    });
  });
});
```

## Frontend Tests

### 3. Registration Utils Tests (`apps/web/src/utils/__tests__/registrationUtils.test.ts`)

#### Update Existing Tests:
```typescript
describe('canUserRegister', () => {
  const mockConfig = {
    registrationOpen: true,
    currentYear: 2024
  };

  it('should allow registration when user has only cancelled registration', () => {
    const hasActiveRegistration = false; // Key change: only check active registrations
    
    const result = canUserRegister(mockConfig, mockUser, hasActiveRegistration);
    expect(result).toBe(true);
  });

  it('should prevent registration when user has active registration', () => {
    const hasActiveRegistration = true;
    
    const result = canUserRegister(mockConfig, mockUser, hasActiveRegistration);
    expect(result).toBe(false);
  });

  it('should work correctly when registration is closed', () => {
    const config = { ...mockConfig, registrationOpen: false };
    const hasActiveRegistration = false;
    
    const result = canUserRegister(config, mockUser, hasActiveRegistration);
    expect(result).toBe(false);
  });
});

describe('getRegistrationStatusMessage', () => {
  it('should return appropriate message when user has only cancelled registrations', () => {
    const hasActiveRegistration = false;
    const config = { registrationOpen: true, currentYear: 2024 };
    
    const message = getRegistrationStatusMessage(config, mockUser, hasActiveRegistration);
    expect(message).toBe('Registration for 2024 is open!');
  });
});
```

### 4. Dashboard Component Tests (`apps/web/src/pages/__tests__/DashboardPage.test.tsx`)

```typescript
describe('DashboardPage with cancelled registrations', () => {
  const mockCancelledRegistration = {
    id: '1', 
    year: 2024, 
    status: 'CANCELLED',
    jobs: [],
    payments: [{ id: 'p1', amount: 100, status: 'REFUNDED' }],
    user: mockUser
  };

  const mockActiveRegistration = {
    id: '2',
    year: 2024,
    status: 'CONFIRMED', 
    jobs: [{ id: 'j1', job: mockJob }],
    payments: [{ id: 'p2', amount: 100, status: 'COMPLETED' }],
    user: mockUser
  };

  it('should show registration button when user has only cancelled registration', async () => {
    mockUseUserRegistrations.mockReturnValue({
      registrations: [mockCancelledRegistration],
      loading: false,
      error: null
    });

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Start Registration')).toBeInTheDocument();
    });
  });

  it('should show registration history section for cancelled registrations', async () => {
    mockUseUserRegistrations.mockReturnValue({
      registrations: [mockActiveRegistration, mockCancelledRegistration],
      loading: false,
      error: null
    });

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Registration History')).toBeInTheDocument();
      expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    });
  });

  it('should not show registration button when user has active registration', async () => {
    mockUseUserRegistrations.mockReturnValue({
      registrations: [mockActiveRegistration],
      loading: false,
      error: null
    });

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Start Registration')).not.toBeInTheDocument();
    });
  });

  it('should display cancelled registration details in history', async () => {
    mockUseUserRegistrations.mockReturnValue({
      registrations: [mockCancelledRegistration],
      loading: false, 
      error: null
    });

    render(<DashboardPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Registration History')).toBeInTheDocument();
      expect(screen.getByText('$100.00 USD')).toBeInTheDocument(); // Refunded payment
      expect(screen.getByText('REFUNDED')).toBeInTheDocument();
    });
  });
});
```

### 5. Registration Page Tests (`apps/web/src/pages/registration/__tests__/RegistrationPage.test.tsx`)

```typescript
describe('RegistrationPage access control', () => {
  it('should allow access when user has only cancelled registration', async () => {
    const mockCampRegistration = {
      hasRegistration: false, // Key: should be false for cancelled-only
      campingOptions: [],
      customFieldValues: [],
      jobRegistrations: [
        { id: '1', status: 'CANCELLED', jobs: [], payments: [] }
      ]
    };

    mockUseCampRegistration.mockReturnValue({
      campRegistration: mockCampRegistration,
      loading: false,
      error: null
    });

    render(<RegistrationPage />);
    
    await waitFor(() => {
      expect(screen.queryByText('Registration Not Available')).not.toBeInTheDocument();
    });
  });

  it('should block access when user has active registration', async () => {
    const mockCampRegistration = {
      hasRegistration: true,
      campingOptions: [],
      customFieldValues: [],
      jobRegistrations: [
        { id: '1', status: 'CONFIRMED', jobs: [], payments: [] }
      ]
    };

    mockUseCampRegistration.mockReturnValue({
      campRegistration: mockCampRegistration,
      loading: false,
      error: null
    });

    render(<RegistrationPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Registration Not Available')).toBeInTheDocument();
    });
  });
});
```

### 6. Hooks Tests

#### Update `useCampRegistration.test.tsx`:
```typescript
describe('useCampRegistration with cancelled registrations', () => {
  it('should return hasRegistration: false when only cancelled registrations exist', async () => {
    const mockResponse = {
      campingOptions: [],
      customFieldValues: [],
      jobRegistrations: [
        { id: '1', status: 'CANCELLED' }
      ],
      hasRegistration: false // Should be false for cancelled-only
    };

    (apiModule.registrations.getMyCampRegistration as Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useCampRegistration());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.campRegistration?.hasRegistration).toBe(false);
  });

  it('should return hasRegistration: true when active registrations exist', async () => {
    const mockResponse = {
      campingOptions: [],
      customFieldValues: [],
      jobRegistrations: [
        { id: '1', status: 'CONFIRMED' },
        { id: '2', status: 'CANCELLED' }
      ],
      hasRegistration: true
    };

    (apiModule.registrations.getMyCampRegistration as Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useCampRegistration());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.campRegistration?.hasRegistration).toBe(true);
  });
});
```

#### Update `useUserRegistrations.test.tsx`:
```typescript
describe('useUserRegistrations filtering helpers', () => {
  it('should provide helper to get active registrations', async () => {
    const mockRegistrations = [
      { id: '1', status: 'CONFIRMED', year: 2024 },
      { id: '2', status: 'CANCELLED', year: 2024 },
      { id: '3', status: 'PENDING', year: 2023 }
    ];

    (apiModule.registrations.getMyRegistrations as Mock).mockResolvedValue(mockRegistrations);
    
    const { result } = renderHook(() => useUserRegistrations());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    // Test that component can filter active registrations
    const activeRegistrations = result.current.registrations.filter(r => r.status !== 'CANCELLED');
    expect(activeRegistrations).toHaveLength(2);
  });
});
```

## Integration Tests

### 7. Registration Flow E2E Tests (`tests/e2e/registration-flow.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Re-registration after cancellation', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test data and login
    await page.goto('/');
  });

  test('should allow user to register again after cancellation', async ({ page }) => {
    // 1. Login as participant
    await page.click('text=Sign In');
    await page.fill('input[type="email"]', 'participant@test.com');
    await page.click('button:has-text("Send Verification Code")');
    await page.fill('input[inputMode="numeric"]', '123456');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // 2. Complete registration
    await page.click('text=Start Registration');
    // ... complete registration flow
    
    // 3. Admin cancels registration
    await page.goto('/admin/registrations');
    await page.click(`button:has-text("Cancel Registration")`);
    await page.fill('textarea[name="reason"]', 'Test cancellation');
    await page.click('button:has-text("Cancel Registration")');
    
    // 4. User should be able to register again
    await page.goto('/dashboard');
    await expect(page.locator('text=Start Registration')).toBeVisible();
    
    // 5. Complete new registration
    await page.click('text=Start Registration');
    // ... complete registration flow again
    
    // 6. Verify new registration exists and cancelled one is in history
    await page.goto('/dashboard'); 
    await expect(page.locator('text=Registration History')).toBeVisible();
    await expect(page.locator('text=CANCELLED')).toBeVisible();
  });

  test('should show registration history with cancelled registration', async ({ page }) => {
    // Setup user with cancelled registration
    await page.goto('/dashboard');
    
    // Verify history section is visible
    await expect(page.locator('text=Registration History')).toBeVisible();
    
    // Verify cancelled registration details
    await expect(page.locator('text=CANCELLED')).toBeVisible();
    await expect(page.locator('text=REFUNDED')).toBeVisible();
  });

  test('should prevent registration when user has active registration', async ({ page }) => {
    // Setup user with active registration
    await page.goto('/registration');
    
    // Should be redirected or see "not available" message
    await expect(page.locator('text=Registration Not Available')).toBeVisible();
  });
});
```

### 8. Admin Registration Management Tests (`tests/e2e/admin-registration-management.spec.ts`)

```typescript
test.describe('Admin registration management with multiple registrations', () => {
  test('should show all registrations including cancelled in admin view', async ({ page }) => {
    await page.goto('/admin/registrations');
    
    // Should see both active and cancelled registrations
    await expect(page.locator('text=CONFIRMED')).toBeVisible();
    await expect(page.locator('text=CANCELLED')).toBeVisible();
    
    // Should be able to filter by status
    await page.selectOption('select[name="status"]', 'CANCELLED');
    await expect(page.locator('text=CONFIRMED')).not.toBeVisible();
    await expect(page.locator('text=CANCELLED')).toBeVisible();
  });

  test('should handle user with multiple registrations per year correctly', async ({ page }) => {
    await page.goto('/admin/registrations');
    
    // Filter to specific user and year that has multiple registrations
    await page.fill('input[name="email"]', 'multiuser@test.com');
    await page.selectOption('select[name="year"]', '2024');
    
    // Should see multiple entries for same user/year
    const registrationRows = page.locator('tbody tr');
    await expect(registrationRows).toHaveCount(2); // One cancelled, one active
  });
});
```

## Database Tests

### 9. Migration Tests (`apps/api/test/migrations/remove-registration-constraint.spec.ts`)

```typescript
describe('Registration constraint removal migration', () => {
  it('should allow multiple registrations per user per year after migration', async () => {
    // Test that database allows multiple registrations after constraint removal
    const user = await prisma.user.create({
      data: { email: 'test@example.com', firstName: 'Test', lastName: 'User' }
    });

    // Create first registration
    const reg1 = await prisma.registration.create({
      data: {
        userId: user.id,
        year: 2024,
        status: 'CANCELLED'
      }
    });

    // Should be able to create second registration for same user/year
    const reg2 = await prisma.registration.create({
      data: {
        userId: user.id,
        year: 2024,
        status: 'PENDING'
      }
    });

    expect(reg1.id).not.toBe(reg2.id);
    expect(reg1.year).toBe(reg2.year);
    expect(reg1.userId).toBe(reg2.userId);
  });

  it('should maintain data integrity after migration', async () => {
    // Test that existing data remains intact and accessible
    const registrations = await prisma.registration.findMany({
      include: { user: true, payments: true, jobs: true }
    });

    // All existing registrations should still be accessible
    expect(registrations.length).toBeGreaterThan(0);
    
    // Relationships should still work
    registrations.forEach(reg => {
      expect(reg.user).toBeDefined();
      expect(reg.payments).toBeDefined();
      expect(reg.jobs).toBeDefined();
    });
  });
});
```

## API Integration Tests

### 10. Registration API Tests (`apps/api/test/registrations.e2e-spec.ts`)

```typescript
describe('Registration API with cancelled registrations', () => {
  it('POST /registrations should allow registration after cancellation', async () => {
    // Setup user with cancelled registration
    const user = await createTestUser();
    const cancelledReg = await createCancelledRegistration(user.id, 2024);
    
    const newRegistrationData = {
      userId: user.id,
      year: 2024,
      jobIds: ['job-id']
    };

    const response = await request(app.getHttpServer())
      .post('/registrations')
      .send(newRegistrationData)
      .expect(201);

    expect(response.body.id).not.toBe(cancelledReg.id);
    expect(response.body.status).toBe('PENDING');
  });

  it('POST /registrations should prevent registration with active registration', async () => {
    const user = await createTestUser();
    const activeReg = await createActiveRegistration(user.id, 2024);
    
    const newRegistrationData = {
      userId: user.id,
      year: 2024, 
      jobIds: ['job-id']
    };

    await request(app.getHttpServer())
      .post('/registrations')
      .send(newRegistrationData)
      .expect(409); // Conflict
  });

  it('GET /registrations/me should return all registrations including cancelled', async () => {
    const user = await createTestUser();
    await createCancelledRegistration(user.id, 2024);
    await createActiveRegistration(user.id, 2024);

    const response = await request(app.getHttpServer())
      .get('/registrations/me')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.some(r => r.status === 'CANCELLED')).toBe(true);
    expect(response.body.some(r => r.status === 'CONFIRMED')).toBe(true);
  });

  it('GET /admin/registrations should show all registrations for admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/registrations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.registrations.some(r => r.status === 'CANCELLED')).toBe(true);
  });
});
```

## Test Data Setup

### 11. Test Fixtures (`apps/api/test/fixtures/registrations.ts`)

```typescript
export const mockCancelledRegistration = {
  id: 'cancelled-reg-id',
  userId: 'user-id', 
  year: 2024,
  status: 'CANCELLED',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-15T14:30:00Z', // Cancelled later
  jobs: [],
  payments: [
    { 
      id: 'payment-id',
      status: 'REFUNDED',
      amount: 100,
      currency: 'USD'
    }
  ]
};

export const mockActiveRegistration = {
  id: 'active-reg-id',
  userId: 'user-id',
  year: 2024, 
  status: 'CONFIRMED',
  createdAt: '2024-01-20T10:00:00Z',
  updatedAt: '2024-01-20T10:00:00Z',
  jobs: [
    {
      id: 'reg-job-id',
      job: {
        id: 'job-id',
        name: 'Kitchen Helper',
        location: 'Kitchen',
        category: { name: 'Kitchen' },
        shift: { 
          name: 'Morning',
          startTime: '08:00',
          endTime: '12:00',
          dayOfWeek: 'MONDAY'
        }
      }
    }
  ],
  payments: [
    {
      id: 'payment-id-2',
      status: 'COMPLETED',
      amount: 100, 
      currency: 'USD'
    }
  ]
};

export const createTestUser = async (overrides = {}) => {
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      ...overrides
    }
  });
};

export const createCancelledRegistration = async (userId: string, year: number) => {
  return await prisma.registration.create({
    data: {
      userId,
      year,
      status: 'CANCELLED'
    }
  });
};

export const createActiveRegistration = async (userId: string, year: number) => {
  return await prisma.registration.create({
    data: {
      userId,
      year,
      status: 'CONFIRMED'
    }
  });
};
```

## Testing Checklist

### Pre-Implementation Testing
- [ ] Current tests pass with existing constraint
- [ ] Baseline behavior documented

### Post-Migration Testing  
- [ ] Database migration executes successfully
- [ ] Multiple registrations per user/year can be created
- [ ] Existing data remains intact

### Backend Testing
- [ ] Registration service allows new registration after cancellation
- [ ] Registration service prevents duplicate active registrations
- [ ] Admin services continue to show all registrations
- [ ] API endpoints behave correctly

### Frontend Testing
- [ ] Dashboard shows registration button for cancelled-only users
- [ ] Dashboard shows registration history section
- [ ] Registration page allows access for cancelled-only users
- [ ] Registration utils correctly identify active vs cancelled

### Integration Testing
- [ ] End-to-end re-registration flow works
- [ ] Admin interfaces handle multiple registrations correctly
- [ ] Reporting continues to function properly
- [ ] Payment and job relationships remain intact

### Performance Testing
- [ ] Query performance with status filtering
- [ ] Database performance with removed constraint
- [ ] Frontend rendering with registration history

This comprehensive testing strategy ensures that the re-registration feature works correctly while maintaining all existing functionality and data integrity. 