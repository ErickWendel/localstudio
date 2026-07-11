import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { animationEditorActions } from './animation-editor-actions';

export const animationClickBuildPreview = {
  async run(page: Page, baseURL: string): Promise<void> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await animationEditorActions.addNamedTextElement(editor, page, 'Click build one');
    await animationEditorActions.addNamedTextElement(editor, page, 'Click build two');

    await animationEditorActions.selectLayer(editor, page, 'Click build one');
    await editor.openTool('Animate');
    await page.getByLabel('New object animation effect').selectOption('reveal');
    await page.getByLabel('New animation direction').selectOption('up');
    await page.getByRole('button', { name: 'Add animation' }).click();
    await page.getByRole('spinbutton', { name: 'Duration for Click build one' }).fill('0');

    await animationEditorActions.selectLayer(editor, page, 'Click build two');
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
};
