import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export const stockMediaSettings = {
  async configure(page: Page): Promise<void> {
    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('button', { name: 'Media integrations' })
      .click();
    await page.getByRole('textbox', { name: 'Unsplash access key' }).fill('e2e-unsplash-key');
    await page.getByRole('textbox', { name: 'GIPHY API key' }).fill('e2e-giphy-key');
    await page.getByRole('button', { name: 'Save media integrations' }).click();
    await expect(page.getByRole('dialog', { name: 'Media integrations' })).toBeHidden();
  },

  async clear(page: Page): Promise<void> {
    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('button', { name: 'Media integrations' })
      .click();
    await expect(page.getByText('Unsplash configured')).toBeVisible();
    await expect(page.getByText('GIPHY configured')).toBeVisible();
    await page.getByRole('button', { name: 'Clear media integrations' }).click();
    await expect(page.getByRole('textbox', { name: 'Unsplash access key' })).toHaveValue('');
    await expect(page.getByRole('textbox', { name: 'GIPHY API key' })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Clear media integrations' })).toBeDisabled();
    await page.getByRole('button', { name: 'Close media integrations' }).click();
    await expect(page.getByRole('dialog', { name: 'Media integrations' })).toBeHidden();
  },
};
