import { type Download, type Page } from '@playwright/test';
import { strFromU8 } from 'fflate';

import { EditorAppPage } from '../pages/editor-app.page';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';
import { readPngVisiblePixelRatio } from '../support/png-visible-pixel-ratio';
import { imageExportDownloadReader } from './image-export-download-reader';

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

interface PreviewResult {
  elementCount: number;
  height: number;
  renderHash: string;
  slideId: string;
  slideNumber: number;
  width: number;
}

interface UpsertResult {
  slideId: string;
}

interface ExportResult {
  fileName: string;
  format: 'jpeg' | 'pdf' | 'png' | 'pptx';
  slideCount: number;
  statistics: Record<string, number>;
  warnings: unknown[];
}

const getServer = withIsolatedDevServer(test);
const deckName = 'WebMCP Visual Export';
const secondSlideText = 'WEBMCP-REVISION-TWO';

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

function expectSuccessfulToolResult<T>(result: WebMcpResult<T>): T {
  expect(result.ok, result.message ?? result.errorCode).toBe(true);
  expect(result.data).toBeDefined();
  return result.data as T;
}

async function createVisualDeck(page: Page) {
  expectSuccessfulToolResult(
    await executeWebMcpTool(page, 'create_presentation', {
      height: 1080,
      name: deckName,
      width: 1920,
    }),
  );

  expectSuccessfulToolResult(
    await executeWebMcpTool(page, 'upsert_slide_content', {
      elements: [
        {
          content: { fill: '#1565C0', shape: 'rect' },
          elementId: 'slide-one-background',
          frame: { height: 1080, width: 1920, x: 0, y: 0 },
          type: 'shape',
          zIndex: 0,
        },
        {
          content: { text: 'WEBMCP-REVISION-ONE' },
          elementId: 'slide-one-title',
          frame: { height: 180, width: 1500, x: 210, y: 450 },
          style: {
            align: 'center',
            color: '#FFFFFF',
            fontFamily: 'Inter',
            fontSize: 92,
            fontWeight: 700,
          },
          type: 'text',
          zIndex: 1,
        },
      ],
      mode: 'replace',
      requestId: 'webmcp-visual-slide-one',
      slide: { name: 'WebMCP Slide One' },
      slideNumber: 1,
    }),
  );

  const secondSlide = expectSuccessfulToolResult<UpsertResult>(
    await executeWebMcpTool(page, 'upsert_slide_content', {
      elements: [
        {
          content: { fill: '#37FD76', shape: 'rect' },
          elementId: 'slide-two-background',
          frame: { height: 1080, width: 1920, x: 0, y: 0 },
          type: 'shape',
          zIndex: 0,
        },
        {
          animations: [
            {
              durationMs: 400,
              effect: 'fade',
              order: 0,
              trigger: 'on-click',
            },
          ],
          content: { text: secondSlideText },
          elementId: 'slide-two-title',
          frame: { height: 180, width: 1500, x: 210, y: 450 },
          style: {
            align: 'center',
            color: '#05100A',
            fontFamily: 'Inter',
            fontSize: 92,
            fontWeight: 700,
          },
          type: 'text',
          zIndex: 1,
        },
      ],
      mode: 'replace',
      requestId: 'webmcp-visual-slide-two',
      slide: { name: 'WebMCP Slide Two' },
      slideNumber: 2,
    }),
  );

  return secondSlide.slideId;
}

async function exportThroughWebMcp(
  page: Page,
  input: {
    format: ExportResult['format'];
    includeAnimationFrames?: boolean;
    slideRange: 'all' | 'current';
  },
): Promise<{ download: Download; result: ExportResult }> {
  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  const start = expectSuccessfulToolResult<OperationStart>(
    await executeWebMcpTool(page, 'export_presentation', input),
  );

  await expect
    .poll(
      async () => {
        const status = expectSuccessfulToolResult<OperationStatus<ExportResult>>(
          await executeWebMcpTool(page, 'get_operation_status', {
            operationId: start.operationId,
            waitForChangeMs: 1_000,
          }),
        );
        if (status.state === 'failed') return `failed: ${status.error ?? 'unknown error'}`;
        return status.state;
      },
      { timeout: 60_000 },
    )
    .toBe('completed');

  const completed = expectSuccessfulToolResult<OperationStatus<ExportResult>>(
    await executeWebMcpTool(page, 'get_operation_status', { operationId: start.operationId }),
  );
  expect(completed.result).toBeDefined();
  return { download: await downloadPromise, result: completed.result as ExportResult };
}

test.describe('production WebMCP visual authoring', () => {
  test('focuses the requested slide in the visible editor and changes its render hash', async ({
    page,
  }, testInfo) => {
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&webmcp=1');
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();
    const secondSlideId = await createVisualDeck(page);

    expectSuccessfulToolResult(
      await executeWebMcpTool(page, 'get_slide_preview', { slideNumber: 1 }),
    );
    const preview = expectSuccessfulToolResult<PreviewResult>(
      await executeWebMcpTool(page, 'get_slide_preview', { slideNumber: 2 }),
    );

    expect(preview).toMatchObject({
      elementCount: 2,
      height: 1080,
      slideId: secondSlideId,
      slideNumber: 2,
      width: 1920,
    });
    expect(preview.renderHash).toMatch(/^slide-/);
    await expect(page.getByText('2 / 2')).toBeVisible();
    await expect(page.locator(`[data-page-id="${secondSlideId}"]`)).toHaveClass(
      /scroll-page-active/,
    );

    const canvasFrame = page.getByLabel('Slide canvas', { exact: true });
    await expect(canvasFrame).toBeVisible();
    const [canvasBox, workspaceBox] = await Promise.all([
      canvasFrame.boundingBox(),
      page.getByLabel('Scrollable slide canvases').boundingBox(),
    ]);
    expect(canvasBox).not.toBeNull();
    expect(workspaceBox).not.toBeNull();
    if (!canvasBox || !workspaceBox) throw new Error('Expected visible editor bounds.');
    expect(canvasBox.width).toBeLessThanOrEqual(workspaceBox.width + 1);
    expect(canvasBox.y + canvasBox.height).toBeGreaterThan(0);
    expect(canvasBox.y).toBeLessThan(page.viewportSize()?.height ?? Number.POSITIVE_INFINITY);
    await canvasFrame.screenshot({ path: testInfo.outputPath('webmcp-slide-two-preview.png') });

    expectSuccessfulToolResult(
      await executeWebMcpTool(page, 'upsert_slide_content', {
        elements: [
          {
            content: { text: `${secondSlideText}-UPDATED` },
            elementId: 'slide-two-title',
            frame: { height: 180, width: 1500, x: 210, y: 450 },
            style: {
              align: 'center',
              color: '#05100A',
              fontFamily: 'Inter',
              fontSize: 92,
              fontWeight: 700,
            },
            type: 'text',
            zIndex: 1,
          },
        ],
        mode: 'merge',
        requestId: 'webmcp-visual-slide-two-update',
        slideNumber: 2,
      }),
    );
    const updatedPreview = expectSuccessfulToolResult<PreviewResult>(
      await executeWebMcpTool(page, 'get_slide_preview', { slideNumber: 2 }),
    );
    expect(updatedPreview.renderHash).not.toBe(preview.renderHash);
  });

  test('downloads and inspects every production WebMCP export format', async ({ page }) => {
    test.setTimeout(120_000);
    const editor = new EditorAppPage(page, getServer().baseURL);
    await editor.goto('/editor/?newProject=1&webmcp=1');
    await expect(page.getByRole('region', { name: 'Canvas workspace' })).toBeVisible();
    await createVisualDeck(page);
    expectSuccessfulToolResult(
      await executeWebMcpTool(page, 'get_slide_preview', { slideNumber: 2 }),
    );

    const pptx = await exportThroughWebMcp(page, { format: 'pptx', slideRange: 'current' });
    expect(pptx.download.suggestedFilename()).toBe(`${deckName}.pptx`);
    expect(pptx.result).toMatchObject({
      fileName: `${deckName}.pptx`,
      format: 'pptx',
      slideCount: 1,
    });
    expect(Array.isArray(pptx.result.warnings)).toBe(true);
    expect(pptx.result.statistics).toHaveProperty('animationBuildCount');
    const pptxFiles = await imageExportDownloadReader.readZip(pptx.download);
    const pptxSlides = Object.keys(pptxFiles).filter((path) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(path),
    );
    expect(pptxSlides).toEqual(['ppt/slides/slide1.xml']);
    expect(strFromU8(pptxFiles['ppt/slides/slide1.xml'] ?? new Uint8Array())).toContain(
      secondSlideText,
    );

    const pdf = await exportThroughWebMcp(page, { format: 'pdf', slideRange: 'current' });
    expect(pdf.download.suggestedFilename()).toBe(`${deckName}.pdf`);
    expect(pdf.result).toMatchObject({ fileName: `${deckName}.pdf`, format: 'pdf', slideCount: 1 });
    expect(pdf.result.statistics).toHaveProperty('frameCount', 1);
    const pdfBytes = await imageExportDownloadReader.readBytes(pdf.download);
    expect(pdfBytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdfBytes.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).toHaveLength(1);

    const jpeg = await exportThroughWebMcp(page, { format: 'jpeg', slideRange: 'current' });
    expect(jpeg.download.suggestedFilename()).toBe(`${deckName}-images.zip`);
    expect(jpeg.result).toMatchObject({ format: 'jpeg', slideCount: 1 });
    const jpegFiles = await imageExportDownloadReader.readZip(jpeg.download);
    const jpegNames = Object.keys(jpegFiles);
    expect(jpegNames).toHaveLength(1);
    expect(jpegNames[0]).toMatch(/WebMCP Slide Two\.jpeg$/);
    const jpegBytes = jpegFiles[jpegNames[0] ?? ''] ?? new Uint8Array();
    expect(Array.from(jpegBytes.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(jpegBytes.subarray(-2))).toEqual([0xff, 0xd9]);

    const png = await exportThroughWebMcp(page, { format: 'png', slideRange: 'all' });
    expect(png.download.suggestedFilename()).toBe(`${deckName}-images.zip`);
    expect(png.result).toMatchObject({ format: 'png', slideCount: 2 });
    const pngFiles = await imageExportDownloadReader.readZip(png.download);
    const pngNames = Object.keys(pngFiles).sort();
    expect(pngNames).toHaveLength(2);
    expect(pngNames.every((fileName) => fileName.endsWith('.png'))).toBe(true);
    pngNames.forEach((fileName) => {
      expect(readPngVisiblePixelRatio(pngFiles[fileName] ?? new Uint8Array())).toBeGreaterThan(0.5);
    });

    const animationFrames = await exportThroughWebMcp(page, {
      format: 'png',
      includeAnimationFrames: true,
      slideRange: 'current',
    });
    const animationFiles = await imageExportDownloadReader.readZip(animationFrames.download);
    expect(Object.keys(animationFiles)).toEqual([`${deckName}-WebMCP Slide Two-animation-01.png`]);
    expect(animationFrames.result).toMatchObject({ format: 'png', slideCount: 1 });
    expect(animationFrames.result.statistics).toHaveProperty('frameCount', 1);
  });
});
