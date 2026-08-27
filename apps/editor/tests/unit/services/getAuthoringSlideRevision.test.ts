import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { authoringRevision } from '../../../src/services/automation/getAuthoringSlideRevision';

describe('getAuthoringSlideRevision', () => {
  it('tracks exact presentation context, including transcript changes', () => {
    const project = sampleProject.createSampleProject();
    const initial = authoringRevision.getPresentation(project);
    const changed = structuredClone(project);
    changed.recordings = {
      recording: {
        id: 'recording',
        name: 'Talk',
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
        durationMs: 1_000,
        modelPresetId: 'web-speech-api',
        audio: { mimeType: 'audio/webm' },
        segments: [
          { id: 'segment', text: 'Updated transcript', startMs: 0, endMs: 1_000, final: true },
        ],
      },
    };

    expect(authoringRevision.getPresentation(changed)).not.toBe(initial);
  });

  it('changes when visual, animation, or referenced asset state changes', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    if (!page) throw new Error('Expected a sample page.');
    const initial = authoringRevision.getSlide(project, page.id);

    const renamed = {
      ...project,
      pages: project.pages.map((candidate) =>
        candidate.id === page.id ? { ...candidate, name: 'Renamed slide' } : candidate,
      ),
    };
    expect(authoringRevision.getSlide(renamed, page.id)).not.toBe(initial);

    const animated = {
      ...project,
      pages: project.pages.map((candidate) =>
        candidate.id === page.id
          ? {
              ...candidate,
              animationBuilds: [
                {
                  id: 'build-1',
                  elementId: candidate.elementIds[0] ?? '',
                  effect: 'fade' as const,
                  trigger: 'on-click' as const,
                  delayMs: 0,
                  order: 1,
                },
              ],
            }
          : candidate,
      ),
    };
    expect(authoringRevision.getSlide(animated, page.id)).not.toBe(initial);

    const referencedElement = page.elementIds
      .map((elementId) => project.elements[elementId])
      .find(
        (element) =>
          element?.type === 'image' || element?.type === 'gif' || element?.type === 'video',
      );
    const referencedAssetId =
      referencedElement?.type === 'image' ||
      referencedElement?.type === 'gif' ||
      referencedElement?.type === 'video'
        ? referencedElement.assetId
        : undefined;
    if (!referencedAssetId) return;
    const referencedAsset = project.assets[referencedAssetId];
    if (!referencedAsset) return;
    const changedAsset = {
      ...project,
      assets: {
        ...project.assets,
        [referencedAssetId]: {
          ...referencedAsset,
          objectUrl: 'https://example.test/changed-asset.png',
        },
      },
    };
    expect(authoringRevision.getSlide(changedAsset, page.id)).not.toBe(initial);
  });

  it('includes layout artwork and embedded font resources in the render hash', () => {
    const project = sampleProject.createSampleProject();
    const page = project.pages[0];
    const sourceElement = page?.elementIds[0] ? project.elements[page.elementIds[0]] : undefined;
    if (!page || !sourceElement) throw new Error('Expected a populated sample page.');
    const layoutElement = { ...sourceElement, id: 'layout-element' };
    const withLayout = {
      ...project,
      fonts: {
        embedded: {
          id: 'embedded',
          family: 'Embedded Test',
          requestedFamily: 'Embedded Test',
          source: 'uploaded' as const,
          fontStyle: 'normal' as const,
          fontWeight: 400,
          mimeType: 'font/woff2' as const,
          fileName: 'embedded-test.woff2',
          storage: 'inline' as const,
          objectUrl: 'data:font/woff2;base64,Zm9udC0x',
        },
      },
      pages: project.pages.map((candidate) =>
        candidate.id === page.id ? { ...candidate, layoutId: 'layout-1' } : candidate,
      ),
      slideLayouts: {
        'layout-1': {
          id: 'layout-1',
          name: 'Layout',
          background: { type: 'color' as const, color: '#ffffff' },
          elementIds: [layoutElement.id],
          elements: { [layoutElement.id]: layoutElement },
          placeholderRoles: [],
          placeholderVisibility: {
            body: true,
            footer: true,
            slideNumber: true,
            title: true,
          },
        },
      },
    };
    const initial = authoringRevision.getSlide(withLayout, page.id);
    const layoutChanged = structuredClone(withLayout);
    const changedLayoutElement = layoutChanged.slideLayouts['layout-1']?.elements['layout-element'];
    if (changedLayoutElement) changedLayoutElement.x += 10;
    expect(authoringRevision.getSlide(layoutChanged, page.id)).not.toBe(initial);

    const fontChanged = structuredClone(withLayout);
    const embeddedFont = fontChanged.fonts.embedded;
    if (embeddedFont) embeddedFont.objectUrl = 'data:font/woff2;base64,Zm9udC0y';
    expect(authoringRevision.getSlide(fontChanged, page.id)).not.toBe(initial);
  });
});
