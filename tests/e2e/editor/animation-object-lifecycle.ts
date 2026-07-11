import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const animationObjectLifecycle = {
  async run(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Add a little bit of body text', exact: true }).click();

    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('fade-and-move');
    await page.getByLabel('New animation direction').selectOption('right');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await expect(page.getByRole('listitem', { name: /Build 1: Add a little bit of body text/ })).toBeVisible();
    await page.getByLabel('Effect for Add a little bit of body text').selectOption('scale');
    await page.getByLabel('Start for Add a little bit of body text').selectOption('after-previous');
    await page.getByRole('spinbutton', { name: 'Duration for Add a little bit of body text' }).fill('5');
    await page.getByRole('button', { name: 'Play animation preview' }).click();
    await expect(page.getByRole('listitem', { name: /Build 1: Add a little bit of body text/ })).toBeVisible();
    await page.getByRole('button', { name: 'Remove animation from Add a little bit of body text' }).click();
    await expect(page.getByText('No object animations on this slide.')).toBeVisible();
  },
};
