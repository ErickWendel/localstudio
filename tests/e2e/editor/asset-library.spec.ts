import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor asset library journey', () => {
  test('opens and deletes unused media, recordings, and transcripts', async ({ page }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoAssetFixtures();
    await editor.openTool('Assets');

    const mediaSection = page.getByRole('button', { name: /^Media/ });
    const recordingsSection = page.getByRole('button', { name: /^Recordings/ });
    await expect(mediaSection).toHaveAttribute('aria-expanded', 'false');
    await expect(recordingsSection).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('Unused fixture.png')).toBeHidden();
    await expect(page.getByText('Launch talk')).toBeHidden();

    await mediaSection.click();
    const unusedLink = page.getByRole('link', { name: 'Open Unused fixture.png in a new tab' });
    await expect(unusedLink).toHaveAttribute('target', '_blank');
    await expect(unusedLink).toHaveAttribute('rel', /noopener/);
    await expect(page.getByRole('button', { name: 'Remove Used fixture.png' })).toBeDisabled();

    await page.getByRole('button', { name: 'Remove Unused fixture.png' }).click();
    await expect(page.getByText('Unused fixture.png')).toBeHidden();
    await expect(page.getByText('Used fixture.png')).toBeVisible();

    await recordingsSection.click();
    await page.getByRole('button', { name: 'Remove Rehearsal recording and transcript' }).click();
    await expect(page.getByText('Rehearsal')).toBeHidden();
    await page.getByRole('button', { name: 'Launch talk, 1:05' }).click();
    const recordingLink = page.getByRole('link', { name: 'Open Launch talk recording in a new tab' });
    await expect(recordingLink).toHaveAttribute('target', '_blank');
    await expect(page.getByText('1:05')).toBeVisible();
    await expect(page.getByText('launch.webm')).toBeHidden();

    const transcriptPopup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Open Launch talk transcript in a new tab' }).click();
    const popup = await transcriptPopup;
    await expect(popup).toHaveURL(/^blob:/);
    await popup.close();

    await page.getByRole('button', { name: 'Remove Launch talk transcript' }).click();
    await expect(page.getByRole('button', { name: 'Remove Launch talk transcript' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Open Launch talk recording in a new tab' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove Launch talk recording', exact: true }).click();
    await expect(page.getByText('Launch talk')).toBeHidden();
    await expect(page.getByText('No recordings yet.')).toBeVisible();
  });
});
