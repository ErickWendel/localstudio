import { expect, type Page } from '@playwright/test';
import { BasePage } from './base.page';

export class EditorAppPage extends BasePage {
  constructor(page: Page, baseURL: string) {
    super(page, baseURL);
  }

  async gotoNewProject() {
    await this.goto('/editor/?newProject=1');
    await expect(this.page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(this.page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible({
      timeout: 30_000,
    });
  }

  async openMenu(name: 'Edit' | 'File' | 'Help' | 'View') {
    await this.page.getByRole('button', { name, exact: true }).click({ timeout: 30_000 });
    await expect(this.page.getByRole('menu', { name: `${name} menu` })).toBeVisible();
  }

  async openTool(tab: 'AI Tools' | 'Animate' | 'Assets' | 'Design' | 'Elements' | 'Layout' | 'Text') {
    const toolTab = this.page.getByLabel('Tool menu').getByRole('tab', { name: tab });
    if ((await toolTab.getAttribute('aria-expanded')) !== 'true') {
      await toolTab.click();
    }
    await expect(toolTab).toHaveAttribute('aria-expanded', 'true');
  }

  async renameProject(name: string) {
    await this.page.getByRole('button', { name: /Edit project name/i }).click();
    const input = this.page.getByLabel('Project name');
    await input.fill(name);
    await input.press('Enter');
    await expect(this.page.getByRole('button', { name: `Edit project name ${name}` })).toBeVisible();
  }

  async openPagesPanel() {
    const pagesPanel = this.page.getByRole('complementary', { name: 'Pages' });
    if (!(await pagesPanel.isVisible().catch(() => false))) {
      await this.page.getByRole('button', { name: 'Toggle pages panel' }).click();
    }
    await expect(pagesPanel).toBeVisible();
  }
}
