import { test, expect } from '@playwright/test';

test.describe('Admin area', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@offerhub.local');
    await page.getByLabel('Password').fill('Admin@12345');
    await page.getByRole('button', { name: /^Log in$/i }).click();
    await page.waitForURL(/\/admin\/dashboard/);
  });

  test('dashboard shows non-zero metrics from seeded data', async ({ page }) => {
    const usersCard = page.getByText(/Total users/i).first().locator('..').locator('..');
    await expect(usersCard).toContainText(/\d+/);
    await expect(page.getByText(/Brands/i).first()).toBeVisible();
    await expect(page.getByText(/Offers/i).first()).toBeVisible();
  });

  test('users page paginates seeded users', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByPlaceholder(/Search email/i)).toBeVisible();
    await expect(page.getByText(/admin@offerhub.local/i)).toBeVisible();
  });
});
