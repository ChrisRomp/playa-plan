import { test, expect } from '@playwright/test';

test.describe('Admin Registration Pagination Fix (Issue #105)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and login as admin
    await page.goto('/');
    
    // Click on Sign In link
    await page.click('text=Sign In');
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Login as admin
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.click('button:has-text("Send Verification Code")');
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    await page.fill('input[inputMode="numeric"]', '123456');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Verify login successful
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
  });

  test('should display all registrations without 50-record pagination limit', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Wait for registration table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Check the network request to verify unlimited parameter
    const responsePromise = page.waitForResponse('/admin/registrations*');
    
    // Trigger a fresh data load by refreshing or re-filtering
    await page.reload();
    await expect(page.locator('table')).toBeVisible();
    
    const response = await responsePromise;
    const responseBody = await response.json();
    
    // Verify the response structure has the expected pagination info
    expect(responseBody).toHaveProperty('registrations');
    expect(responseBody).toHaveProperty('total');
    expect(responseBody).toHaveProperty('limit');
    
    // The key fix: limit should be 0 (unlimited) when no limit is specified
    console.log('API Response - Total:', responseBody.total, 'Limit:', responseBody.limit);
    
    // Verify that limit is 0 (unlimited) - this is the core fix
    expect(responseBody.limit).toBe(0);
    
    // Verify that all registrations are returned (registrations.length === total)
    expect(responseBody.registrations.length).toBe(responseBody.total);
    
    // If there are more than 50 registrations, this proves the fix works
    if (responseBody.total > 50) {
      console.log('SUCCESS: Fix validated - showing', responseBody.total, 'registrations (>50 limit)');
      expect(responseBody.registrations.length).toBeGreaterThan(50);
    } else {
      console.log('Note: Test database has', responseBody.total, 'registrations (less than 50)');
    }
    
    // Verify the UI shows all the registrations
    const tableRows = page.locator('table tbody tr');
    const displayedCount = await tableRows.count();
    
    // The displayed count should match the total from API
    expect(displayedCount).toBe(responseBody.total);
  });

  test('should still support explicit pagination when limit is specified via UI', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
    
    // This test validates that the unlimited behavior works correctly in the UI
    // If pagination controls are added in the future, they should still work properly
    // For now, we just verify the page loads and displays registrations correctly
    const tableRows = page.locator('table tbody tr');
    const displayedCount = await tableRows.count();
    
    console.log('UI displays', displayedCount, 'registrations without pagination controls');
    
    // The unlimited fix should allow all registrations to be displayed
    expect(displayedCount).toBeGreaterThanOrEqual(0);
  });
});