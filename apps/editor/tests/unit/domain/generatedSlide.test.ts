import { generatedSlide } from '../../../src/domain/generated-slides/generatedSlide';

describe('generated slide validation', () => {
  it('parses staged slide tasks', () => {
    const result = generatedSlide.parseGeneratedSlideTasksJson(JSON.stringify({
      language: 'en',
      page: {
        name: 'Why Web AI Matters',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        { type: 'set-background', color: '#050D10' },
        { type: 'add-placeholder-image', id: 'visual', description: 'web ai demo', placementHint: 'left side' },
        { type: 'add-title', id: 'title', text: 'Why Web AI Matters', placementHint: 'right side' },
      ],
    }));

    expect(result.page.name).toBe('Why Web AI Matters');
    expect(result.tasks).toHaveLength(3);
  });

  it('parses a remote image task only when the URL is https', () => {
    const result = generatedSlide.parseGeneratedSlideTasksJson(JSON.stringify({
      language: 'en',
      page: {
        name: 'Remote image',
        width: 1920,
        height: 1080,
        background: { type: 'color', color: '#050D10' },
      },
      tasks: [
        {
          type: 'add-remote-image',
          id: 'visual',
          url: 'https://example.com/photo.jpeg',
          description: 'provided image',
          placementHint: 'left side',
        },
      ],
    }));

    expect(result.tasks[0]).toMatchObject({ type: 'add-remote-image', url: 'https://example.com/photo.jpeg' });
  });

  it('rejects non-https remote image tasks', () => {
    expect(() =>
      generatedSlide.parseGeneratedSlideTasksJson(JSON.stringify({
        language: 'en',
        page: {
          name: 'Bad',
          width: 1920,
          height: 1080,
          background: { type: 'color', color: '#050D10' },
        },
        tasks: [
          {
            type: 'add-remote-image',
            id: 'bad',
            url: 'http://example.com/photo.jpeg',
            description: 'bad',
            placementHint: 'left',
          },
        ],
      })),
    ).toThrow('Remote image tasks must use an https URL');
  });

  it('parses and clamps one generated element', () => {
    const result = generatedSlide.parseGeneratedSlideElementJson(JSON.stringify({
      type: 'shape',
      id: 'shape',
      shape: 'rect',
      x: -50,
      y: 1000,
      width: 2500,
      height: 500,
      rotation: 0,
      opacity: 1.5,
      fill: 'not-a-color',
    }));

    expect(result).toMatchObject({
      x: 0,
      y: 1000,
      width: 1920,
      height: 80,
      opacity: 1,
      fill: '#37FD76',
    });
  });

  it('normalizes generated text to a readable minimum size', () => {
    const result = generatedSlide.parseGeneratedSlideElementJson(JSON.stringify({
      type: 'text',
      id: 'tiny',
      text: 'Web AI',
      x: 960,
      y: 540,
      width: 80,
      height: 16,
      rotation: 0,
      opacity: 1,
      fontFamily: 'Orbitron',
      fontSize: 12,
      fontWeight: 800,
      fill: '#FFFFFF',
      align: 'center',
    }));

    expect(result).toMatchObject({
      type: 'text',
      fontSize: 28,
      width: 220,
      height: 35,
    });
  });

  it('exports JSON Schemas compatible with Prompt API responseConstraint', () => {
    expect(generatedSlide.GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['language', 'page', 'tasks'],
    });
    expect(Array.isArray(generatedSlide.GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA.oneOf)).toBe(true);
  });
});
