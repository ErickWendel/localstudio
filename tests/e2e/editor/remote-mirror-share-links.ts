import { type Page } from '@playwright/test';

import { expect } from '../support/journey-test';
import { copiedShareUrlStorageKey } from './remote-mirror-share-setup';

export type RemoteMirrorShareLinks = {
  embedSrc: string;
  publicUrl: string;
};

export const remoteMirrorShareLinks = {
  async create(page: Page): Promise<RemoteMirrorShareLinks> {
    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();

    const publishedShareLinks = page.getByLabel('Published share links');
    await expect(publishedShareLinks).toContainText('Public URL', { timeout: 15_000 });
    const publicUrl = await publishedShareLinks.getByRole('textbox').first().inputValue();

    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) => window.localStorage.getItem(storageKey),
          copiedShareUrlStorageKey,
        ),
      )
      .toBe(publicUrl);
    await expect(page.getByRole('button', { name: 'Public view link', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Embed code', exact: true })).toBeEnabled();

    expect(publicUrl).toContain('share=');
    expect(publicUrl).toContain('src=');

    const embedHtml = await publishedShareLinks.getByRole('textbox').nth(1).inputValue();
    const embedSrc = embedHtml.match(/src="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
    expect(embedSrc).toBeTruthy();

    return { embedSrc: embedSrc!, publicUrl };
  },
};
