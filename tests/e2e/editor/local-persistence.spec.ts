import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor local persistence journey', () => {
  test('copies a file-backed slide asset into another browser-private project', async ({
    context,
    page,
  }) => {
    await installFakeOpfs(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: getServer().baseURL,
    });
    await page.goto(getServer().baseURL);
    await page.evaluate(() => {
      const createdAt = '2026-08-12T12:00:00.000Z';
      const sourceProject = {
        id: 'source-project',
        name: 'Source Deck',
        createdAt,
        updatedAt: createdAt,
        assets: {
          'source-background': {
            id: 'source-background',
            type: 'image',
            name: 'Source background',
            mimeType: 'image/png',
            fileName: 'source-background.png',
            storage: 'file',
          },
        },
        elements: {},
        pages: [
          {
            id: 'source-page',
            name: 'Source Slide',
            width: 1920,
            height: 1080,
            background: {
              type: 'asset',
              assetId: 'source-background',
              colorFallback: '#050D10',
            },
            elementIds: [],
          },
        ],
      };
      const destinationProject = {
        id: 'destination-project',
        name: 'Destination Deck',
        createdAt,
        updatedAt: createdAt,
        assets: {},
        elements: {},
        pages: [
          {
            id: 'destination-page',
            name: 'Destination Slide',
            width: 1920,
            height: 1080,
            background: { type: 'color', color: '#050D10' },
            elementIds: [],
          },
        ],
      };
      const prefix = 'localstudio.e2e.opfs.file:projects/';
      window.localStorage.setItem('ew-canvas-ai.persistence-enabled', 'true');
      window.localStorage.setItem(
        `${prefix}Source%20Deck/project.json`,
        JSON.stringify(sourceProject),
      );
      window.localStorage.setItem(
        `${prefix}Source%20Deck/assets/source-background.png`,
        'source-background-bytes',
      );
      window.localStorage.setItem(
        `${prefix}Destination%20Deck/project.json`,
        JSON.stringify(destinationProject),
      );
    });

    const sourceUrl = new URL('/editor/', getServer().baseURL);
    sourceUrl.searchParams.set('project', 'Source Deck');
    await page.goto(sourceUrl.toString());
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();
    await page.getByRole('button', { name: 'Copy Source Slide to clipboard' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('"objectUrl":"data:');
    const clipboardPayload = await page.evaluate(() => navigator.clipboard.readText());

    const destinationPage = await context.newPage();
    await installFakeOpfs(destinationPage);
    const destinationUrl = new URL('/editor/', getServer().baseURL);
    destinationUrl.searchParams.set('project', 'Destination Deck');
    await destinationPage.goto(destinationUrl.toString());
    await expect(
      destinationPage.getByRole('button', { name: 'Browser storage enabled' }),
    ).toBeVisible();
    await destinationPage.evaluate((payload) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', payload);
      window.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          clipboardData,
        }),
      );
    }, clipboardPayload);

    await expect
      .poll(() =>
        destinationPage.evaluate(() => {
          const prefix = 'localstudio.e2e.opfs.file:projects/Destination%20Deck/';
          const storedProject = window.localStorage.getItem(`${prefix}project.json`);
          if (!storedProject) return undefined;
          const project = JSON.parse(storedProject) as {
            assets: Record<string, { fileName?: string; objectUrl?: string; storage?: string }>;
            pages: Array<{ background: { type: string; assetId?: string } }>;
          };
          const pastedBackground = project.pages[1]?.background;
          if (pastedBackground?.type !== 'asset' || !pastedBackground.assetId) return undefined;
          const asset = project.assets[pastedBackground.assetId];
          if (!asset?.fileName) return undefined;
          return {
            bytes: window.localStorage.getItem(`${prefix}assets/${asset.fileName}`),
            objectUrl: asset.objectUrl,
            pageCount: project.pages.length,
            storage: asset.storage,
          };
        }),
      )
      .toEqual({
        bytes: 'source-background-bytes',
        objectUrl: undefined,
        pageCount: 2,
        storage: 'file',
      });
  });

  test('keeps the plain editor route fresh and restores a named browser-private project', async ({
    page,
  }) => {
    await installFakeOpfs(page);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await editor.renameProject('E2E Persisted Deck');

    await page.getByRole('button', { name: 'Browser storage disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await page.goto(new URL('/editor/', getServer().baseURL).toString());
    await expect(
      page.getByRole('button', { name: 'Edit project name Untitled Project' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browser storage disabled' })).toBeVisible();

    const restoredProjectUrl = new URL('/editor/', getServer().baseURL);
    restoredProjectUrl.searchParams.set('project', 'E2E Persisted Deck');
    await page.goto(restoredProjectUrl.toString());
    await expect(
      page.getByRole('button', { name: 'Edit project name E2E Persisted Deck' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Browser storage enabled' })).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('complementary', { name: 'Version history' })).toBeVisible();
  });

  test('saves a named project into a picked local folder and keeps Save As usable', async ({
    page,
  }) => {
    await installFakeOpfs(page, { directoryPicker: true });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();

    await page.getByRole('button', { name: 'Persistence disabled' }).focus();
    await page.keyboard.press('Enter');
    const setupPanel = page.getByRole('dialog', { name: 'Save local project' });
    await expect(setupPanel).toBeVisible();
    await setupPanel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(setupPanel).toBeHidden();

    await page.getByRole('button', { name: 'Persistence disabled' }).focus();
    await page.keyboard.press('Enter');
    await expect(setupPanel).toBeVisible();
    await setupPanel.getByLabel('Project folder name').press('Escape');
    await expect(setupPanel).toBeHidden();

    await page.getByRole('button', { name: 'Persistence disabled' }).focus();
    await page.keyboard.press('Enter');
    const projectFolderNameInput = setupPanel.getByLabel('Project folder name');
    await projectFolderNameInput.fill('');
    await expect(setupPanel.getByRole('button', { name: 'Choose folder' })).toBeDisabled();
    await projectFolderNameInput.fill('E2E Folder Deck');
    await projectFolderNameInput.press('Enter');

    await expect(page.getByRole('button', { name: 'Persistence enabled' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Edit project name E2E Folder Deck' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Version history' })).toBeEnabled();

    await editor.renameProject('E2E Folder Deck Renamed');
    await editor.openMenu('File');
    await page.getByRole('menuitem', { name: 'Save As...' }).click();
    await expect(page.getByRole('button', { name: 'Persistence enabled' })).toBeVisible();

    const persistedKeys = await page.evaluate(() =>
      Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index),
      )
        .filter((key): key is string => Boolean(key))
        .filter((key) => key.includes('localstudio.e2e.opfs.file:')),
    );
    expect(persistedKeys).toEqual(
      expect.arrayContaining([
        expect.stringContaining('E2E Folder Deck Renamed/project.json'),
        expect.stringContaining('E2E Folder Deck Renamed/config/localstudio.json'),
      ]),
    );
  });
});
