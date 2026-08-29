import type { ProjectDocument, TextElement } from '../../../src/domain/documents/model';
import { sampleProject } from '../../../src/domain/projects/sampleProject';
import { type LocalSlideDescriptionGenerator } from '../../../src/services/automation/deckDescriptionCapability';
import { deckLocalizationCapability } from '../../../src/services/automation/deckLocalizationCapability';
import type { TranslatorService } from '../../../src/services/contracts/interfaces';

function createText(id: string, text: string, visible = true): TextElement {
  return {
    id,
    type: 'text',
    text,
    x: 10,
    y: 20,
    width: 120,
    height: 28,
    rotation: 0,
    locked: true,
    visible,
    opacity: 1,
    fontFamily: 'Arial',
    fontSize: 20,
    fontWeight: 400,
    fill: '#111111',
    align: 'left',
  };
}

function getRevision(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((candidate) => candidate.id === pageId);
  const text = page?.elementIds.map(
    (id) => project.elements[id]?.type === 'text' && project.elements[id].text,
  );
  return JSON.stringify({ name: page?.name, notes: page?.speakerNotes, text });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createHarness(overrides?: {
  generator?: LocalSlideDescriptionGenerator;
  translate?: (text: string) => Promise<string>;
}) {
  const blank = sampleProject.createBlankProject();
  let project: ProjectDocument = {
    ...blank,
    pages: [
      {
        ...blank.pages[0]!,
        name: 'Opening',
        elementIds: ['visible-title', 'hidden-copy'],
        speakerNotes: 'Say hello',
        semanticDescription: {
          text: 'A greeting title',
          language: 'en',
          generator: 'test',
          generatedAt: '2026-08-26T00:00:00.000Z',
          sourceRevision: '',
          reviewed: true,
          stale: false,
        },
      },
      {
        ...blank.pages[0]!,
        id: 'page-2',
        name: 'Visual',
        elementIds: ['shape-1'],
      },
    ],
    elements: {
      'visible-title': createText('visible-title', 'Hello'),
      'hidden-copy': createText('hidden-copy', 'Do not translate', false),
      'shape-1': {
        id: 'shape-1',
        type: 'shape',
        shape: 'ellipse',
        x: 30,
        y: 40,
        width: 200,
        height: 100,
        rotation: 10,
        locked: false,
        visible: true,
        opacity: 0.8,
        fill: '#ff0000',
        stroke: '#000000',
      },
    },
  };
  project.pages[0]!.semanticDescription!.sourceRevision = getRevision(project, 'page-1');
  const prepareTranslation = vi.fn<TranslatorService['prepareTranslation']>(() =>
    Promise.resolve(),
  );
  const detectLanguage = vi.fn((text: string) => {
    void text;
    return Promise.resolve('en');
  });
  const translatorService: TranslatorService = {
    detectLanguage,
    prepareTranslation,
    translate: vi.fn(
      overrides?.translate ??
        ((text: string) => Promise.resolve(`${text} translated into Portuguese with more words`)),
    ),
  };
  const report = vi.fn();
  const capability = deckLocalizationCapability.create({
    translatorService,
    getProject: () => project,
    applyProject: (nextProject) => {
      project = nextProject;
    },
    getProjectRevision: (candidate) => JSON.stringify(candidate),
    getSlideRevision: getRevision,
    ...(overrides?.generator ? { descriptionGenerator: overrides.generator } : {}),
    now: () => '2026-08-27T12:00:00.000Z',
  });
  return {
    capability,
    detectLanguage,
    getProject: () => project,
    prepareTranslation,
    report,
    setProject: (nextProject: ProjectDocument) => {
      project = nextProject;
    },
  };
}

describe('deckLocalizationCapability', () => {
  it('bounds language-detection samples while collecting them', async () => {
    const harness = createHarness();
    const project = harness.getProject();
    harness.setProject({
      ...project,
      elements: {
        ...project.elements,
        'visible-title': createText('visible-title', 'A'.repeat(100_000)),
      },
    });

    await harness.capability.translateDeckAndNotes({ targetLanguage: 'en' }, harness.report);

    expect(harness.detectLanguage).toHaveBeenCalledOnce();
    expect(harness.detectLanguage.mock.calls[0]?.[0]).toHaveLength(4_000);
  });

  it('translates visible text, notes, and semantic descriptions while preserving structure', async () => {
    const harness = createHarness();
    const before = harness.getProject();

    const result = await harness.capability.translateDeckAndNotes(
      { targetLanguage: 'pt-BR' },
      harness.report,
    );

    const project = harness.getProject();
    expect(result).toMatchObject({
      targetLanguage: 'pt-BR',
      detectedLanguage: 'en',
      changedSlides: [1],
      skippedSlides: [2],
      translatedTextElements: 1,
      translatedNotes: 1,
      translatedDescriptions: 1,
      overflowWarningCount: 1,
      failureCount: 0,
    });
    expect(project.pages.map(({ id, elementIds }) => ({ id, elementIds }))).toEqual(
      before.pages.map(({ id, elementIds }) => ({ id, elementIds })),
    );
    expect(project.elements['visible-title']).toMatchObject({
      text: 'Hello translated into Portuguese with more words',
      width: 120,
      height: 28,
      locked: true,
    });
    expect(project.elements['hidden-copy']).toMatchObject({ text: 'Do not translate' });
    expect(project.pages[0]).toMatchObject({
      speakerNotes: 'Say hello translated into Portuguese with more words',
      semanticDescription: {
        text: 'A greeting title translated into Portuguese with more words',
        language: 'pt-BR',
        generator: 'translation:test',
        generatedAt: '2026-08-27T12:00:00.000Z',
        reviewed: false,
        stale: false,
      },
    });
    expect(project.pages[0]!.semanticDescription!.sourceRevision).toBe(
      getRevision(project, 'page-1'),
    );
    expect(harness.prepareTranslation.mock.calls[0]?.slice(0, 2)).toEqual(['en', 'pt-BR']);
    expect(typeof harness.prepareTranslation.mock.calls[0]?.[2]?.onProgress).toBe('function');
    expect(harness.report).toHaveBeenLastCalledWith(
      expect.objectContaining({ stage: 'translating-slides', current: 2, total: 2 }),
    );
  });

  it('removes stale imported rich-text runs when translating an element', async () => {
    const harness = createHarness({ translate: (text) => Promise.resolve(`PT: ${text}`) });
    const project = harness.getProject();
    const visibleTitle = project.elements['visible-title'];
    if (visibleTitle?.type !== 'text') throw new Error('Expected the visible title fixture.');
    harness.setProject({
      ...project,
      elements: {
        ...project.elements,
        'visible-title': {
          ...visibleTitle,
          importSource: {
            format: 'pptx',
            pageId: project.pages[0]!.id,
            shapeId: '3',
            source: 'slide',
          },
          paragraphs: [
            {
              align: 'left',
              fill: '#111111',
              fontFamily: 'Arial',
              fontSize: 20,
              fontStyle: 'normal',
              fontWeight: 400,
              indent: 0,
              lineHeight: 1.05,
              marginLeft: 0,
              runs: [
                {
                  fill: '#111111',
                  fontFamily: 'Arial',
                  fontSize: 20,
                  fontStyle: 'normal',
                  fontWeight: 400,
                  text: 'Hello',
                },
              ],
              spaceAfter: 0,
              spaceBefore: 0,
              text: 'Hello',
            },
          ],
        },
      },
    });

    await harness.capability.translateDeckAndNotes(
      { targetLanguage: 'pt', sourceLanguage: 'en' },
      harness.report,
    );

    const translatedTitle = harness.getProject().elements['visible-title'];
    expect(translatedTitle).toMatchObject({ text: 'PT: Hello' });
    expect(translatedTitle?.type === 'text' ? translatedTitle.paragraphs : undefined).toBeUndefined();
  });

  it('reports field failures and marks a description stale after a partial visual translation', async () => {
    const harness = createHarness({
      translate: (text) =>
        text === 'Say hello'
          ? Promise.reject(new Error('notes model failed'))
          : Promise.resolve(`PT: ${text}`),
    });

    const result = await harness.capability.translateDeckAndNotes(
      { targetLanguage: 'pt', sourceLanguage: 'en' },
      harness.report,
    );

    expect(result).toMatchObject({ failureCount: 1, changedSlides: [1] });
    expect(result.failures).toEqual([
      expect.objectContaining({
        slideNumber: 1,
        target: 'speaker-notes',
        message: 'notes model failed',
      }),
    ]);
    expect(harness.getProject().pages[0]!.semanticDescription).toMatchObject({
      text: 'PT: A greeting title',
      stale: true,
    });
  });

  it('does not overwrite a newer project while translation is awaiting the model', async () => {
    const translationStarted = createDeferred<void>();
    const translatedText = createDeferred<string>();
    const harness = createHarness({
      translate: () => {
        translationStarted.resolve();
        return translatedText.promise;
      },
    });
    const translation = harness.capability.translateDeckAndNotes(
      { targetLanguage: 'pt', sourceLanguage: 'en' },
      harness.report,
    );
    await translationStarted.promise;
    harness.setProject({ ...harness.getProject(), name: 'Newer human edit' });
    translatedText.resolve('Texto traduzido');

    await expect(translation).rejects.toThrow('presentation changed during translation');
    expect(harness.getProject().name).toBe('Newer human edit');
  });

  it('generates grounded local-model descriptions and skips matching fresh metadata', async () => {
    const generate = vi.fn<LocalSlideDescriptionGenerator['generate']>(() =>
      Promise.resolve('A red ellipse appears on the slide.'),
    );
    const harness = createHarness({ generator: { id: 'local-gemma', generate } });

    const first = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [2], language: 'pt' },
      harness.report,
    );
    const second = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [2], language: 'pt' },
      harness.report,
    );

    expect(first).toMatchObject({
      generatedSlides: [2],
      skippedSlides: [],
      descriptions: [
        {
          slideNumber: 2,
          generator: 'local-gemma',
          freshness: 'fresh',
          text: 'A red ellipse appears on the slide.',
        },
      ],
      failureCount: 0,
    });
    expect(second).toMatchObject({ generatedSlides: [], skippedSlides: [2] });
    expect(generate).toHaveBeenCalledTimes(1);
    const generationInput = generate.mock.calls[0]?.[0];
    expect(generationInput?.language).toBe('pt');
    expect(generationInput?.instruction).toContain('Do not infer');
    expect(generationInput?.scene.slideNumber).toBe(2);
    expect(generationInput?.scene.background).toContain('solid color');
    expect(generationInput?.scene.elements).toEqual([
      expect.objectContaining({
        type: 'shape',
        fact: 'Shape is ellipse; fill #ff0000; stroke #000000.',
      }),
    ]);
    expect(harness.getProject().pages[1]!.semanticDescription).toEqual({
      text: 'A red ellipse appears on the slide.',
      language: 'pt',
      generator: 'local-gemma',
      generatedAt: '2026-08-27T12:00:00.000Z',
      sourceRevision: getRevision(harness.getProject(), 'page-2'),
      reviewed: false,
      stale: false,
    });
  });

  it('stores the full bounded semantic description while bounding the operation result', async () => {
    const generatedText = 'Detailed slide fact. '.repeat(150).trim();
    const harness = createHarness({
      generator: { id: 'local-model', generate: () => Promise.resolve(generatedText) },
    });

    const result = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [1], language: 'en', force: true },
      harness.report,
    );

    expect(harness.getProject().pages[0]!.semanticDescription!.text).toBe(generatedText);
    expect(result.descriptions[0]?.text).toBe(generatedText.slice(0, 2_000));
  });

  it('force-refreshes selected descriptions and reports missing slides', async () => {
    const generate = vi.fn<LocalSlideDescriptionGenerator['generate']>(() =>
      Promise.resolve('Regenerated from facts.'),
    );
    const harness = createHarness({ generator: { id: 'local-model', generate } });

    const result = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [1, 99], language: 'en', force: true },
      harness.report,
    );

    expect(result).toMatchObject({ generatedSlides: [1], skippedSlides: [], failureCount: 1 });
    expect(result.failures).toEqual([
      { slideId: '', slideNumber: 99, message: 'Slide 99 does not exist.' },
    ]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a newer project while description generation is awaiting the model', async () => {
    const generationStarted = createDeferred<void>();
    const generatedText = createDeferred<string>();
    const harness = createHarness({
      generator: {
        id: 'local-model',
        generate: () => {
          generationStarted.resolve();
          return generatedText.promise;
        },
      },
    });
    const generation = harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [2] },
      harness.report,
    );
    await generationStarted.promise;
    harness.setProject({ ...harness.getProject(), name: 'Newer human edit' });
    generatedText.resolve('Generated description');

    await expect(generation).rejects.toThrow('presentation changed during description generation');
    expect(harness.getProject().name).toBe('Newer human edit');
  });

  it('uses a deterministic scene-graph fallback and explicitly reports local-model failure', async () => {
    const harness = createHarness({
      generator: {
        id: 'local-model',
        generate: vi.fn<LocalSlideDescriptionGenerator['generate']>(() =>
          Promise.reject(new Error('model unavailable')),
        ),
      },
    });

    const result = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [2] },
      harness.report,
    );

    expect(result).toMatchObject({
      generatedSlides: [2],
      failureCount: 1,
      warningCount: 1,
      descriptions: [{ generator: 'deterministic-scene-graph-v1' }],
    });
    expect(result.warnings[0]).toContain('fallback was used');
    expect(harness.getProject().pages[1]!.semanticDescription!.text).toBe(
      'Slide 2, "Visual", is 1920 by 1080 with solid color #050D10. It contains 1 visible elements. shape "shape-1" at x 30, y 40, width 200, height 100, rotation 10, opacity 0.8. Shape is ellipse; fill #ff0000; stroke #000000.',
    );
  });

  it('translates deterministic grounded fallback descriptions into the requested language', async () => {
    const harness = createHarness({
      generator: {
        id: 'local-model',
        generate: () => Promise.reject(new Error('model unavailable')),
      },
    });

    const result = await harness.capability.generateDeckDetailedDescription(
      { slideNumbers: [2], language: 'pt-BR' },
      harness.report,
    );

    expect(result.descriptions[0]).toMatchObject({
      generator: 'deterministic-scene-graph-v1',
      language: 'pt-BR',
    });
    expect(harness.getProject().pages[1]?.semanticDescription).toMatchObject({
      language: 'pt-BR',
    });
    expect(harness.getProject().pages[1]?.semanticDescription?.text).toContain(
      'translated into Portuguese',
    );
    expect(harness.prepareTranslation).toHaveBeenCalledWith('en', 'pt-BR');
  });

  it('bounds detailed result entries while retaining complete slide counts', async () => {
    const harness = createHarness();
    const project = harness.getProject();
    const page = project.pages[1]!;
    project.pages = Array.from({ length: 101 }, (_, index) => ({
      ...page,
      id: `page-${index + 1}`,
      name: `Visual ${index + 1}`,
    }));

    const result = await harness.capability.generateDeckDetailedDescription({}, harness.report);

    expect(result.generatedSlideCount).toBe(101);
    expect(result.generatedSlides).toHaveLength(100);
    expect(result.descriptions).toHaveLength(100);
    expect(harness.getProject().pages[100]?.semanticDescription?.stale).toBe(false);
  });
});
