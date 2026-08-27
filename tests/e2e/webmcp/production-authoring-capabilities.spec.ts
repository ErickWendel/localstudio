import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { remoteMirrorImportConfig } from '../editor/remote-mirror-import-config';
import { remoteMirrorShareRoutes } from '../editor/remote-mirror-share-routes';
import { remoteMirrorShareSetup } from '../editor/remote-mirror-share-setup';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { readPngVisiblePixelRatio } from '../support/png-visible-pixel-ratio';

interface WebMcpResult<T> {
  data?: T;
  errorCode?: string;
  message?: string;
  ok: boolean;
}

interface OperationStart {
  operationId: string;
  status: string;
}

interface OperationStatus<T> {
  error?: string;
  result?: T;
  state: 'completed' | 'failed' | 'queued' | 'running';
}

interface PresentationState {
  revision: string;
}

interface PublishResult {
  publicUrl: string;
  revision: string;
  shareId: string;
}

const getServer = withIsolatedDevServer(test);
const sentinel = 'WEBMCP-PUBLISHED-EXACT-REVISION';

async function executeWebMcpTool<T>(
  page: Page,
  name: string,
  input: Record<string, unknown>,
): Promise<WebMcpResult<T>> {
  return page.evaluate(
    ({ input: browserInput, name: browserName }) => {
      const tools = (
        window as typeof window & {
          localStudioWebMcpTools?: Array<{
            execute(input: Record<string, unknown>): unknown;
            name: string;
          }>;
        }
      ).localStudioWebMcpTools;
      const tool = tools?.find((candidate) => candidate.name === browserName);
      if (!tool) throw new Error(`Missing production WebMCP tool: ${browserName}`);
      return tool.execute(browserInput);
    },
    { input, name },
  ) as Promise<WebMcpResult<T>>;
}

function expectWiredResult<T>(result: WebMcpResult<T>): WebMcpResult<T> {
  expect(result.errorCode).not.toBe('capability_pending');
  return result;
}

function expectSuccessfulResult<T>(result: WebMcpResult<T>): T {
  expectWiredResult(result);
  expect(result.ok, result.message ?? result.errorCode).toBe(true);
  expect(result.data).toBeDefined();
  return result.data as T;
}

async function waitForOperation<T>(page: Page, operationId: string) {
  let completed: OperationStatus<T> | undefined;
  await expect
    .poll(
      async () => {
        const result = expectWiredResult(
          await executeWebMcpTool<OperationStatus<T>>(page, 'get_operation_status', {
            operationId,
            waitForChangeMs: 250,
          }),
        );
        expect(result.ok, result.message ?? result.errorCode).toBe(true);
        completed = result.data;
        return completed?.state;
      },
      { timeout: 15_000 },
    )
    .toMatch(/completed|failed/);
  if (!completed) throw new Error(`Operation ${operationId} did not return a status.`);
  return completed;
}

async function startOperation(page: Page, name: string, input: Record<string, unknown>) {
  return expectSuccessfulResult<OperationStart>(await executeWebMcpTool(page, name, input));
}

test.describe('production WebMCP authoring capabilities', () => {
  test('runs the non-visual catalog and publishes the exact authored revision', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
    await remoteMirrorShareSetup.install(context, page, getServer().baseURL);
    const storedObjects = await remoteMirrorShareRoutes.install(context);
    await page.addInitScript((config) => {
      for (const apiName of ['LanguageDetector', 'LanguageModel', 'Translator', 'ai']) {
        Object.defineProperty(window, apiName, { configurable: true, value: undefined });
      }
      window.localStorage.setItem('localstudio.minioMirror.config', JSON.stringify(config));
      window.localStorage.setItem(
        'localstudio.ai.stock-media-config',
        JSON.stringify({ giphyApiKey: '', unsplashAccessKey: 'e2e-unsplash-key' }),
      );
    }, remoteMirrorImportConfig);
    await context.route('http://localhost:9100/broken.pptx', async (route) => {
      await route.fulfill({
        body: 'not-a-powerpoint',
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
    });
    await context.route('https://api.unsplash.com/**', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        json: {
          results: [
            {
              alt_description: 'Bounded WebMCP stock result',
              height: 800,
              id: 'webmcp-stock-image',
              urls: {
                regular: 'https://images.example.test/webmcp.jpg',
                small: 'https://images.example.test/webmcp-preview.jpg',
              },
              user: { name: 'E2E Author' },
              width: 1200,
            },
          ],
        },
      });
    });

    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&webmcp=1');
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();

    expectSuccessfulResult(
      await executeWebMcpTool(page, 'create_presentation', { name: 'WebMCP Published Deck' }),
    );

    const imported = await startOperation(page, 'import_powerpoint_from_url', {
      url: 'http://localhost:9100/broken.pptx',
    });
    expect((await waitForOperation(page, imported.operationId)).state).toBe('failed');

    const translation = await startOperation(page, 'translate_deck_and_notes', {
      sourceLanguage: 'en',
      targetLanguage: 'en',
    });
    expect((await waitForOperation(page, translation.operationId)).state).toBe('completed');

    const description = await startOperation(page, 'generate_deck_detailed_description', {
      force: true,
      language: 'en',
      slideNumbers: [999],
    });
    expect((await waitForOperation(page, description.operationId)).state).toBe('completed');

    const fonts = expectSuccessfulResult<Record<string, unknown>>(
      await executeWebMcpTool(page, 'list_authoring_catalog', { kind: 'fonts' }),
    );
    expect(fonts).toMatchObject({ kind: 'fonts' });
    const animations = expectSuccessfulResult<Record<string, unknown>>(
      await executeWebMcpTool(page, 'list_authoring_catalog', {
        elementType: 'text',
        kind: 'animations',
      }),
    );
    expect(animations).toMatchObject({ elementType: 'text', kind: 'animations' });

    const modelStatus = expectSuccessfulResult<{ models: unknown[] }>(
      await executeWebMcpTool(page, 'get_ai_model_status', {}),
    );
    expect(modelStatus.models.length).toBeGreaterThan(0);
    const prepareModels = await startOperation(page, 'prepare_ai_models', { modelIds: [] });
    expect((await waitForOperation(page, prepareModels.operationId)).state).toBe('completed');

    const media = expectSuccessfulResult<{ items: Array<{ mediaRef: string }> }>(
      await executeWebMcpTool(page, 'search_media', {
        kind: 'image',
        limit: 1,
        term: 'presentations',
      }),
    );
    expect(media.items).toHaveLength(1);
    expect(media.items[0]?.mediaRef).toContain('stock:unsplash:image:');

    expectSuccessfulResult(
      await executeWebMcpTool(page, 'upsert_slide_content', {
        elements: [
          {
            content: { text: sentinel },
            elementId: 'published-sentinel',
            frame: { height: 180, width: 1500, x: 210, y: 450 },
            style: {
              align: 'center',
              color: '#FFFFFF',
              fontFamily: 'Inter',
              fontSize: 88,
              fontWeight: 700,
            },
            type: 'text',
            zIndex: 1,
          },
        ],
        mode: 'replace',
        requestId: 'webmcp-production-capabilities',
        slide: { background: { color: '#071715', type: 'color' }, name: 'Published sentinel' },
        slideNumber: 1,
      }),
    );

    const expectedRevision = expectSuccessfulResult<PresentationState>(
      await executeWebMcpTool(page, 'get_presentation_state', { detail: 'summary' }),
    ).revision;
    const publishing = await startOperation(page, 'publish_presentation', {
      expectedRevision,
      shareId: 'webmcp-exact-revision',
    });
    const published = await waitForOperation<PublishResult>(page, publishing.operationId);
    expect(published.state, published.error).toBe('completed');
    expect(published.result).toMatchObject({
      revision: expectedRevision,
      shareId: 'webmcp-exact-revision',
    });

    const sharePointer = storedObjects.get('mirrors/shares/webmcp-exact-revision.json');
    expect(sharePointer).toBeDefined();
    expect(sharePointer?.body.toString('utf8')).toContain(sentinel);

    const publicPage = await context.newPage();
    await publicPage.goto(published.result!.publicUrl);
    await expect(publicPage.getByRole('main', { name: 'Public presentation' })).toBeVisible({
      timeout: 30_000,
    });
    const renderedSlide = publicPage.getByRole('region', { name: 'Shared slide preview' });
    await expect(renderedSlide).toBeVisible();
    const renderedLayers = await renderedSlide.locator('canvas').evaluateAll((canvases) =>
      canvases.map((canvas) => (canvas as HTMLCanvasElement).toDataURL('image/png')),
    );
    expect(renderedLayers.length).toBeGreaterThan(0);
    expect(
      Math.max(
        ...renderedLayers.map((dataUrl) =>
          readPngVisiblePixelRatio(Buffer.from(dataUrl.split(',')[1] ?? '', 'base64')),
        ),
      ),
    ).toBeGreaterThan(0.005);

    await page.evaluate(() => {
      Object.defineProperty(window, 'Worker', { configurable: true, value: undefined });
    });
    const generatedImage = await startOperation(page, 'generate_image', {
      prompt: 'A deliberately unavailable local worker',
      steps: 1,
    });
    expect((await waitForOperation(page, generatedImage.operationId)).state).toBe('failed');
  });
});
