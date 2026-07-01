import { buildSlideElementPrompt } from '../../../../src/services/prompting/slideElementPrompt';

describe('slide element prompt', () => {
  it('asks for exactly one concrete Konva-ready element', () => {
    const prompt = buildSlideElementPrompt({
      userPrompt: 'A slide with the title Why Web AI Matters',
      task: {
        type: 'add-title',
        id: 'title',
        text: 'Why Web AI Matters',
        placementHint: 'right side, centered vertically',
      },
      allTasks: [
        { type: 'set-background', color: '#050D10' },
        {
          type: 'add-title',
          id: 'title',
          text: 'Why Web AI Matters',
          placementHint: 'right side, centered vertically',
        },
      ],
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(prompt).toContain('Return one JSON element matching the provided response schema');
    expect(prompt).toContain('add-title');
    expect(prompt).toContain('right side, centered vertically');
    expect(prompt).toContain('Keep the element inside 1920 x 1080');
    expect(prompt).toContain('Original user prompt: A slide with the title Why Web AI Matters');
    expect(prompt).toContain('Full task list:');
  });

  it('includes explicit scale and three-column region guidance', () => {
    const prompt = buildSlideElementPrompt({
      userPrompt: 'A slide with three columns about Web AI: Privacy, Speed, and No Backend, each with an icon placeholder and one sentence',
      task: {
        type: 'add-subtitle',
        id: 'privacy-heading',
        text: 'Privacy',
        placementHint: 'column 1 left heading',
      },
      allTasks: [
        { type: 'set-background', color: '#050D10' },
        {
          type: 'add-subtitle',
          id: 'privacy-heading',
          text: 'Privacy',
          placementHint: 'column 1 left heading',
        },
      ],
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(prompt).toContain('Never return tiny centered elements');
    expect(prompt).toContain('left column x 180-600');
    expect(prompt).toContain('center column x 720-1140');
    expect(prompt).toContain('right column x 1320-1740');
    expect(prompt).toContain('column headings 42-58px');
  });

  it('includes fallback regions for image grids, body bullets, and large URL images', () => {
    const prompt = buildSlideElementPrompt({
      userPrompt: 'Image grid with 3 placeholder images and short Web AI captions.',
      task: {
        type: 'add-placeholder-image',
        id: 'grid-1',
        description: 'First Web AI image',
        placementHint: 'grid image 1 left',
      },
      allTasks: [
        {
          type: 'add-placeholder-image',
          id: 'grid-1',
          description: 'First Web AI image',
          placementHint: 'grid image 1 left',
        },
      ],
      page: {
        name: 'Generated slide',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      existingElements: [],
    });

    expect(prompt).toContain('image grid layouts');
    expect(prompt).toContain('centered title + subtitle layouts');
    expect(prompt).toContain('title x 240');
    expect(prompt).toContain('grid image 1 x 120');
    expect(prompt).toContain('body bullet layouts');
    expect(prompt).toContain('bullets x 360');
    expect(prompt).toContain('left image + bullet layouts');
    expect(prompt).toContain('bullets x 1100');
    expect(prompt).toContain('large URL/main image layouts');
  });
});
