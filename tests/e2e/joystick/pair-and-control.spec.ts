import { JoystickAppPage } from '../pages/joystick-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('joystick pair and control journey', () => {
  test('shows pairing and disabled controls before a presenter is connected', async ({ page }) => {
    const joystick = new JoystickAppPage(page, getServer().baseURL);
    await joystick.gotoRemote();

    await expect(page.getByLabel('Slide position')).toContainText('-- / --');
    await expect(page.getByLabel('Presentation timer')).toContainText('00:00');
    await expect(page.getByRole('textbox', { name: 'Remote link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause timer' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Reset timer' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Show slide navigation' })).toBeDisabled();

    await page.getByRole('textbox', { name: 'Remote link' }).fill('invalid-presenter-peer');
    await page.getByRole('button', { name: 'Join' }).click();
    await expect(page.getByText(/Looking for the presenter session|Could not connect/)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('main', { name: 'Presentation remote control' })).toBeVisible();
  });
});
