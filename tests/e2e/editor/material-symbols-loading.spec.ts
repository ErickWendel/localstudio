import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test('keeps icon ligature text hidden while the Material Symbols font is loading', async ({
  page,
}) => {
  let releaseFontRequest = () => undefined;
  const fontRequestBlocked = new Promise<void>((resolve) => {
    releaseFontRequest = resolve;
  });
  let markFontRequested = () => undefined;
  const fontRequested = new Promise<void>((resolve) => {
    markFontRequested = resolve;
  });

  await page.route('https://fonts.gstatic.com/s/materialsymbolsoutlined/**', async (route) => {
    markFontRequested();
    await fontRequestBlocked;
    await route.abort();
  });

  const editor = new EditorAppPage(page, getServer().baseURL);
  await editor.gotoNewProject();
  await fontRequested;

  const iconLigatures = page.locator('.material-symbols-outlined');
  try {
    await expect(iconLigatures.first()).toBeAttached();
    await expect(iconLigatures.first()).toHaveCSS('visibility', 'hidden');
  } finally {
    releaseFontRequest();
  }

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          [...document.fonts].find((font) => font.family === 'Material Symbols Outlined')?.status,
      ),
    )
    .toBe('error');
  await expect(page.locator('html')).not.toHaveClass(/material-symbols-ready/);
  await expect(iconLigatures.first()).toHaveCSS('visibility', 'hidden');
});
