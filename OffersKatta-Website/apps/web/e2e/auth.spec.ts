import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login redirects an admin to /admin/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@offerhub.local');
    await page.getByLabel('Password').fill('Admin@12345');
    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.waitForURL(/\/admin\/dashboard/);
    await expect(page.getByRole('heading', { name: /Total users/i })).toBeVisible({ timeout: 10_000 });
  });

  test('login redirects a seller to /seller/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('owner@abc-restaurant.local');
    await page.getByLabel('Password').fill('Owner@12345');
    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.waitForURL(/\/seller\/dashboard/);
    await expect(page.getByRole('heading', { name: /Seller dashboard/i })).toBeVisible();
  });

  test('protected route bounces unauthenticated users to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/seller/dashboard');
    await page.waitForURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Log in/i })).toBeVisible();
  });

  test('invalid credentials surface an error toast', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@offerhub.local');
    await page.getByLabel('Password').fill('WRONG');
    await page.getByRole('button', { name: /^Log in$/i }).click();
    // Sonner toasts render with role="status" or a visible text
    await expect(page.getByText(/Invalid credentials|Login failed/i)).toBeVisible({ timeout: 5_000 });
  });
});
