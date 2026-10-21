import { type Page } from '@playwright/test';

import { WebMcpPage } from '../pages/webmcp.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { specModelContextInitScript } from '../support/spec-model-context-init-script';
import { nativeModelContextBrowser } from './native-model-context-browser';

const getServer = withIsolatedDevServer(test);
const editorFrameTitle = 'LocalStudio editor WebMCP demo';

type NativeResult<T> = { data?: T; errorCode?: string; message?: string; ok: boolean };

// Playwright does not reliably run init scripts in the showcase's editor iframe on production
// builds, so its HTML also receives the runtime inline before any module script executes.
async function installSpecModelContext(page: Page) {
  await page.addInitScript(specModelContextInitScript);
  await page.route(
    (url) => url.pathname === '/editor/' && url.searchParams.get('webmcp') === '1',
    async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      await route.fulfill({
        response,
        body: html.replace(
          '<head>',
          `<head><script>(${String(specModelContextInitScript)})();</script>`,
        ),
      });
    },
  );
}

function enableFirstVisitTour(page: Page) {
  return page.addInitScript(() => {
    window.localStorage.setItem('localstudio.ai-workflow-tour.enabled', '1');
    window.localStorage.removeItem('localstudio.ai-workflow-tour.seen');
  });
}

function listNativeTools(page: Page) {
  return page.evaluate(nativeModelContextBrowser.listTools);
}

function executeNativeTool<T>(page: Page, name: string, input: Record<string, unknown>) {
  return page.evaluate(nativeModelContextBrowser.executeTool, { input, name }) as Promise<
    NativeResult<T>
  >;
}

function readRegistrationErrors(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __specModelContextRuntime?: { registrationErrors: string[] } })
        .__specModelContextRuntime?.registrationErrors ?? [],
  );
}

test.describe('native WebMCP model context', () => {
  test('lets an agent drive /editor/ through spec-shaped registration and execution', async ({
    page,
  }) => {
    await installSpecModelContext(page);
    await enableFirstVisitTour(page);
    await page.goto(new URL('/editor/', getServer().baseURL).toString());

    await expect
      .poll(async () => (await listNativeTools(page)).length, { timeout: 30_000 })
      .toBe(14);
    await expect(page.getByText('Open AI Tools', { exact: true })).toBeVisible();
    const tools = await listNativeTools(page);
    expect(
      tools.filter(({ annotations }) => annotations?.consequentialHint).map(({ name }) => name),
    ).toEqual([
      'create_presentation',
      'export_presentation',
      'import_powerpoint_from_url',
      'translate_deck_and_notes',
    ]);

    expect(
      await executeNativeTool(page, 'create_presentation', { name: 'Native Agent Deck' }),
    ).toMatchObject({ ok: true, data: { name: 'Native Agent Deck' } });
    const titleElement = {
      elementId: 'native-title',
      type: 'text',
      frame: { x: 160, y: 400, width: 1600, height: 200 },
      zIndex: 1,
      content: { text: 'Driven through document.modelContext' },
    };
    expect(
      await executeNativeTool(page, 'upsert_slide_content', {
        requestId: 'native-agent-title',
        slideNumber: 1,
        mode: 'replace',
        elements: [titleElement],
      }),
    ).toMatchObject({ ok: false, message: 'input.elements[0].style is required.' });
    expect(
      await executeNativeTool(page, 'upsert_slide_content', {
        requestId: 'native-agent-title',
        slideNumber: 1,
        mode: 'replace',
        elements: [
          {
            ...titleElement,
            style: { fontFamily: 'Arial', fontSize: 72, fontWeight: 700, color: '#FFFFFF' },
          },
        ],
      }),
    ).toMatchObject({ ok: true, data: { createdElements: 1 } });
    const state = await executeNativeTool<{
      name: string;
      slides: Array<{ elements: Array<{ id: string; text?: string }> }>;
    }>(page, 'get_presentation_state', { detail: 'elements', slideNumbers: [1] });
    expect(state.data).toMatchObject({
      name: 'Native Agent Deck',
      slides: [
        { elements: [{ id: 'native-title', text: 'Driven through document.modelContext' }] },
      ],
    });
    expect(await executeNativeTool(page, 'create_presentation', { name: 7 })).toMatchObject({
      ok: false,
      errorCode: 'invalid_input',
    });
    expect(await readRegistrationErrors(page)).toEqual([]);
  });

  test('discovers late editor registrations and imports the bundled sample deck', async ({
    page,
  }) => {
    await installSpecModelContext(page);
    await enableFirstVisitTour(page);
    const webmcp = new WebMcpPage(page, getServer().baseURL);
    await webmcp.gotoShowcase();

    await page.getByRole('button', { name: 'Discover tools' }).click();
    await expect(page.getByText('Discovered 14 tools through WebMCP.')).toBeVisible({
      timeout: 20_000,
    });
    const editorFrame = page.frameLocator(`iframe[title="${editorFrameTitle}"]`);
    await expect(editorFrame.getByText('Open AI Tools', { exact: true })).toHaveCount(0);

    const workflow = page.locator('[aria-label="Demo workflow"]');
    const importAction = workflow.getByRole('button', {
      name: 'Import PowerPoint from URL',
      exact: true,
    });
    await importAction.click();
    await expect(page.getByLabel('Import PowerPoint from URL command input')).toHaveValue(
      /\/editor\/samples\/webmcp-showcase-sample\.pptx/,
    );
    await page.getByRole('button', { name: 'Send Import PowerPoint from URL' }).click();
    await expect(importAction.locator('..').getByRole('status')).toHaveText(
      'Import PowerPoint from URL completed.',
      { timeout: 30_000 },
    );

    const stateAction = workflow.getByRole('button', {
      name: 'Inspect presentation state',
      exact: true,
    });
    const stateStep = stateAction.locator('..');
    await stateAction.click();
    await page.getByRole('button', { name: 'Send Inspect presentation state' }).click();
    await expect(stateStep.getByRole('status')).toHaveText('Inspect presentation state completed.');
    await expect(stateStep).toContainText('"pageCount": 4');
    await expect(stateStep).toContainText('Presentations become agent-native');
    expect(await readRegistrationErrors(page)).toEqual([]);
  });
});
