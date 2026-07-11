import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';

export const animationWorkflowJourney = {
  async runClickTriggeredBuildPreview(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await addNamedTextElement(editor, page, 'Click build one');
    await addNamedTextElement(editor, page, 'Click build two');

    await selectLayer(editor, page, 'Click build one');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('reveal');
    await page.getByLabel('New animation direction').selectOption('up');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await page.getByRole('spinbutton', { name: 'Duration for Click build one' }).fill('0');

    await selectLayer(editor, page, 'Click build two');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('fade-and-move');
    await page.getByLabel('New animation direction').selectOption('down');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await page.getByRole('spinbutton', { name: 'Duration for Click build two' }).fill('0');

    const canvasFrame = page.getByTestId('slide-canvas-frame');
    await page.getByRole('button', { name: 'Play animation preview' }).click();
    await expect(canvasFrame).toHaveAttribute('data-animation-preview', 'playing');
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-phase', 'waiting');
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-waiting', 'true');
    await expect(page.getByRole('status')).toContainText('Click the slide to play the next animation.');

    await canvasFrame.click({ position: { x: 480, y: 260 } });
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-phase', 'waiting');
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-waiting', 'true');

    await canvasFrame.click({ position: { x: 520, y: 300 } });
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-phase', 'complete');
    await expect(canvasFrame).toHaveAttribute('data-animation-preview-waiting', 'false');
  },

  async runMixedTextAndShapeSequence(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await addNamedTextElement(editor, page, 'Typing headline');
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

    await selectLayer(editor, page, 'Typing headline');
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

  async runObjectAnimationEditLifecycle(page: Page, baseURL: string): Promise<void> {
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

async function addNamedTextElement(editor: EditorAppPage, page: Page, name: string): Promise<void> {
  await editor.openTool('Text');
  await page.getByRole('button', { name: 'Add a text box' }).click();
  await editor.openTool('Design');
  await page
    .getByRole('tablist', { name: 'Movie inspector sections' })
    .getByRole('tab', { name: 'Text' })
    .click();
  await page.getByRole('textbox', { name: 'Selected text content' }).fill(name);
}

async function selectLayer(editor: EditorAppPage, page: Page, name: string): Promise<void> {
  await editor.openTool('Layout');
  await page.locator(`.layer-list article[role="button"][aria-label="${name}"]`).click();
}
