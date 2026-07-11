import { commandPageLayoutContractPage } from './command-page-layout-contract-page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor page theme and layout command contracts', () => {
  test('executes page, theme, and layout commands in the browser runtime', async ({ page }) => {
    const result = await commandPageLayoutContractPage.run(page, getServer().baseURL);

    expect(result).toEqual({
      layoutId: 'layout-title',
      pageCount: 1,
      themeId: 'theme-contrast',
    });
  });
});
