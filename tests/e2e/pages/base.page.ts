import type { Page } from '@playwright/test';

export abstract class BasePage {
  constructor(
    readonly page: Page,
    readonly baseURL: string,
  ) {}

  protected url(path: string) {
    return new URL(path, this.baseURL).toString();
  }

  async goto(path: string) {
    await this.page.goto(this.url(path));
  }
}
