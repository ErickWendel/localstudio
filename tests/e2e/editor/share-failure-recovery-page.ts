import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect } from '../support/journey-test';
import { shareFailureMirrorRoute } from './share-failure-mirror-route';

export const shareFailureRecoveryPage = {
  async recoverMirrorAndCreatePublicLink(page: Page, baseURL: string) {
    await installFakeOpfs(page);

    const mirrorRoute = await shareFailureMirrorRoute.install(page);
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Share Failure');
    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page
      .getByRole('dialog', { name: 'Settings' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page.getByRole('button', { name: 'Enable mirroring' }).click();
    await expect(page.getByText(/Could not list MinIO mirrors \(503\)/)).toBeVisible();

    mirrorRoute.recoverConnection();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(
      page.getByText(/S3-compatible connection is ready|Connection is ready/),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeHidden();

    await expect(
      page.getByRole('button', { name: /Mirror up to date|Mirror syncing|Mirror ready/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Copied')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Published share links')).toContainText('Public URL');
    await expect(page.getByText('Clipboard write denied by test browser')).toBeHidden();
  },
};
