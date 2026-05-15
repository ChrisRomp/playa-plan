import { test, expect } from '@playwright/test';

test.describe('Authentication Code Verification', () => {
  test('should reset button state when verification fails', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Enter an incorrect verification code
    await page.fill('input[inputMode="numeric"]', '999999');
    
    // Click the Log In button
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // The button should show "Verifying..." initially
    await expect(page.locator('button:has-text("Verifying...")')).toBeVisible();
    
    // Wait for the API call to complete and check that button returns to normal state
    // This is the key test - the button should not stay stuck in "Verifying..." state
    await expect(page.locator('button:has-text("Log In")')).toBeVisible({ timeout: 10000 });
    
    // The button should be enabled again (not disabled)
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    
    // There should be an error message displayed
    await expect(page.locator('text=Error:')).toBeVisible({ timeout: 5000 });
  });

  test('should display specific error message for invalid verification code', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Enter the wrong verification code (121212 instead of 123456)
    await page.fill('input[inputMode="numeric"]', '121212');
    
    // Click the Log In button
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Verify the error message appears (this is the actual message returned by the API)
    await expect(page.locator('text=Failed to verify code. Please check your network connection.')).toBeVisible({ timeout: 10000 });
    
    // Verify the form allows retry
    await expect(page.locator('button:has-text("Log In")')).toBeEnabled();
    
    // Verify the verification code field is still present and can be edited
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    await expect(page.locator('input[inputMode="numeric"]')).toBeEditable();
  });

  test('should allow user to retry after wrong verification code', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Enter wrong code first
    await page.fill('input[inputMode="numeric"]', '121212');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Wait for error to appear (any error message)
    await expect(page.locator('text=Error:')).toBeVisible({ timeout: 10000 });
    
    // Clear the field and enter the correct code
    await page.fill('input[inputMode="numeric"]', '123456');
    
    // Click Log In again
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Should redirect to dashboard on successful login
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // Verify we're logged in by checking for sign out button
    await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
  });

  test('should handle multiple rapid clicks gracefully', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Enter verification code
    await page.fill('input[inputMode="numeric"]', '121212');
    
    // Click the button multiple times rapidly
    const loginButton = page.locator('button[type="submit"]:has-text("Log In")');
    await loginButton.click();
    await loginButton.click();
    await loginButton.click();
    
    // Should handle gracefully and show error eventually
    await expect(page.locator('text=Error:')).toBeVisible({ timeout: 10000 });
    
    // Should still be functional for retry
    await expect(page.locator('button:has-text("Log In")')).toBeEnabled();
  });

  test('should maintain email persistence across page refresh during verification', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Sign In link to go to login page
    await page.click('text=Sign In');
    
    // Wait for login form to load
    await expect(page.locator('h2:has-text("Log In or Sign Up")')).toBeVisible();
    
    // Enter email
    await page.fill('input[type="email"]', 'test@example.com');
    
    // Click send verification code
    await page.click('button:has-text("Send Verification Code")');
    
    // Wait for verification code input to appear
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Refresh the page
    await page.reload();
    
    // Should remember the email and show verification code form
    await expect(page.locator('text=A verification code has been sent to test@example.com')).toBeVisible();
    await expect(page.locator('input[inputMode="numeric"]')).toBeVisible();
    
    // Should still work for wrong code
    await page.fill('input[inputMode="numeric"]', '121212');
    await page.click('button[type="submit"]:has-text("Log In")');
    
    // Should show error (any error message)
    await expect(page.locator('text=Error:')).toBeVisible({ timeout: 10000 });
  });
});