import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';

export type RemoteMirrorShareLinks = {
  embedSrc: string;
  publicUrl: string;
};

export const remoteMirrorShareLinks = {
  async create(page: Page): Promise<RemoteMirrorShareLinks> {
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Copied')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Published share links')).toContainText('Public URL');
    await expect(page.getByRole('button', { name: 'Public view link', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Embed code', exact: true })).toBeEnabled();

    const publicUrl = await page.getByLabel('Published share links').getByRole('textbox').first().inputValue();
    expect(publicUrl).toContain('share=');
    expect(publicUrl).toContain('src=');

    const embedHtml = await page.getByLabel('Published share links').getByRole('textbox').nth(1).inputValue();
    const embedSrc = embedHtml.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    expect(embedSrc).toBeTruthy();

    return { embedSrc: embedSrc!, publicUrl };
  },
};
