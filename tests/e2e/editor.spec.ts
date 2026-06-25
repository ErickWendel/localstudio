import { expect, test } from '@playwright/test';

test('renders the editor shell and tabs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('LocalStudio.ai')).toBeVisible();
  await expect(page.getByText('Untitled AI Deck')).toBeVisible();
  await expect(
    page.getByPlaceholder('Describe slide structure or organize current content...'),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Design' }).click();
  await expect(page.getByText('16:9 Presentation')).toBeVisible();

  await page.getByRole('tab', { name: 'Layout' }).click();
  await expect(page.getByText('4 layers on current page')).toBeVisible();

  await page.getByRole('tab', { name: 'AI Tools' }).click();
  await expect(page.getByRole('button', { name: 'Download Required Models' })).toBeVisible();
});

test('downloads required model states', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'AI Tools' }).click();
  await page.getByRole('button', { name: 'Download Required Models' }).click();
  await expect(page.getByText('Ready').first()).toBeVisible();
});
