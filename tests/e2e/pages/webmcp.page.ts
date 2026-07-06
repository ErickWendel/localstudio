import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class WebMcpPage extends BasePage {
  constructor(page: Page, baseURL: string) {
    super(page, baseURL);
  }

  async gotoShowcase() {
    await this.goto('/editor/webmcp');
    await expect(this.page.getByRole('heading', { name: /WebMCP/i })).toBeVisible();
  }
}
