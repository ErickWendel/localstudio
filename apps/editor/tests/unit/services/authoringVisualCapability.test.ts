import { sampleProject } from '../../../src/domain/projects/sampleProject';
import type { ProjectDocument } from '../../../src/domain/documents/model';
import type { AuthoringProgressReporter } from '../../../src/services/automation/authoringAutomationController';
import type { AuthoringExportInput } from '../../../src/services/automation/authoringVisualCapability';
import { createAuthoringVisualCapability } from '../../../src/services/automation/authoringVisualCapability';

function createHarness() {
  const sample = sampleProject.createSampleProject();
  const firstPage = sample.pages[0];
  if (!firstPage) throw new Error('Expected a sample page.');
  const project = {
    ...sample,
    pages: [firstPage, { ...firstPage, id: 'page-2', name: 'Second slide' }],
  };
  const focusSlide = vi.fn(() => Promise.resolve());
  const downloadBlob = vi.fn();
  const exportPowerPoint = vi.fn(() =>
    Promise.resolve({
      blob: new Blob(['pptx']),
      stats: { animationBuildCount: 2, mediaElementCount: 1, slideCount: project.pages.length },
      warnings: [{ code: 'animation-fallback', message: 'Animation was approximated.' }],
    }),
  );
  const exportRendered = vi.fn(
    (
      projectInput: ProjectDocument,
      input: AuthoringExportInput,
      report: AuthoringProgressReporter,
    ) => {
      void projectInput;
      void input;
      void report;
      return Promise.resolve({
        blob: new Blob(['rendered']),
        frameCount: 3,
        slideCount: projectInput.pages.length,
        warnings: [],
      });
    },
  );
  const capability = createAuthoringVisualCapability({
    downloadBlob,
    exportPowerPoint,
    exportRendered,
    focusSlide,
    getActivePageId: () => project.pages[0]?.id ?? '',
    getProject: () => project,
  });
  return { capability, downloadBlob, exportPowerPoint, exportRendered, focusSlide, project };
}

describe('authoringVisualCapability', () => {
  it('focuses a one-based slide and returns bounded render metadata', async () => {
    const harness = createHarness();
    const page = harness.project.pages[1];
    if (!page) throw new Error('Expected a second page.');

    const preview = await harness.capability.getSlidePreview({ slideNumber: 2 });
    expect(preview).toMatchObject({
      slideId: page.id,
      slideNumber: 2,
      width: page.width,
      height: page.height,
      elementCount: page.elementIds.length,
    });
    expect(preview.renderHash).toMatch(/^slide-/);
    expect(harness.focusSlide).toHaveBeenCalledWith(page.id);
    await expect(harness.capability.getSlidePreview({ slideNumber: 0 })).rejects.toThrow(
      'one-based slideNumber',
    );
  });

  it('exports and downloads PowerPoint with typed warnings and statistics', async () => {
    const harness = createHarness();
    const report = vi.fn();

    await expect(
      harness.capability.exportPresentation({ format: 'pptx', slideRange: 'all' }, report),
    ).resolves.toMatchObject({
      fileName: `${harness.project.name}.pptx`,
      format: 'pptx',
      slideCount: harness.project.pages.length,
      warnings: [{ code: 'animation-fallback' }],
      statistics: { animationBuildCount: 2, mediaElementCount: 1 },
    });
    expect(harness.downloadBlob).toHaveBeenCalledWith(
      expect.any(Blob),
      `${harness.project.name}.pptx`,
    );
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'downloading', progress: 95 }),
    );
  });

  it('routes PDF and image archives through rendered export callbacks', async () => {
    const harness = createHarness();
    const report = vi.fn();

    await expect(
      harness.capability.exportPresentation(
        { format: 'jpeg', slideRange: 'current', includeAnimationFrames: true },
        report,
      ),
    ).resolves.toMatchObject({
      fileName: `${harness.project.name}-images.zip`,
      format: 'jpeg',
      slideCount: 1,
      statistics: { frameCount: 3 },
    });
    expect(harness.exportRendered).toHaveBeenCalledOnce();
    const renderedCall = harness.exportRendered.mock.calls[0];
    expect(renderedCall?.[0].pages).toEqual([harness.project.pages[0]]);
    expect(renderedCall?.[1]).toEqual({
      format: 'jpeg',
      slideRange: 'current',
      includeAnimationFrames: true,
    });
    expect(renderedCall?.[2]).toBe(report);
  });
});
