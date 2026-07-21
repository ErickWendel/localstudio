import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect } from '../support/journey-test';
import { installMockAiProviders } from '../support/mock-ai';
import { aiGemmaProviderActions } from './ai-gemma-provider-actions';
import { aiTranslationActions } from './ai-translation-actions';

export const aiWebGpuGemmaProvidersFlow = {
  async run(page: Page, baseURL: string): Promise<void> {
    await installMockAiProviders(page);

    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    await editor.openTool('AI Tools');
    await page.getByRole('combobox', { name: 'LLM Model' }).selectOption('gemma-4-webgpu');
    await expect(page.getByRole('button', { name: 'Remove LLM Model' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('combobox', { exact: true, name: 'Image generation model' }),
    ).toHaveValue('image-generation-models');
    await page.getByRole('combobox', { name: 'Language Detection Model' }).selectOption('language-detection-webgpu');
    await expect(page.getByRole('button', { name: 'Remove Language Detection Model' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('combobox', { name: 'Translation Model' }).selectOption('translategemma-webgpu');
    await expect(page.getByRole('button', { name: 'Remove Translation Model' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: 'Remove Create image mode' }).click();
    await expect(page.getByRole('combobox', { name: 'Prompt model' })).toHaveValue(
      'gemma-4-webgpu',
    );
    await page
      .getByRole('textbox', { name: 'Slide structure prompt' })
      .fill('Create a title and subtitle slide about WebGPU model QA');
    await page.getByRole('button', { name: 'Submit prompt' }).click();
    await editor.openTool('Layout');
    await expect(page.getByRole('button', { name: 'AI workflow validated', exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await aiTranslationActions.translateGeneratedTitle(editor, page);
    await aiGemmaProviderActions.remove(editor, page);
  },
};
