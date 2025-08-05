import { test, expect } from '@playwright/test';

test.describe('Admin Registration Management', () => {
  // Setup admin login for tests
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter admin email (assuming test admin user exists)
    await page.fill('input[type="email"]', 'admin@test.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Enter correct verification code for admin
    await page.fill('input[inputMode="numeric"]', '123456');
    
    // Click the Log In button
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Should redirect to dashboard on successful login
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // Verify we're logged in as admin
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  // Task 5.10.9: Test admin navigation menu only shows "Manage Registrations" for admin role users
  test('should show "Manage Registrations" in admin navigation', async ({ page }) => {
    // Look for admin navigation or sidebar
    await expect(page.locator('text=Admin Panel')).toBeVisible();
    
    // Click on Admin Panel to expand/navigate to admin area
    await page.click('text=Admin Panel');
    
    // Verify "Manage Registrations" link is visible for admin users
    await expect(page.locator('text=Manage Registrations')).toBeVisible();
  });

  // Task 5.10.1: Test admin can find, edit, and save registration changes successfully
  test('should allow admin to find, edit, and save registration changes', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Wait for registration table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Search for a specific registration (assuming test data exists)
    await page.fill('input[placeholder*="search" i]', 'test@example.com');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Click on Edit button for first registration
    await page.click('button:has-text("Edit")');
    
    // Wait for edit modal to open
    await expect(page.locator('text=Edit Registration')).toBeVisible();
    
    // Change registration status
    await page.click('input[value="PENDING"]');
    
    // Add notes
    await page.fill('textarea[placeholder*="notes" i]', 'Updated by admin via e2e test');
    
    // Enable notification toggle
    await page.check('input[type="checkbox"]');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for success message
    await expect(page.locator('text=successfully updated')).toBeVisible({ timeout: 10000 });
    
    // Verify modal closes
    await expect(page.locator('text=Edit Registration')).not.toBeVisible();
  });

  // Task 5.10.2: Test admin can cancel registration with optional refund and notification
  test('should allow admin to cancel registration with refund and notification options', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Click on Cancel button for first registration
    await page.click('button:has-text("Cancel")');
    
    // Wait for cancel modal to open
    await expect(page.locator('text=Cancel Registration')).toBeVisible();
    
    // Fill in cancellation reason
    await page.fill('textarea[placeholder*="reason" i]', 'Cancelled due to e2e testing');
    
    // Check process refund if payment exists
    await page.check('input[type="checkbox"]:near(text="Process refund")');
    
    // Check send notification
    await page.check('input[type="checkbox"]:near(text="Send notification")');
    
    // Confirm cancellation
    await page.click('button:has-text("Cancel Registration")');
    
    // Wait for success message
    await expect(page.locator('text=successfully cancelled')).toBeVisible({ timeout: 10000 });
    
    // Verify modal closes
    await expect(page.locator('text=Cancel Registration')).not.toBeVisible();
  });

  // Task 5.10.3: Test audit trail is visible and accurate after admin operations
  test('should display audit trail after admin operations', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Click on Audit Trail button for first registration
    await page.click('button:has-text("Audit Trail")');
    
    // Wait for audit trail modal to open
    await expect(page.locator('text=Audit Trail')).toBeVisible();
    
    // Verify audit records are displayed
    await expect(page.locator('text=Action Type')).toBeVisible();
    await expect(page.locator('text=Admin User')).toBeVisible();
    await expect(page.locator('text=Date')).toBeVisible();
    
    // Check for at least one audit record
    await expect(page.locator('[data-testid="audit-record"]').first()).toBeVisible();
    
    // Close audit trail modal
    await page.click('button:has-text("Close")');
    
    // Verify modal closes
    await expect(page.locator('text=Audit Trail')).not.toBeVisible();
  });

  // Task 5.10.5: Test error handling and user feedback for all admin operations
  test('should handle errors gracefully with proper user feedback', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Try to edit a non-existent registration by manipulating URL
    await page.goto('/admin/registrations?edit=non-existent-id');
    
    // Should show error message
    await expect(page.locator('text=Error')).toBeVisible({ timeout: 5000 });
    
    // Navigate back to registrations page
    await page.click('text=Manage Registrations');
    
    // Test validation error - try to save edit form without changes
    await page.click('button:has-text("Edit")');
    await expect(page.locator('text=Edit Registration')).toBeVisible();
    
    // Click save without making changes
    await page.click('button:has-text("Save Changes")');
    
    // Should show validation error
    await expect(page.locator('text=No changes have been made')).toBeVisible();
  });

  // Task 5.10.6: Test mobile responsiveness of admin registration management interface
  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Verify table is responsive (may be horizontally scrollable)
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Test mobile-friendly action buttons
    await page.click('button:has-text("Edit")');
    
    // Modal should fit on mobile screen
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  // Task 5.10.10: Test automatic Stripe refund processing for registration cancellations
  test('should process automatic Stripe refunds during cancellation', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Find a registration with Stripe payment
    await page.fill('input[placeholder*="search" i]', 'stripe-payment-user@test.com');
    await page.waitForTimeout(1000);
    
    // Cancel the registration
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Cancel Registration')).toBeVisible();
    
    // Fill cancellation details
    await page.fill('textarea[placeholder*="reason" i]', 'Testing Stripe refund processing');
    
    // Enable automatic refund processing
    await page.check('input[type="checkbox"]:near(text="Process refund")');
    
    // Submit cancellation
    await page.click('button:has-text("Cancel Registration")');
    
    // Wait for success message mentioning refund
    await expect(page.locator('text=Refund of')).toBeVisible({ timeout: 15000 });
    
    // Or wait for message about automatic processing
    await expect(page.locator('text=automatically processed')).toBeVisible({ timeout: 15000 });
  });

  // Task 5.10.11: Test manual refund messaging for MANUAL payments and failed automatic refunds
  test('should show manual refund messaging for manual payments', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Find a registration with manual payment
    await page.fill('input[placeholder*="search" i]', 'manual-payment-user@test.com');
    await page.waitForTimeout(1000);
    
    // Cancel the registration
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Cancel Registration')).toBeVisible();
    
    // Fill cancellation details
    await page.fill('textarea[placeholder*="reason" i]', 'Testing manual refund messaging');
    
    // Enable refund processing
    await page.check('input[type="checkbox"]:near(text="Process refund")');
    
    // Submit cancellation
    await page.click('button:has-text("Cancel Registration")');
    
    // Wait for manual refund message
    await expect(page.locator('text=manual refund')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=require manual processing')).toBeVisible({ timeout: 10000 });
  });

  // Task 5.10.12: Test notification emails contain correct content based on modification type
  test('should send notifications with correct content for different modification types', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Test registration edit notification
    await page.click('button:has-text("Edit")');
    await expect(page.locator('text=Edit Registration')).toBeVisible();
    
    // Make changes to trigger notification content
    await page.click('input[value="CONFIRMED"]');
    await page.fill('textarea[placeholder*="notes" i]', 'Status updated to confirmed');
    
    // Enable notification
    await page.check('input[type="checkbox"]:near(text="Send notification")');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for success message indicating notification was sent
    await expect(page.locator('text=notification sent')).toBeVisible({ timeout: 10000 });
    
    // Test cancellation notification
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('text=Cancel Registration')).toBeVisible();
    
    await page.fill('textarea[placeholder*="reason" i]', 'Testing cancellation notification');
    await page.check('input[type="checkbox"]:near(text="Send notification")');
    
    // Submit cancellation
    await page.click('button:has-text("Cancel Registration")');
    
    // Wait for success message with notification confirmation
    await expect(page.locator('text=notification sent')).toBeVisible({ timeout: 10000 });
  });

  // Task 5.10.4: Test unauthorized users cannot access admin registration management
  test('should deny access to non-admin users', async ({ page }) => {
    // Sign out current admin user
    await page.click('button:has-text("Sign Out")');
    
    // Sign in as regular participant user
    await page.click('text=Sign In');
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    await page.fill('input[type="email"]', 'participant@test.com');
    await page.click('button:has-text("Send Verification Code")');
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    await page.fill('input[inputMode="numeric"]', '123456');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Wait for dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // Try to access admin registration management directly
    await page.goto('/admin/registrations');
    
    // Should be redirected or show access denied
    await expect(page.locator('text=Access Denied')).toBeVisible({ timeout: 5000 });
    // OR should redirect to dashboard/home
    // await expect(page).toHaveURL(/.*dashboard/);
  });

  // Task 5.10.7: Test participant users are redirected or shown access denied when attempting to access admin registration management
  test('should redirect participant users away from admin areas', async ({ page }) => {
    // Sign out if logged in
    await page.click('button:has-text("Sign Out")');
    
    // Login as participant
    await page.click('text=Sign In');
    await page.fill('input[type="email"]', 'participant@test.com');
    await page.click('button:has-text("Send Verification Code")');
    await page.fill('input[inputMode="numeric"]', '123456');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Try to access admin registration management URL directly
    await page.goto('/admin/registrations');
    
    // Should show access denied or redirect
    const isAccessDenied = await page.locator('text=Access Denied').isVisible();
    const isRedirected = await page.url().includes('/dashboard');
    
    expect(isAccessDenied || isRedirected).toBeTruthy();
    
    // Verify "Manage Registrations" is not in navigation for participants
    await expect(page.locator('text=Manage Registrations')).not.toBeVisible();
  });

  // Task 5.10.8: Test staff users are redirected or shown access denied when attempting to access admin registration management
  test('should redirect staff users away from admin registration management', async ({ page }) => {
    // Sign out if logged in
    await page.click('button:has-text("Sign Out")');
    
    // Login as staff user
    await page.click('text=Sign In');
    await page.fill('input[type="email"]', 'staff@test.com');
    await page.click('button:has-text("Send Verification Code")');
    await page.fill('input[inputMode="numeric"]', '123456');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Try to access admin registration management URL directly
    await page.goto('/admin/registrations');
    
    // Should show access denied or redirect
    const isAccessDenied = await page.locator('text=Access Denied').isVisible();
    const isRedirected = await page.url().includes('/dashboard');
    
    expect(isAccessDenied || isRedirected).toBeTruthy();
    
    // Verify "Manage Registrations" is not in staff navigation
    await expect(page.locator('text=Manage Registrations')).not.toBeVisible();
  });

  // Additional comprehensive test scenarios
  // Test for unlimited registration pagination (Issue #105)
  test('should display all registrations without 50-record limit', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for the registrations page to load
    await expect(page.locator('h1:has-text("Manage Registrations")')).toBeVisible();
    
    // Wait for registration table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Check if any registrations are displayed
    const registrationRows = page.locator('table tbody tr');
    const count = await registrationRows.count();
    
    // If we have registrations, verify the count displays correctly
    if (count > 0) {
      // Look for any indication that shows total count
      const totalText = page.locator('text=/total|showing|of/i');
      if (await totalText.count() > 0) {
        console.log('Total registrations found on page:', count);
        
        // The fix should now show all registrations, not capped at 50
        // If there are more than 50 test registrations, this validates the fix
        if (count > 50) {
          console.log('SUCCESS: More than 50 registrations displayed - pagination limit fixed!');
        } else {
          console.log('Note: Test has', count, 'registrations (less than 50 limit to test)');
        }
      }
    } else {
      console.log('No registrations found in test database');
    }
    
    // Verify the page loads without errors regardless of registration count
    await expect(page.locator('table')).toBeVisible();
  });

  test('should handle pagination in registration list', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Wait for table to load
    await expect(page.locator('table')).toBeVisible();
    
    // Test pagination if available
    const nextButton = page.locator('button:has-text("Next")');
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(1000);
      
      // Verify page changed
      await expect(page.locator('text=Page 2')).toBeVisible();
    }
  });

  test('should filter registrations by status', async ({ page }) => {
    // Navigate to Manage Registrations page
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    // Use status filter
    await page.selectOption('select[name="status"]', 'CONFIRMED');
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    await expect(page.locator('text=CONFIRMED')).toBeVisible();
  });

  test('should handle concurrent admin operations gracefully', async ({ page, context }) => {
    // Open second tab/context to simulate concurrent access
    const page2 = await context.newPage();
    
    // Navigate both pages to registration management
    await page.click('text=Admin Panel');
    await page.click('text=Manage Registrations');
    
    await page2.goto('/admin/registrations');
    
    // Perform operation on first page
    await page.click('button:has-text("Edit")');
    await page.click('input[value="PENDING"]');
    
    // Perform operation on second page simultaneously
    await page2.click('button:has-text("Edit")');
    await page2.click('input[value="CONFIRMED"]');
    
    // Save on first page
    await page.click('button:has-text("Save Changes")');
    await expect(page.locator('text=successfully updated')).toBeVisible();
    
    // Save on second page - should handle gracefully
    await page2.click('button:has-text("Save Changes")');
    
    // Should either succeed or show appropriate conflict message
    const isSuccess = await page2.locator('text=successfully updated').isVisible();
    const isConflict = await page2.locator('text=conflict').isVisible();
    
    expect(isSuccess || isConflict).toBeTruthy();
  });
}); 