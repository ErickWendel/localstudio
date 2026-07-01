import { slideTaskPrompt } from '../../../../src/services/prompting/slideTaskPrompt';

describe('slide task prompt', () => {
  it('asks Prompt API for a staged task list using the design system', () => {
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
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
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
      userPrompt: 'Um slide em português sobre IA no navegador',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('Generate all visible text in the language requested by the user');
    expect(prompt).toContain('Um slide em português sobre IA no navegador');
  });

  it('allows remote image URLs without treating them as image generation', () => {
    const prompt = 'A slide using https://example.com/photo.jpeg as the main image';

    expect(slideTaskPrompt.extractImageUrls(prompt)).toEqual(['https://example.com/photo.jpeg']);
    expect(slideTaskPrompt.looksLikeImageGenerationRequest(prompt)).toBe(false);
  });

  it('detects image generation requests that should use Create image mode', () => {
    expect(slideTaskPrompt.looksLikeImageGenerationRequest('generate an image of a futuristic browser')).toBe(true);
    expect(slideTaskPrompt.looksLikeImageGenerationRequest('crie uma imagem de uma árvore congelada')).toBe(true);
    expect(slideTaskPrompt.looksLikeImageGenerationRequest('a slide with a placeholder image on the left')).toBe(false);
  });

  it('includes a concrete three-column recipe so columns are not collapsed into centered text', () => {
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
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

  it('includes a concrete left-image hero recipe for placeholder image slides', () => {
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
      userPrompt:
        'Create a 16:9 dark LocalStudio.dev slide with the placeholder image expanded large on the left, the neon green title “AI Design Revolution” on the right, and the subtitle “Browser-native creative” below it.',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('For "left image and right title"');
    expect(prompt).toContain('left media block');
    expect(prompt).toContain('right text block');
    expect(prompt).toContain('hero placeholder image');
    expect(prompt).toContain('x 48, y 195, width 980, height 735');
    expect(prompt).toContain('x 1180, y 410, width 600');
  });

  it('defines fallback layout and palette decisions when the user omits them', () => {
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
      userPrompt: 'Title at the top and bullet points in the body about why Web AI is useful.',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('If the user does not specify colors');
    expect(prompt).toContain('If the user does not specify placement');
    expect(prompt).toContain('template-matched palette');
    expect(prompt).toContain('title band + body content');
    expect(prompt).toContain('image grid');
    expect(prompt).toContain('full-bleed or large image');
  });

  it('gives explicit recipes for compact prompt examples', () => {
    const prompt = slideTaskPrompt.buildSlideTaskPrompt({
      userPrompt: 'Image grid with 3 placeholder images and short Web AI captions.',
      targetLanguageHint: 'same as user prompt',
      imageUrls: [],
    });

    expect(prompt).toContain('For "image grid"');
    expect(prompt).toContain('three add-placeholder-image tasks');
    expect(prompt).toContain('grid image 1 left');
    expect(prompt).toContain('Image grid items must be add-placeholder-image tasks by default');
    expect(prompt).toContain('do not use add-shape cards for image slots');
    expect(prompt).toContain('caption below grid image 1');
    expect(prompt).toContain('caption below grid image 2');
    expect(prompt).toContain('caption below grid image 3');
    expect(prompt).toContain('For top title + body bullet slides');
    expect(prompt).toContain('For title + subtitle slides with explicit colors');
    expect(prompt).toContain('set-background using the requested background color');
    expect(prompt).toContain('Do not create separate add-body-text tasks for each bullet');
    expect(prompt).toContain('For left image + bullet slides');
    expect(prompt).toContain('right text block bullets');
    expect(prompt).toContain('For URL image slides');
  });
});
