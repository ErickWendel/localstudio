import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { EditorAppPage } from '../pages/editor-app.page';
import { installPptxFilePicker } from '../support/pptx-file-picker';
import { createInheritedThemeFontPptxFixture } from '../support/test-assets';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);
const SAMPLE_PROJECT_NAME = 'fullstack-monitoring-jsnation-11062026';

async function createSamplePptxFixture(testInfo: TestInfo) {
  const fixtureDir = resolve(process.cwd(), 'tests/e2e/fixtures/pptx');
  const partNames = (await readdir(fixtureDir))
    .filter((name) => name.startsWith(`${SAMPLE_PROJECT_NAME}.pptx.part-`))
    .sort();
  const chunks = await Promise.all(partNames.map((name) => readFile(resolve(fixtureDir, name))));
  const outputPath = testInfo.outputPath(`${SAMPLE_PROJECT_NAME}.pptx`);
  await writeFile(outputPath, Buffer.concat(chunks));
  return outputPath;
}

async function blockGoogleFontDownloads(page: Page) {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
}

async function expectMissingFontWarning(page: Page) {
  const warningDialog = page.getByRole('dialog', { name: 'PowerPoint font warnings' });
  await expect(warningDialog).toBeVisible({ timeout: 90_000 });
  await expect(warningDialog).toContainText(
    /This PowerPoint presentation may look different\./,
  );
  await expect(warningDialog).toContainText('Adobe 고딕 Std B');
  await expect(
    warningDialog.getByRole('button', { name: 'Replace Fonts' }),
  ).toBeVisible();
}

test.describe('editor PowerPoint sample font warnings', () => {
  test('shows missing font warnings when importing the local sample deck route', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await blockGoogleFontDownloads(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&importPptxSample=1');

    await expect(
      page.getByRole('button', {
        name: 'Edit project name fullstack-monitoring-jsnation-11062026',
      }),
    ).toBeVisible({ timeout: 90_000 });

    await expectMissingFontWarning(page);
  });

  test('shows missing font warnings when importing the sample deck from File > Import', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', {
        configurable: true,
        value: undefined,
      });
    });
    await blockGoogleFontDownloads(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(await createSamplePptxFixture(testInfo));

    await expect(
      page.getByRole('button', {
        name: 'Edit project name fullstack-monitoring-jsnation-11062026',
      }),
    ).toBeVisible({ timeout: 90_000 });
    await expectMissingFontWarning(page);
  });

  test('shows missing font warnings for inherited theme fonts from File > Import', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await blockGoogleFontDownloads(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await installPptxFilePicker(page, await createInheritedThemeFontPptxFixture(testInfo));
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Import' }).click();
    await page.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }).click();

    await expect(
      page.getByRole('button', {
        name: 'Edit project name localstudio-e2e-inherited-theme-font',
      }),
    ).toBeVisible({ timeout: 60_000 });
    const warningDialog = page.getByRole('dialog', { name: 'PowerPoint font warnings' });
    await expect(warningDialog).toBeVisible({ timeout: 60_000 });
    await expect(warningDialog).toContainText('The font Tenorite is missing.');
  });
});
