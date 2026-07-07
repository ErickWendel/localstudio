import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class LandingAppPage extends BasePage {
  constructor(page: Page, baseURL: string) {
    super(page, baseURL);
  }

  async gotoHome() {
    await this.goto('/');
    await expect(
      this.page.getByRole('heading', { name: /Design slides with local AI/i }),
    ).toBeVisible();
  }
}
