import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class PublicDeckPage extends BasePage {
  constructor(page: Page, baseURL: string) {
    super(page, baseURL);
  }

  async goto(path: string) {
    await this.page.goto(this.url(path), { waitUntil: 'domcontentloaded' });
  }

  async expectReady(embed = false) {
    await expect(
      this.page.getByRole('main', {
        name: embed ? 'Embedded shared deck' : 'Public presentation',
      }),
    ).toBeVisible();
    await expect(this.page.getByRole('region', { name: 'Shared slide preview' })).toBeVisible();
  }
}
