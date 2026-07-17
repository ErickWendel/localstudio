import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { remoteMirrorShareRoutes } from './remote-mirror-share-routes';

const getServer = withIsolatedDevServer(test);

test.describe('local font mirror settings', () => {
  test('routes public share setup into mirror settings with local font mirroring guidance', async ({
    context,
    page,
  }) => {
    await context.grantPermissions(['clipboard-write'], { origin: getServer().baseURL });
    await installFakeOpfs(page, { directoryPicker: true });
    const storedObjects = await remoteMirrorShareRoutes.install(context);

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.gotoNewProject();
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      window.localStorage.setItem(
        'localstudio.e2e.opfs.file:localstudio-e2e-root/AcmeSans-Regular.woff2',
        'fake-font-file',
      );
    });

    await expect(page.getByRole('button', { name: 'Translation path options' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const localSave = page.getByRole('dialog', { name: 'Save local project' });
    await expect(localSave).toBeVisible();
    await localSave.getByRole('button', { name: 'Choose folder' }).click();

    const mirrorSettings = page.getByRole('dialog', { name: 'Mirror settings' });
    await expect(mirrorSettings).toBeVisible();
    await expect(mirrorSettings.getByRole('heading', { name: 'Mirror my local fonts' })).toBeVisible();
    await expect(mirrorSettings).toContainText('Public viewers need those font files mirrored to storage');
    await expect(mirrorSettings).toContainText(/Usual font folder for this system:/);
    const localFontMirroring = mirrorSettings.getByRole('region', { name: 'Local font mirroring' });
    await expect(localFontMirroring.getByRole('checkbox')).toBeVisible();
    await expect(localFontMirroring.getByRole('button', { name: 'Choose font folder' })).toBeVisible();
    await expect(localFontMirroring.getByRole('button', { name: 'Choose font files' })).toHaveCount(0);

    await localFontMirroring.getByRole('checkbox').focus();
    await page.keyboard.press('Space');
    await expect(localFontMirroring.getByRole('button', { name: /Folder: localstudio-e2e-root/ })).toBeVisible();
    await page.mouse.click(760, 120);
    await expect(mirrorSettings).toBeHidden();

    await editor.openTool('Text');
    await page.getByRole('button', { name: 'Add a text box' }).click();
    await editor.openTool('Design');
    const fontSelect = page.getByLabel('Selected text font', { exact: true });
    await page.getByLabel('Selected text font', { exact: true }).click();
    await page.getByLabel('Search downloadable fonts').fill('Acme');
    const localFontResult = page.getByRole('button', { name: 'Add Acme Sans from local fonts' });
    await expect(localFontResult).toBeVisible();
    await expect(localFontResult.locator('.ew-ellipsis')).toHaveCSS('font-family', /Acme Sans/);
    await localFontResult.click();
    await expect(page.getByRole('status')).toContainText('Acme Sans added to mirrored fonts');
    await expect(fontSelect).toContainText('Acme Sans');

    await page
      .getByRole('contentinfo', { name: 'Editor footer controls' })
      .getByRole('button', { name: 'Mirror settings' })
      .click();
    await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Mirror settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeVisible();
    await page.getByRole('button', { name: 'Enable mirroring' }).click();
    await expect(page.getByText('S3-compatible connection is ready.')).toBeVisible();
    await page.getByRole('button', { name: 'Save settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Mirror settings' })).toBeHidden();

    await page.getByRole('button', { name: 'Share' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByText('Copied')).toBeVisible({ timeout: 15_000 });

    const storedKeys = Array.from(storedObjects.keys());
    const mirroredFontKey = storedKeys.find(
      (key) => key.includes('/public-shares/') && key.includes('/fonts/font-acme-sans-'),
    );
    expect(mirroredFontKey).toMatch(/public-shares\/.+\/fonts\/font-acme-sans-\d+-acmesans-regular-woff2\.woff2$/);
    expect(storedKeys.some((key) => key.includes('/fonts/uploaded-font-'))).toBe(false);

    const shareKey = storedKeys.find((key) => key.endsWith('/share.json'));
    expect(shareKey).toBeTruthy();
    const sharePayload = JSON.parse(storedObjects.get(shareKey!)!.body.toString()) as {
      project: { fonts?: Record<string, { fileName: string; objectUrl: string; storage: string }> };
    };
    const mirroredFont = Object.values(sharePayload.project.fonts ?? {}).find((font) =>
      font.fileName.startsWith('font-acme-sans-'),
    );
    expect(mirroredFont).toMatchObject({
      storage: 'remote',
    });
    expect(mirroredFont?.objectUrl).toContain('/fonts/font-acme-sans-');
    expect(mirroredFont?.objectUrl).not.toContain('/fonts/uploaded-font-');
  });
});
