import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { animationEditorActions } from './animation-editor-actions';

export const animationMixedSequence = {
  async run(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await animationEditorActions.addNamedTextElement(editor, page, 'Typing headline');
    await editor.openTool('Elements');
    await page.getByRole('button', { name: 'Add arrow' }).click();
    await editor.openTool('Animate');
    await page.getByLabel('Slide transition effect').selectOption('push');
    await page.getByRole('spinbutton', { name: 'Slide transition duration' }).fill('1');
    await page.getByLabel('New object animation effect').selectOption('line-draw');
    await page.getByLabel('New line draw direction').selectOption('middle-to-ends');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await expect(page.getByRole('listitem', { name: /Build 1: Arrow/ })).toBeVisible();
    await page.getByLabel('Line draw direction for Arrow').selectOption('end-to-start');

    await animationEditorActions.selectLayer(editor, page, 'Typing headline');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('keyboard-typing');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await expect(page.getByRole('listitem', { name: /Build 2: Typing headline/ })).toBeVisible();

    await page.getByRole('button', { name: 'Move Typing headline animation up' }).click();
    await expect(page.getByRole('listitem', { name: /Build 1: Typing headline/ })).toBeVisible();
    await expect(page.getByRole('listitem', { name: /Build 2: Arrow/ })).toBeVisible();
    await page.getByLabel('Start for Typing headline').selectOption('after-transition');
    await page.getByLabel('Start for Arrow').selectOption('after-previous');
    await page.getByRole('button', { name: 'Play animation preview' }).click();
    await expect(page.getByLabel('Slide transition effect')).toHaveValue('push');
  },
};
