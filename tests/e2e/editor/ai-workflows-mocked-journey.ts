import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installMockAiProviders } from '../support/mock-ai';
import { expect } from '../support/journey-test';

export const aiWorkflowsMockedJourney = {
  async runBrowserAiProviders(page: Page, baseURL: string): Promise<void> {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('button', { name: 'Download Image Generation Models' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Image Generation Models' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('Create image prompt').fill('neon product dashboard');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Assets');
    await expect(page.getByText('neon product dashboard.png')).toBeVisible({ timeout: 30_000 });

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove Create image mode' })).toBeEnabled();
    await page.getByRole('button', { name: 'Remove Create image mode' }).click();
    await page
      .getByRole('textbox', { name: 'Slide structure prompt' })
      .fill('Create a title and subtitle slide about browser AI QA');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await expect(page.getByRole('button', { name: 'AI workflow validated', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('button', { name: 'Generated through mocked browser AI', exact: true })).toBeVisible();

    await translateGeneratedTitle(editor, page);
  },

  async runWebGpuGemmaProviders(page: Page, baseURL: string): Promise<void> {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('combobox', { name: 'LLM Model' }).selectOption('gemma-4-webgpu');
    await expect(page.getByRole('button', { name: 'Remove LLM Model' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('combobox', { name: 'Language Detection Model' }).selectOption('language-detection-webgpu');
    await expect(page.getByRole('button', { name: 'Remove Language Detection Model' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('combobox', { name: 'Translation Model' }).selectOption('translategemma-webgpu');
    await expect(page.getByRole('button', { name: 'Remove Translation Model' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Remove Create image mode' }).click();
    await page
      .getByRole('textbox', { name: 'Slide structure prompt' })
      .fill('Create a title and subtitle slide about WebGPU model QA');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'AI workflow validated', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await translateGeneratedTitle(editor, page);
    await removeGemmaProviders(editor, page);
  },
};

async function translateGeneratedTitle(editor: EditorAppPage, page: Page): Promise<void> {
  await editor.openTool('AI Tools');
  await page.getByLabel('Translate to').selectOption('pt');
  await editor.openTool('Layout');
  await page.getByRole('button', { name: 'AI workflow validated', exact: true }).click();
  await page.getByRole('button', { name: 'Translate Selected Text' }).click();
  await expect(page.getByRole('button', { name: '[pt] AI workflow validated', exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

async function removeGemmaProviders(editor: EditorAppPage, page: Page): Promise<void> {
  await editor.openTool('AI Tools');
  await page.getByRole('button', { name: 'Remove Translation Model' }).click();
  await expect(page.getByRole('button', { name: 'Download Translation Model' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Remove Language Detection Model' }).click();
  await expect(page.getByRole('button', { name: 'Download Language Detection Model' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Remove LLM Model' }).click();
  await expect(page.getByRole('button', { name: 'Download LLM Model' })).toBeVisible({
    timeout: 30_000,
  });
}
