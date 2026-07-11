import { pptxAnimationMediaExportJourney } from './pptx-animation-media-export-journey';
import { test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor PowerPoint animation and media export journey', () => {
  test('exports transition timing, object animation timing, and embedded video package parts', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await pptxAnimationMediaExportJourney.runAnimationMediaExport(page, getServer().baseURL);
  });

  test('exports styled shape geometry and imported image media to PowerPoint', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await pptxAnimationMediaExportJourney.runShapeImageExport(page, getServer().baseURL, testInfo);
  });
});
