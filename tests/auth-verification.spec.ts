import { test, expect } from '@playwright/test';

test.describe('Authentication Code Verification', () => {
  test('should reset button state when verification fails', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Click on Login link to go to login page
    await page.click('text=Log In');
    
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
    await expect(page.locator('text=Error:'), { timeout: 5000 }).toBeVisible();
  });
});