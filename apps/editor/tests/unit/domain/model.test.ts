import { sampleProject } from '../../../src/domain/projects/sampleProject';

describe('project model', () => {
  it('creates a page-based layered project', () => {
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0];

    expect(project.name).toBe('Untitled AI Deck');
    expect(project.pages).toHaveLength(1);
    expect(firstPage?.width).toBe(1920);
    expect(firstPage?.height).toBe(1080);
    expect(firstPage?.elementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
    expect(project.elements['shape-bg']).toBeUndefined();
    expect(firstPage?.background).toEqual({ type: 'color', color: '#050D10' });
  });

  it('keeps z-order as page elementIds', () => {
    const project = sampleProject.createSampleProject();
    const firstPage = project.pages[0]!;
    const topElementId = firstPage.elementIds.at(-1);

    expect(project.elements[topElementId!]?.type).toBe('text');
  });

  it('sizes the title text box for multiline editing handles', () => {
    const project = sampleProject.createSampleProject();
    const title = project.elements['text-title'];

    expect(title?.type).toBe('text');
    expect(title?.height).toBeGreaterThanOrEqual(220);
  });
});
