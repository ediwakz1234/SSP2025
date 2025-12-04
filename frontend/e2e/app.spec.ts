import { test, expect } from '@playwright/test';

/**
 * Landing Page E2E Tests
 * Tests the public landing page functionality
 */
test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('should have a login button', async ({ page }) => {
    const loginButton = page.getByRole('link', { name: /login|sign in/i });
    await expect(loginButton).toBeVisible();
  });

  test('should have a register button', async ({ page }) => {
    const registerButton = page.getByRole('link', { name: /register|sign up|get started/i });
    await expect(registerButton).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: /login|sign in/i }).first().click();
    await expect(page).toHaveURL(/.*login/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

/**
 * Authentication Flow E2E Tests
 */
test.describe('Authentication', () => {
  test('login page should have email and password fields', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
  });

  test('register page should have required fields', async ({ page }) => {
    await page.goto('/register');
    
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test('should show error on invalid login', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /login|sign in/i }).click();
    
    // Should show an error message
    await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
  });

  test('should have forgot password link', async ({ page }) => {
    await page.goto('/login');
    
    const forgotLink = page.getByRole('link', { name: /forgot/i });
    await expect(forgotLink).toBeVisible();
  });
});

/**
 * Protected Routes E2E Tests
 */
test.describe('Protected Routes', () => {
  test('dashboard should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
  });

  test('admin pages should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/admin');
    
    // Should redirect to login or show unauthorized
    await expect(page).toHaveURL(/.*login|.*admin\/login/, { timeout: 10000 });
  });
});

/**
 * Navigation E2E Tests
 */
test.describe('Navigation', () => {
  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');
    
    // Check that main navigation elements exist
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
  });

  test('404 page should be displayed for unknown routes', async ({ page }) => {
    await page.goto('/this-page-does-not-exist');
    
    // Should show 404 or redirect
    await expect(page.getByText(/404|not found|page.*exist/i)).toBeVisible({ timeout: 10000 });
  });
});

/**
 * Accessibility E2E Tests
 */
test.describe('Accessibility', () => {
  test('landing page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    
    // Should have at least one h1
    const h1Count = await h1.count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('forms should have proper labels', async ({ page }) => {
    await page.goto('/login');
    
    // Email input should have an accessible label
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible();
  });
});
