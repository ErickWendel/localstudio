import { EditorAppPage } from '../pages/editor-app.page';
import { getBigBuckBunnyMp4Fixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor video media controls journey', () => {
  test('imports a local video and edits playback, trim, repeat, and start controls', async ({
    page,
  }) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await editor.openTool('Assets');
    await page.getByLabel('Import media file').setInputFiles(getBigBuckBunnyMp4Fixture());
    await expect(page.getByText('Big_Buck_Bunny_360_10s_1MB.mp4')).toBeVisible();

    await editor.openTool('Layout');
    await page.getByRole('button', { name: 'Big_Buck_Bunny_360_10s_1MB.mp4', exact: true }).click();

    await editor.openTool('Design');
    const movieTabs = page.getByRole('tablist', { name: 'Movie inspector sections' });
    await movieTabs.getByRole('tab', { name: 'Movie' }).click();
    await expect(page.getByRole('button', { name: 'Pause movie' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause movie' }).click();
    await expect(page.getByRole('button', { name: 'Play movie' })).toBeVisible();
    await page.getByRole('button', { name: 'Play movie' }).click();
    await expect(page.getByRole('button', { name: 'Pause movie' })).toBeVisible();

    await page.getByLabel('Selected video volume').fill('25');
    await expect(page.getByLabel('Selected video volume')).toHaveValue('25');
    await page.getByLabel('Selected video trim start').fill('0.2');
    await expect(page.getByLabel('Selected video trim start')).toHaveValue('0.2');
    await page.getByLabel('Selected video trim end').fill('0.8');
    await expect(page.getByLabel('Selected video trim end')).toHaveValue('0.8');
    await page.getByLabel('Selected video poster frame').fill('0.4');
    await expect(page.getByLabel('Selected video poster frame')).toHaveValue('0.4');

    await page.getByLabel('Selected video repeat mode').selectOption('loop-back-and-forth');
    await expect(page.getByLabel('Selected video repeat mode')).toHaveValue('loop-back-and-forth');
    await page.getByLabel('Selected video start').selectOption('on-click');
    await expect(page.getByLabel('Selected video start')).toHaveValue('on-click');
    await page.getByLabel('Play movie across slides').check();
    await expect(page.getByLabel('Play movie across slides')).toBeChecked();

    await movieTabs.getByRole('tab', { name: 'Arrange' }).click();
    await page.getByLabel('Selected element width').fill('480');
    await expect(page.getByLabel('Selected element width')).toHaveValue('480');
  });
});
