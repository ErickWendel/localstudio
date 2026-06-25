import { buildSlideElementPrompt } from '../../../../src/services/prompts/slideElementPrompt';

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
});
