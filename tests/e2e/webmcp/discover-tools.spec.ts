import { readFile } from 'node:fs/promises';
import { WebMcpPage } from '../pages/webmcp.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { mockAiBrowserApiInitScript } from '../support/mock-ai-browser-api-init-script';
import { createTinyPptxFixture } from '../support/test-assets';

const getServer = withIsolatedDevServer(test);
const showcaseCards = [
  ['create_presentation', 'Create presentation'],
  ['get_presentation_state', 'Inspect presentation state'],
  ['import_powerpoint_from_url', 'Import PowerPoint from URL'],
  ['translate_deck_and_notes', 'Translate deck and notes'],
  ['generate_deck_detailed_description', 'Generate detailed descriptions'],
  ['list_authoring_catalog', 'List authoring catalog'],
  ['upsert_slide_content', 'Upsert slide content'],
  ['generate_image', 'Generate image'],
  ['get_slide_preview', 'Focus slide preview'],
  ['get_ai_model_status', 'Inspect AI model status'],
  ['prepare_ai_models', 'Prepare AI models'],
  ['search_media', 'Search stock media'],
  ['export_presentation', 'Export presentation'],
  ['get_operation_status', 'Get operation status'],
] as const;
const showcaseActionCards = showcaseCards.filter(
  ([name]) => name !== 'generate_deck_detailed_description',
);
const showcaseSections = [
  ['Dependencies', ['Prepare AI models', 'Inspect AI model status']],
  [
    'Create and refine',
    [
      'Create presentation',
      'Import PowerPoint from URL',
      'Translate deck and notes',
      'Upsert slide content',
      'Generate image',
    ],
  ],
  ['Assets and styling', ['List authoring catalog', 'Search stock media']],
  ['Review', ['Focus slide preview']],
  ['Export', ['Export presentation']],
  ['Context and progress', ['Inspect presentation state', 'Get operation status']],
] as const;

test.describe('WebMCP discover tools journey', () => {
  test('reveals discovered tools and waits for an imported deck to open', async ({
    context,
    page,
  }, testInfo) => {
    const pptx = await readFile(await createTinyPptxFixture(testInfo));
    let releaseImport!: () => void;
    let markImportRequested!: () => void;
    const importRelease = new Promise<void>((resolve) => {
      releaseImport = resolve;
    });
    const importRequested = new Promise<void>((resolve) => {
      markImportRequested = resolve;
    });
    await context.route('http://localhost:9100/showcase.pptx', async (route) => {
      markImportRequested();
      await importRelease;
      await route.fulfill({
        body: pptx,
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        headers: { 'access-control-allow-origin': '*' },
      });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        value: {
          executeTool: () => {
            throw new Error('The native runtime must not execute bridge-discovered tools.');
          },
          getTools: () => Promise.resolve([]),
        },
      });
    });
    await page.addInitScript(mockAiBrowserApiInitScript, { slideElements: [], slideTasks: '' });
    const webmcp = new WebMcpPage(page, getServer().baseURL);
    await webmcp.gotoShowcase();

    await expect(page.getByRole('region', { name: 'WebMCP control plane' })).toBeVisible();
    await expect(page.getByLabel('Discovered tools')).toContainText('No tools discovered');
    await expect(page.getByLabel('Demo workflow')).toHaveCount(0);
    await expect(
      page
        .frameLocator('iframe[title="LocalStudio editor WebMCP demo"]')
        .getByRole('heading', { name: 'LocalStudio.dev' }),
    ).toBeVisible();
    const editorFrameGeometry = await page.evaluate(() => {
      const frame = document.querySelector<HTMLElement>('.webmcp-editor-frame');
      const iframe = frame?.querySelector('iframe');
      if (!frame || !iframe) throw new Error('WebMCP editor frame is missing.');
      const frameBounds = frame.getBoundingClientRect();
      const iframeBounds = iframe.getBoundingClientRect();
      return {
        frameHeight: frameBounds.height,
        frameWidth: frameBounds.width,
        iframeHeight: iframeBounds.height,
        iframeWidth: iframeBounds.width,
      };
    });
    expect(editorFrameGeometry.iframeWidth).toBeGreaterThan(
      editorFrameGeometry.frameWidth - 40,
    );
    expect(editorFrameGeometry.iframeHeight).toBeGreaterThan(
      editorFrameGeometry.frameHeight - 40,
    );
    await page.getByRole('button', { name: 'Discover tools' }).click();
    await expect(
      page.getByText('Discovered 14 tools through the local demo bridge.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'create_presentation' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'import_powerpoint_from_disk' })).toHaveCount(0);
    const workflow = page.locator('[aria-label="Demo workflow"]');
    await expect(workflow.getByRole('button')).toHaveCount(13);
    for (const [, label] of showcaseActionCards) {
      await expect(workflow.getByRole('button', { name: label })).toBeVisible();
    }
    await expect(
      workflow.getByRole('button', { name: 'Generate detailed descriptions' }),
    ).toHaveCount(0);
    for (const [sectionName, actionNames] of showcaseSections) {
      const section = workflow.getByRole('region', { name: sectionName });
      await expect(section).toBeVisible();
      await expect(section.getByRole('button')).toHaveCount(actionNames.length);
      for (const actionName of actionNames) {
        await expect(section.getByRole('button', { name: actionName })).toBeVisible();
      }
    }
    const scrollMetrics = await page.evaluate(() => {
      const controlPlane = document.querySelector<HTMLElement>('.webmcp-control-plane');
      if (!controlPlane) throw new Error('WebMCP control plane is missing.');
      return {
        controlOverflow: getComputedStyle(controlPlane).overflowY,
        controlScrollable: controlPlane.scrollHeight > controlPlane.clientHeight,
        pageScrollable: document.documentElement.scrollHeight > window.innerHeight,
      };
    });
    expect(scrollMetrics).toEqual({
      controlOverflow: 'auto',
      controlScrollable: true,
      pageScrollable: false,
    });
    await workflow.getByRole('region', { name: 'Context and progress' }).scrollIntoViewIfNeeded();
    await expect(workflow.getByRole('region', { name: 'Context and progress' })).toBeInViewport();
    await page.getByRole('button', { name: 'Import PowerPoint from URL' }).click();
    const importInput = page.getByLabel('Import PowerPoint from URL command input');
    await expect(importInput).toHaveValue(
      /https:\/\/localstudio\.erickwendel\.com\.br\/localstudio\/public\/web-ai-beyond-chat-renderatl-14082026%20%282%29\.pptx/,
    );
    await importInput.fill('{"url":"http://localhost:9100/showcase.pptx"}');
    await page.getByRole('button', { name: 'Send Import PowerPoint from URL' }).click();
    await importRequested;
    const importAction = workflow.getByRole('button', {
      name: 'Import PowerPoint from URL',
      exact: true,
    });
    const importStep = importAction.locator('..');
    await expect(
      importStep.getByRole('status').getByText(/Import PowerPoint from URL (started|is running)/),
    ).toBeVisible();
    await expect(
      page
        .frameLocator('iframe[title="LocalStudio editor WebMCP demo"]')
        .getByRole('progressbar', { name: 'PowerPoint import progress' }),
    ).toBeVisible();
    releaseImport();
    await expect(importStep.getByRole('status')).toHaveText(
      'Import PowerPoint from URL completed.',
    );
    const editorFrame = page.frameLocator('iframe[title="LocalStudio editor WebMCP demo"]');
    const renderedBeforeTranslation = await editorFrame
      .getByLabel('Slide canvas', { exact: true })
      .locator('canvas')
      .evaluateAll((canvases) =>
        canvases.map((canvas) => (canvas as HTMLCanvasElement).toDataURL('image/png')),
      );
    await workflow.getByRole('button', { name: 'Translate deck and notes' }).click();
    await page.getByRole('button', { name: 'Send Translate deck and notes' }).click();
    await expect(
      workflow
        .getByRole('button', { name: 'Translate deck and notes' })
        .locator('..')
        .getByRole('status'),
    ).toHaveText('Translate deck and notes completed.');
    const renderedAfterTranslation = await editorFrame
      .getByLabel('Slide canvas', { exact: true })
      .locator('canvas')
      .evaluateAll((canvases) =>
        canvases.map((canvas) => (canvas as HTMLCanvasElement).toDataURL('image/png')),
      );
    expect(renderedAfterTranslation).not.toEqual(renderedBeforeTranslation);
    await workflow.getByRole('button', { name: 'Inspect presentation state' }).click();
    await page.getByRole('button', { name: 'Send Inspect presentation state' }).click();
    await expect(page.getByText('Inspect presentation state completed.')).toBeVisible();
    await expect(page.getByLabel('Inspect presentation state result')).toContainText(
      '[pt] E2E imported deck',
    );
    await page.getByRole('button', { name: 'Create presentation' }).click();
    await expect(page.getByLabel('Create presentation command input')).toBeVisible();
    await page.getByLabel('Create presentation command input').fill('E2E WebMCP project');
    await page.getByRole('button', { name: 'Send Create presentation' }).click();
    await expect(page.getByText('Create presentation completed.')).toBeVisible();
    await expect(page.getByLabel('Create presentation result')).toContainText('E2E WebMCP project');

    await page.getByRole('button', { name: 'Upsert slide content' }).click();
    await expect(page.getByLabel('Upsert slide content command input')).toBeVisible();
    await page.getByRole('button', { name: 'Send Upsert slide content' }).click();
    await expect(page.getByText('Upsert slide content completed.')).toBeVisible();
    await expect(page.getByLabel('Upsert slide content result')).toContainText('idempotentReplay');
    await expect(
      page
        .frameLocator('iframe[title="LocalStudio editor WebMCP demo"]')
        .getByText(/Page 1.*Agent-native presentations/),
    ).toBeVisible();

    await page.getByRole('button', { name: 'get_presentation_state' }).click();
    await expect(page.getByLabel('Inspect presentation state command input')).toBeVisible();
    await page.getByRole('button', { name: 'Send Inspect presentation state' }).click();
    await expect(page.getByText('Inspect presentation state completed.')).toBeVisible();
    await expect(page.getByLabel('Inspect presentation state result')).toContainText(
      'E2E WebMCP project',
    );
    await expect(page.getByLabel('Inspect presentation state result')).toContainText(
      'Presentations become agent-native',
    );
    const stateAction = workflow.getByRole('button', {
      name: 'Inspect presentation state',
      exact: true,
    });
    await stateAction.click();
    await expect(page.getByLabel('Inspect presentation state command input')).toHaveCount(0);
    await expect(page.getByLabel('Inspect presentation state result')).toHaveCount(0);
    await expect(stateAction.locator('..').getByRole('status')).toHaveCount(0);
    await stateAction.click();
    await expect(page.getByLabel('Inspect presentation state command input')).toBeVisible();
    await expect(page.getByLabel('Inspect presentation state result')).toContainText(
      'Presentations become agent-native',
    );

    await page.getByRole('button', { name: 'Prepare AI models' }).click();
    await page.getByLabel('Prepare AI models command input').fill('{"modelIds":[]}');
    await page.getByRole('button', { name: 'Send Prepare AI models' }).click();
    await expect(page.getByText('Prepare AI models completed.')).toBeVisible();
    await page.getByRole('button', { name: 'Get operation status' }).click();
    await expect(page.getByLabel('Get operation status command input')).not.toHaveValue(
      /run-an-operation-first/,
    );
    await expect(page.getByLabel('Get operation status command input')).toHaveValue(/operationId/);

    await page.getByRole('button', { name: 'List authoring catalog' }).click();
    await expect(page.getByLabel('List authoring catalog command input')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'List authoring catalog options' })).toContainText(
      'Fonts',
    );
    await page.getByRole('button', { name: 'Text animations' }).click();
    await expect(page.getByLabel('List authoring catalog command input')).toHaveValue(
      /"elementType": "text"/,
    );

    await page.getByRole('button', { name: 'Search stock media' }).click();
    await expect(page.getByLabel('Search stock media command input')).toHaveCount(0);
    await page.getByRole('button', { name: 'Images' }).click();
    await page.getByRole('button', { name: 'Send Search stock media' }).click();
    await expect(page.getByText(/Search stock media failed:/)).toBeVisible();
  });

  test('dispatches every editable showcase card through the browser WebMCP runtime', async ({
    page,
  }) => {
    await page.addInitScript((cards) => {
      const calls: Array<{ inputArguments: string; name: string }> = [];
      Object.defineProperty(window, '__webMcpShowcaseCalls', {
        configurable: true,
        value: calls,
      });
      const tools = cards.map(([name, label]) => ({ description: label, name }));
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        value: {
          executeTool: (tool: { name: string }, inputArguments: string) => {
            if (typeof inputArguments !== 'string') {
              throw new Error('Failed to parse input arguments.');
            }
            JSON.parse(inputArguments);
            calls.push({ inputArguments, name: tool.name });
            if (tool.name === 'search_media') {
              return Promise.resolve(
                JSON.stringify({
                  errorCode: 'missing_integration',
                  message: 'Configure Unsplash before searching.',
                  ok: false,
                }),
              );
            }
            if (tool.name === 'prepare_ai_models') {
              return Promise.resolve(
                JSON.stringify({ data: { operationId: 'operation-native-1' }, ok: true }),
              );
            }
            if (tool.name === 'get_operation_status') {
              return Promise.resolve(
                JSON.stringify({
                  data: {
                    operationId: 'operation-native-1',
                    percentage: 100,
                    stage: 'completed',
                    state: 'completed',
                  },
                  ok: true,
                }),
              );
            }
            return Promise.resolve(JSON.stringify({ data: { toolName: tool.name }, ok: true }));
          },
          getTools: () => Promise.resolve(tools),
        },
      });
    }, showcaseCards);
    const webmcp = new WebMcpPage(page, getServer().baseURL);
    await webmcp.gotoShowcase();
    await page.getByRole('button', { name: 'Discover tools' }).click();
    await expect(page.getByText('Discovered 14 tools through WebMCP.')).toBeVisible();

    for (const [, label] of showcaseActionCards) {
      await page.getByRole('button', { name: label, exact: true }).click();
      if (label === 'List authoring catalog') {
        await page.getByRole('button', { name: 'Fonts', exact: true }).click();
      }
      if (label === 'Search stock media') {
        await page.getByRole('button', { name: 'Images', exact: true }).click();
      }
      await page.getByRole('button', { name: `Send ${label}`, exact: true }).click();
      if (label === 'Search stock media') {
        await expect(
          page.getByText('Search stock media failed: Configure Unsplash before searching.'),
        ).toBeVisible();
      } else {
        await expect(page.getByText(`${label} completed.`)).toBeVisible();
      }
      if (label === 'Get operation status') {
        await expect(page.getByLabel('Get operation status command input')).toHaveValue(
          /operation-native-1/,
        );
      }
    }

    const calls = await page.evaluate(
      () =>
        (
          window as typeof window & {
            __webMcpShowcaseCalls: Array<{ inputArguments: string; name: string }>;
          }
        ).__webMcpShowcaseCalls,
    );
    expect(calls.map(({ name }) => name)).toEqual(
      showcaseActionCards.flatMap(([name]) =>
        name === 'prepare_ai_models' ? [name, 'get_operation_status'] : [name],
      ),
    );
    expect(
      calls.every(({ inputArguments }) => {
        const input: unknown = JSON.parse(inputArguments);
        return input && typeof input === 'object';
      }),
    ).toBe(true);
  });
});
