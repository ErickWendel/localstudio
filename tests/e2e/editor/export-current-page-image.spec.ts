import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { imageExportArchiveAssertions } from './image-export-archive-assertions';
import { imageExportDownloadReader } from './image-export-download-reader';
import { imageExportJourneyPage } from './image-export-journey-page';

const getServer = withIsolatedDevServer(test);

test.describe('editor current page image export journey', () => {
  test('downloads the active page as a PNG from the share panel', async ({ page }) => {
    const download = await imageExportJourneyPage.downloadActivePagePng(
      page,
      getServer().baseURL,
    );
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    const contents = await imageExportDownloadReader.readBytes(download);
    expect(contents.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  test('downloads all slides as an image ZIP from the File menu', async ({ page }) => {
    const download = await imageExportJourneyPage.downloadAllSlidesZip(page, getServer().baseURL);
    expect(download.suggestedFilename()).toMatch(/-images\.zip$/);
    const contents = await imageExportDownloadReader.readBytes(download);
    expect(contents.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  test('exports readable final slide states from the local PPTX sample when animation images are disabled', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const download = await imageExportJourneyPage.downloadSampleFinalSlideStatesZip(
      page,
      getServer().baseURL,
    );
    const archiveFiles = await imageExportDownloadReader.readZip(download);
    imageExportArchiveAssertions.expectReadableSampleFinalSlides(archiveFiles);
  });
});
