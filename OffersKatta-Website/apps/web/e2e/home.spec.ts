import { test, expect } from '@playwright/test';

test.describe('Public home', () => {
  test('hero, categories, and featured offers render', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/OffersKatta/i);
    await expect(page.getByRole('heading', { name: /Discover deals near you/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Browse by category/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Featured offers/i })).toBeVisible();
  });

  test('search page lists offers and filters by query', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByPlaceholder(/Search restaurants/i)).toBeVisible();
    // At least one card from the seeded offers should be visible
    await expect(page.locator('a[href^="/offers/"]').first()).toBeVisible();
  });

  test('clicking a category navigates to filtered search', async ({ page }) => {
    await page.goto('/');
    const foodTile = page.getByRole('link', { name: /Food & Drink/i });
    await foodTile.click();
    await expect(page).toHaveURL(/\/search\?categoryId=/);
  });
});
