import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes model setup progress contracts in the browser runtime', async ({ page }) => {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();

  const result = await page.evaluate(async () => {
    const { progress } = (await import(
      '/editor/src/services/model-setup/progress.ts'
    )) as typeof import('../../../apps/editor/src/services/model-setup/progress');

    const progressEvents: Array<{ details?: unknown; progress: number }> = [];
    const monotonic = progress.createMonotonicProgressReporter((value, details) => {
      progressEvents.push({ details, progress: value });
    });
    monotonic(12.2);
    monotonic(8);

    const transformersProgress = progress.createTransformersProgressCallback((value, details) => {
      progressEvents.push({ details, progress: value });
    });
    transformersProgress({ file: 'a.bin', loaded: 25, name: 'model', status: 'progress', total: 100 });
    transformersProgress({ file: 'b.bin', loaded: 50, name: 'model', status: 'progress', total: 100 });
    transformersProgress({ loaded: 90, progress: 90, status: 'progress_total', total: 100 });
    transformersProgress({ progress: 10, status: 'progress' });
    monotonic(100);

    return {
      progressValues: progressEvents.map((event) => event.progress),
      remainingMs: progress.estimateRemainingMs({
        elapsedMs: 1000,
        loadedBytes: 25,
        totalBytes: 100,
      }),
    };
  });

  expect(result.remainingMs).toBe(3000);
  expect(result.progressValues.at(0)).toBe(12);
  expect(result.progressValues.at(-1)).toBe(100);
});
