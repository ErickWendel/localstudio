import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor bundled runtime diagnostics coverage', () => {
  test('exercises bundled editor services through an explicit diagnostics route', async ({ page }) => {
    const url = new URL('/editor/', getServer().baseURL);
    url.searchParams.set('e2eCoverageDiagnostics', '1');

    await page.goto(url.toString());
    await expect(page.getByRole('main', { name: 'E2E coverage diagnostics' })).toBeVisible();

    await page.getByRole('searchbox', { name: 'Search Google Fonts for replacement' }).fill('rob');
    await page.getByRole('button', { name: /Roboto/ }).click();
    await page.getByRole('button', { name: 'Replace Fonts' }).click();

    await expect(page.getByLabel('Editor view model diagnostics')).toContainText('pageCount');
    await page.getByRole('button', { name: '2 fonts available' }).click();
    await expect(page.getByRole('option', { name: /Inter/ })).toBeVisible();
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText('S3-compatible connection is ready.')).toBeVisible();
    await page.getByRole('button', { name: 'Close mirror settings' }).click();
    await page.getByRole('button', { name: 'Import Remote A' }).click({ force: true });
    await page.getByRole('button', { name: 'Delete Remote A from remote' }).click({ force: true });
    await expect(page.getByRole('alertdialog', { name: 'Delete remote project' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click({ force: true });
    await page.getByRole('button', { name: 'Delete Remote B from remote' }).click({ force: true });
    await page.getByRole('button', { name: 'Delete remote project' }).click({ force: true });
    const sharePanels = page.getByRole('complementary', { name: 'Share design panel' });
    await sharePanels
      .first()
      .getByRole('button', { name: 'Configure mirror storage' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await sharePanels.first().getByRole('combobox').selectOption('recording-b');
    await sharePanels
      .first()
      .getByRole('button', { name: 'Copy link' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await sharePanels
      .first()
      .getByRole('button', { name: 'Download' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await sharePanels
      .first()
      .getByRole('button', { name: 'Present' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await sharePanels
      .first()
      .getByRole('button', { name: 'Embed code' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await sharePanels
      .nth(1)
      .getByRole('button', { name: 'Copy link' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(sharePanels.nth(1).getByText('Share failed').nth(1)).toBeVisible();
    await page.getByRole('textbox', { name: 'Speaker notes' }).fill('Updated diagnostics notes');
    await page.getByRole('separator', { name: 'Resize speaker notes width' }).press('ArrowRight');
    await page.getByRole('separator', { name: 'Resize speaker notes width' }).press('Home');
    await page.getByRole('separator', { name: 'Resize speaker notes height' }).press('ArrowUp');
    await page.getByRole('separator', { name: 'Resize speaker notes height' }).press('End');
    await page
      .getByRole('button', { name: 'Close notes panel' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await page
      .getByRole('button', { name: 'Hide diagnostics panels' })
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(page.getByRole('main', { name: 'Public presentation' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Show captions' }).click();
    const playbackRegion = page.getByRole('region', { name: 'Presentation playback' });
    await playbackRegion.getByRole('button', { name: /Jump to slide 2/ }).click();
    await playbackRegion.getByRole('button', { name: /Jump to slide 2: Public Slide 2/ }).hover();
    await playbackRegion.getByRole('button', { name: 'Open transcript chat' }).click();
    await expect(page.getByRole('complementary', { name: 'Transcript chat' })).toBeVisible();
    await page.getByRole('button', { name: /Open slide 2: Public Slide 2/ }).click();
    await page.getByRole('button', { name: /Play slide 2/ }).click();
    await page.getByRole('slider', { name: 'Seek podcast audio' }).fill('1');
    await page.getByRole('button', { name: /Play transcript segment for slide 1/ }).click();
    await page.getByRole('button', { name: 'What was explained on the current slide?' }).click();
    await expect(page.getByText('Building transcript answer...')).toBeVisible();
    await page.getByRole('button', { name: 'Stop transcript answer' }).click();
    const noRecordingViewer = page.getByRole('main', { name: 'Public presentation' }).nth(1);
    await expect(noRecordingViewer).toBeVisible();
    await noRecordingViewer.getByRole('button', { name: /Jump to slide 2: Public Slide 2/ }).click();
    await expect(noRecordingViewer.getByText('2 / 3')).toBeVisible();
    await noRecordingViewer.getByRole('button', { name: 'Previous slide' }).click();
    await noRecordingViewer.getByRole('button', { name: 'Open slide list' }).click();
    const slideList = page.getByRole('complementary', { name: 'Slide list' });
    await expect(slideList).toBeVisible();
    await slideList.getByRole('button', { name: /Open slide 2: Public Slide 2/ }).click();
    await expect(noRecordingViewer.getByText('2 / 3')).toBeVisible();
    await expect(page.getByText('Deck not found')).toBeVisible();
    await expect(page.getByText('Deck could not be loaded')).toBeVisible();
    await expect(page.getByLabel('Sequential view model diagnostics')).toContainText('"pages"', {
      timeout: 15_000,
    });
    await expect(page.getByLabel('Persistence view model diagnostics')).toContainText('savedCalls', {
      timeout: 15_000,
    });
    await expect(page.getByLabel('Editor shell diagnostics')).toContainText('share-present');

    await expect(page.getByLabel('Diagnostics result')).toContainText('"generated":"nested assistant text"');
    await expect(page.getByLabel('Diagnostics result')).toContainText('"selectedRecordings":["second"]');
  });
});
