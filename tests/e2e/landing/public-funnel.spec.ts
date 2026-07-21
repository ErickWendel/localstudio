import { LandingAppPage } from '../pages/landing-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { evaluatePublicFunnelLlmsContract } from './public-funnel-llms-contract-browser';

const getServer = withIsolatedDevServer(test);

test.describe('landing public funnel journey', () => {
  test('serves llms.txt as Markdown with a top-level heading', async ({ page }) => {
    await page.goto(new URL('/', getServer().baseURL).toString());
    const result = await page.evaluate(evaluatePublicFunnelLlmsContract);

    expect(result.ok).toBe(true);
    expect(result.contentType).toContain('text/plain');
    expect(result.text).toMatch(/^# LocalStudio\.dev\s*$/m);
    expect(result.text.trimStart()).toMatch(/^# /);
  });

  test('navigates the public funnel into editor and WebMCP routes', async ({ page }) => {
    const landing = new LandingAppPage(page, getServer().baseURL);
    await landing.gotoHome();

    await expect(page.getByRole('navigation', { name: 'Landing sections' })).toBeVisible();
    await expect(
      page.locator('.landing-header').getByRole('link', { name: 'LocalStudio.dev beta home' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Bring your own PPT' }).click();
    await expect(page.getByText('Import an existing .pptx file')).toBeVisible();
    await expect(page.getByLabel('Bring your own PPT workflow').locator('source')).toHaveAttribute(
      'src',
      '/demo-bring-your-ppt.mp4',
    );
    await expect(page.getByLabel('Bring your own PPT workflow')).toHaveJSProperty(
      'playbackRate',
      2,
    );
    await page.getByRole('tab', { name: 'Prompt-to-slide' }).click();
    await expect(page.getByText('A prompt becomes editable slide layers')).toBeVisible();
    await expect(page.getByLabel('Prompt-to-slide workflow').locator('source')).toHaveAttribute(
      'src',
      '/demo-prompt-to-slides.mp4',
    );
    await page.getByRole('tab', { name: 'Present with confidence' }).click();
    await expect(page.getByText('Move from editing to delivery')).toBeVisible();
    await expect(
      page.getByLabel('Present with confidence workflow').locator('source'),
    ).toHaveAttribute('src', '/demo-present-with-confidence.mp4');
    await page.getByRole('tab', { name: 'Share your presentation' }).click();
    await expect(page.getByText('Publish a portable share payload')).toBeVisible();
    await expect(page.getByLabel('Share presentation workflow').locator('source')).toHaveAttribute(
      'src',
      '/demo-share-presentation.mp4',
    );

    await page.getByRole('link', { name: 'Features' }).click();
    await expect(
      page.getByRole('heading', { name: 'Every AI action returns to the editor.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'A host page can drive the editor through browser tools.',
      }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Pricing' }).click();
    await expect(
      page.getByRole('heading', { name: 'Free forever locally. Cheap when convenience matters.' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Speaker', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keynote Speaker' })).toBeVisible();
    await page.getByLabel('Email').fill('speaker@example.com');
    await expect(page.locator('#mauticform_localstudiowaitlist')).toHaveAttribute(
      'action',
      'https://mautic.erickwendel.com.br/form/submit?formId=6',
    );
    await expect(page.getByLabel('Email')).toHaveAttribute('name', 'mauticform[email]');
    await expect(page.locator('#mauticform_localstudiowaitlist_id')).toHaveValue('6');
    await expect(page.locator('#mauticform_localstudiowaitlist_return')).toHaveAttribute(
      'name',
      'mauticform[return]',
    );
    await expect(page.locator('#mauticform_localstudiowaitlist_name')).toHaveValue(
      'localstudiowaitlist',
    );
    await expect(page.getByRole('button', { name: 'Join waitlist' })).toBeVisible();

    await expect(
      page.getByRole('link', { name: /Star LocalStudio.dev on GitHub/i }),
    ).toHaveAttribute('href', /github\.com\/ErickWendel\/localstudio/);

    await page.getByRole('link', { name: 'Open editor' }).first().click();
    await expect(page).toHaveURL(/\/editor\/$/);
    await expect(page.getByRole('heading', { name: 'LocalStudio.dev' })).toBeVisible();

    await page.goto(new URL('/', getServer().baseURL).toString());
    await page.getByRole('link', { name: 'Open WebMCP demo' }).click();
    await expect(page).toHaveURL(/\/editor\/webmcp$/);
    await expect(page.getByRole('heading', { name: /WebMCP showcase/i })).toBeVisible();
  });
});
