import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { BrowserPptxImportService } from '../../../src/services/importing/pptx/pptxImportService';

const samplePath = '/Users/erickwendel/Downloads/web-ai-beyond-chat-codecon-meetup-26052026.pptx';
const sampleRegressionEnabled = process.env.LOCALSTUDIO_PPTX_SAMPLE_REGRESSION === '1';
const sampleTest = sampleRegressionEnabled ? it : it.skip;

describe('PowerPoint sample regression', () => {
  sampleTest('imports the exported Codecon PPTX with editable objects and media', async () => {
    const bytes = await readFile(samplePath);
    const service = new BrowserPptxImportService();
    const project = await service.importPowerPoint({
      file: new File([bytes], 'web-ai-beyond-chat-codecon-meetup-26052026.pptx', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      }),
    });
    const elements = Object.values(project.elements);
    const slide29Text = project.pages[28]?.elementIds
      .map((elementId) => project.elements[elementId])
      .filter((element) => element?.type === 'text')
      .map((element) => element.text)
      .join(' ');
    const slide15 = project.pages[14];
    const slide6Text = project.pages[5]?.elementIds
      .map((elementId) => project.elements[elementId])
      .find((element) =>
        element?.type === 'text' &&
        element.text.includes('Inteligência artificial é muito mais'),
      );
    const slide15TextElements =
      slide15?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'text') ?? [];
    const slide15ImageElements =
      slide15?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'image') ?? [];
    const slide15LayoutImageElements =
      slide15?.layoutId
        ? (project.slideLayouts?.[slide15.layoutId]?.elementIds
            .map((elementId) => project.slideLayouts?.[slide15.layoutId!]?.elements[elementId])
            .filter((element) => element?.type === 'image') ?? [])
        : [];
    const slide5Text = project.pages[4]?.elementIds
      .map((elementId) => project.elements[elementId])
      .find((element) => element?.type === 'text' && element.text === 'Meu objetivo hoje');
    const authorLabel = Object.values(project.slideLayouts ?? {})
      .flatMap((layout) => layout.elementIds.map((elementId) => layout.elements[elementId]))
      .find((element) => element?.type === 'text' && element.text === 'Erick Wendel');
    const authorLayout = Object.values(project.slideLayouts ?? {}).find((layout) =>
      layout.elementIds.some((elementId) => layout.elements[elementId] === authorLabel),
    );
    const headerLogoElements =
      authorLayout?.elementIds
        .map((elementId) => authorLayout.elements[elementId])
        .flatMap((element) => (element?.type === 'image' && element.y <= 10 ? [element] : [])) ?? [];
    const slide15BuildLabels =
      slide15?.animationBuilds?.map((build) => {
        const element = project.elements[build.elementId];
        return element?.type === 'text' ? element.text : element?.type;
      }) ?? [];
    const slide18TextElements =
      project.pages[17]?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'text') ?? [];
    const slide18BulletText = slide18TextElements.find((element) =>
      element.text.includes('Sem custo de API'),
    );
    const slide21TextElements =
      project.pages[20]?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'text') ?? [];
    const slide21TitleText = slide21TextElements.find((element) =>
      element.text.includes('A IA não é nova:'),
    );
    const slide21LinkText = slide21TextElements.find((element) =>
      element.text.includes('home.dartmouth.edu/about/artificial-intelligence-ai-coined-dartmouth'),
    );
    const slide26 = project.pages[25];
    const slide26VideoIds =
      slide26?.elementIds.filter((elementId) => project.elements[elementId]?.type === 'video') ?? [];
    const slide26AnimatedVideoIds =
      slide26?.animationBuilds
        ?.filter((build) => slide26VideoIds.includes(build.elementId))
        .map((build) => build.elementId) ?? [];
    const animationBuildCount = project.pages.reduce(
      (count, page) => count + (page.animationBuilds?.length ?? 0),
      0,
    );

    expect(project.pages).toHaveLength(66);
    expect(project.pages.filter((page) => page.elementIds.length > 0)).toHaveLength(66);
    expect(elements.filter((element) => element.type === 'text').length).toBeGreaterThan(0);
    expect(elements.filter((element) => element.type === 'video').length).toBeGreaterThan(0);
    expect(animationBuildCount).toBeGreaterThan(0);
    if (!slide6Text || slide6Text.type !== 'text') throw new Error('Expected slide 6 title text.');
    expect(slide6Text.align).toBe('center');
    expect(slide6Text.verticalAlign).toBe('middle');
    expect(slide6Text.lineHeight).toBeCloseTo(0.8, 2);
    expect(slide6Text.fontSize).toBeGreaterThanOrEqual(120);
    expect(slide6Text.fontSize).toBeLessThanOrEqual(135);
    expect(slide15BuildLabels).toEqual(['Web Workers', 'Web Streams', 'Web GPU', 'Web GL']);
    expect(slide15?.background).toEqual({ type: 'color', color: '#3E3E3E' });
    expect(
      slide15TextElements
        .filter((element) => element.fontSize >= 80)
        .every((element) => element.height >= element.fontSize),
    ).toBe(true);
    expect(slide15ImageElements).toHaveLength(0);
    expect(slide15LayoutImageElements.length).toBeGreaterThan(0);
    expect(slide5Text).toMatchObject({
      fill: '#FFFFFF',
      fontFamily: 'American Typewriter',
      fontWeight: 700,
    });
    if (!slide5Text || slide5Text.type !== 'text') throw new Error('Expected slide 5 title text.');
    expect(slide5Text.fontSize).toBeGreaterThanOrEqual(160);
    if (!authorLabel || authorLabel.type !== 'text') throw new Error('Expected author text label.');
    if (!slide18BulletText || slide18BulletText.type !== 'text') {
      throw new Error('Expected slide 18 bullet text.');
    }
    if (!slide21TitleText || slide21TitleText.type !== 'text') {
      throw new Error('Expected slide 21 title text.');
    }
    if (!slide21LinkText || slide21LinkText.type !== 'text') {
      throw new Error('Expected slide 21 link text.');
    }
    expect(authorLabel.height).toEqual(expect.any(Number));
    expect(authorLabel.width).toEqual(expect.any(Number));
    expect(authorLabel.width).toBeGreaterThanOrEqual(190);
    expect(authorLabel.height).toBeGreaterThanOrEqual(authorLabel.fontSize * 1.35);
    expect(headerLogoElements.length).toBeGreaterThanOrEqual(4);
    expect(headerLogoElements.every((element) => element.width >= 30 && element.height >= 30)).toBe(true);
    expect(authorLabel.fontSize).toBeGreaterThanOrEqual(30);
    expect(slide18BulletText.fontSize).toBeGreaterThanOrEqual(69);
    expect(slide18BulletText.fontSize).toBeLessThanOrEqual(90);
    expect(slide21TitleText.align).toBe('center');
    expect(
      Math.abs(slide21TitleText.x + slide21TitleText.width / 2 - project.pages[20]!.width / 2),
    ).toBeLessThanOrEqual(1);
    expect(slide21LinkText.align).toBe('center');
    expect(
      Math.abs(slide21LinkText.x + slide21LinkText.width / 2 - project.pages[20]!.width / 2),
    ).toBeLessThanOrEqual(1);
    expect(slide26VideoIds.length).toBeGreaterThan(0);
    expect(slide26AnimatedVideoIds).toEqual(expect.arrayContaining(slide26VideoIds));
    expect(slide29Text).toContain('Por que uma LLM');
  });
});
