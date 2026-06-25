import {
  buildSlideTaskPrompt,
  extractImageUrls,
  looksLikeImageGenerationRequest,
} from '../../../../src/services/prompts/slideTaskPrompt';

describe('slide task prompt', () => {
  it('asks Prompt API for a staged task list using the design system', () => {
    const prompt = buildSlideTaskPrompt({
      userPrompt: 'A slide with the title Why Web AI Matters',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('Return JSON that matches the provided response schema');
    expect(prompt).toContain('small ordered task list');
    expect(prompt).toContain('set-background');
    expect(prompt).toContain('add-title');
    expect(prompt).toContain('1920');
    expect(prompt).toContain('1080');
    expect(prompt).toContain('#37FD76');
    expect(prompt).toContain('Orbitron');
    expect(prompt).toContain('Open Sans');
    expect(prompt).toContain('A slide with the title Why Web AI Matters');
  });

  it('tells Prompt API to preserve the requested language', () => {
    const prompt = buildSlideTaskPrompt({
      userPrompt: 'Um slide em português sobre IA no navegador',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('Generate all visible text in the language requested by the user');
    expect(prompt).toContain('Um slide em português sobre IA no navegador');
  });

  it('allows remote image URLs without treating them as image generation', () => {
    const prompt = 'A slide using https://example.com/photo.jpeg as the main image';

    expect(extractImageUrls(prompt)).toEqual(['https://example.com/photo.jpeg']);
    expect(looksLikeImageGenerationRequest(prompt)).toBe(false);
  });

  it('detects image generation requests that should use Create image mode', () => {
    expect(looksLikeImageGenerationRequest('generate an image of a futuristic browser')).toBe(true);
    expect(looksLikeImageGenerationRequest('crie uma imagem de uma árvore congelada')).toBe(true);
    expect(looksLikeImageGenerationRequest('a slide with a placeholder image on the left')).toBe(false);
  });

  it('includes a concrete three-column recipe so columns are not collapsed into centered text', () => {
    const prompt = buildSlideTaskPrompt({
      userPrompt: 'A slide with three columns about Web AI: Privacy, Speed, and No Backend, each with an icon placeholder and one sentence',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('For "three columns"');
    expect(prompt).toContain('column 1 left');
    expect(prompt).toContain('column 2 center');
    expect(prompt).toContain('column 3 right');
    expect(prompt).toContain('icon placeholder');
    expect(prompt).toContain('add-shape with shape "ellipse"');
    expect(prompt).toContain('do not create tiny centered text clusters');
  });
});
