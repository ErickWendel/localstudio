import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class JoystickAppPage extends BasePage {
  constructor(page: Page, baseURL: string) {
    super(page, baseURL);
  }

  async gotoRemote() {
    await this.goto('/joystick/');
    await expect(this.page.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
  }
}
