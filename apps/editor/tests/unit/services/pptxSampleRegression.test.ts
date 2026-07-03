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
    const slide15TextElements =
      slide15?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'text') ?? [];
    const slide15ImageElements =
      slide15?.elementIds
        .map((elementId) => project.elements[elementId])
        .filter((element) => element?.type === 'image') ?? [];
    const authorLabel = project.pages[2]?.elementIds
      .map((elementId) => project.elements[elementId])
      .find((element) => element?.type === 'text' && element.text === 'Erick Wendel');
    const animationBuildCount = project.pages.reduce(
      (count, page) => count + (page.animationBuilds?.length ?? 0),
      0,
    );

    expect(project.pages).toHaveLength(66);
    expect(project.pages.filter((page) => page.elementIds.length > 0)).toHaveLength(66);
    expect(elements.filter((element) => element.type === 'text').length).toBeGreaterThan(0);
    expect(elements.filter((element) => element.type === 'video').length).toBeGreaterThan(0);
    expect(animationBuildCount).toBeGreaterThan(0);
    expect(slide15?.background).toEqual({ type: 'color', color: '#3E3E3E' });
    expect(
      slide15TextElements
        .filter((element) => element.fontSize >= 80)
        .every((element) => element.height >= element.fontSize),
    ).toBe(true);
    expect(slide15ImageElements.length).toBeGreaterThan(0);
    if (!authorLabel || authorLabel.type !== 'text') throw new Error('Expected author text label.');
    expect(authorLabel.height).toEqual(expect.any(Number));
    expect(authorLabel.width).toEqual(expect.any(Number));
    expect(authorLabel.width).toBeGreaterThanOrEqual(300);
    expect(authorLabel.height).toBeGreaterThanOrEqual(authorLabel.fontSize * 1.35);
    expect(slide29Text).toContain('Por que uma LLM');
  });
});
