import { expect, test } from '../support/journey-test';
import { serviceContractsSupport } from './service-contracts-support';

test('executes mocked AI, progress, and automation controller contracts in the browser runtime', async ({
  page,
}) => {
  await page.goto(new URL('/editor/?newProject=1', serviceContractsSupport.getServer().baseURL).toString());
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    const [
      { inMemoryAiServices },
      { progress },
      { editorAutomationController },
      { movieStartPlayback },
      { presentationMovieControls },
    ] =
      (await Promise.all([
        import('/editor/src/services/testing/inMemoryAiServices.ts'),
        import('/editor/src/services/model-setup/progress.ts'),
        import('/editor/src/services/automation/editorAutomationController.ts'),
        import('/editor/src/ui/editor/media/movieStartPlayback.ts'),
        import('/editor/src/ui/editor/media/presentationMovieControls.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/testing/inMemoryAiServices'),
        typeof import('../../../apps/editor/src/services/model-setup/progress'),
        typeof import('../../../apps/editor/src/services/automation/editorAutomationController'),
        typeof import('../../../apps/editor/src/ui/editor/media/movieStartPlayback'),
        typeof import('../../../apps/editor/src/ui/editor/media/presentationMovieControls'),
      ];

    const translator = new inMemoryAiServices.MockTranslatorService();
    const paletteService = new inMemoryAiServices.MockPaletteService();
    const imageService = new inMemoryAiServices.MockImageGenerationService();
    const backgroundService = new inMemoryAiServices.MockBackgroundRemovalService();
    const smartGrabService = new inMemoryAiServices.MockSmartGrabService();
    const eraserService = new inMemoryAiServices.MockMagicEraserService();

    const progressEvents: Array<{ details?: unknown; progress: number }> = [];
    const monotonic = progress.createMonotonicProgressReporter((value, details) => {
      progressEvents.push({ details, progress: value });
    });
    monotonic(12.2);
    monotonic(8);
    const transformersProgress = progress.createTransformersProgressCallback((value, details) => {
      progressEvents.push({ details, progress: value });
    });
    transformersProgress({ file: 'a.bin', loaded: 25, name: 'model', status: 'progress', total: 100 });
    transformersProgress({ file: 'b.bin', loaded: 50, name: 'model', status: 'progress', total: 100 });
    transformersProgress({ loaded: 90, progress: 90, status: 'progress_total', total: 100 });
    transformersProgress({ progress: 10, status: 'progress' });

    const image = await imageService.generateImage('Neon launch card', {
      height: 512,
      seed: 7,
      steps: 4,
      width: 512,
    });
    await backgroundService.prepareBackgroundRemoval(image, { onProgress: (value) => monotonic(value) });
    const mask = await backgroundService.previewBackgroundMask(image, { subjectPoint: { x: 0.2, y: 0.4 } });
    const removed = await backgroundService.removeBackground(image);

    let project = {
      assets: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      elements: {
        'text-1': {
          align: 'left',
          fill: '#111111',
          fontFamily: 'Inter',
          fontSize: 40,
          fontWeight: 400,
          height: 120,
          id: 'text-1',
          lineHeight: 1.1,
          locked: false,
          opacity: 1,
          rotation: 0,
          text: 'Hello',
          type: 'text',
          visible: true,
          width: 500,
          x: 20,
          y: 20,
        },
      },
      fonts: {},
      id: 'project-automation',
      name: 'Automation Contract',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['text-1'],
          height: 1080,
          id: 'page-1',
          name: 'Slide 1',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    let selection = { elementIds: ['text-1'], pageId: 'page-1', target: 'element' };
    const controller = new editorAutomationController.EditorAutomationController({
      createProject: async ({ name }) => {
        await Promise.resolve();
        project = { ...project, name: name ?? 'Untitled' };
        return project;
      },
      generateImage: async ({ prompt }) => {
        project = {
          ...project,
          assets: {
            ...project.assets,
            generated: await imageService.generateImage(prompt),
          },
        };
        return project;
      },
      generateSlides: async ({ prompt }) => {
        await Promise.resolve();
        project = { ...project, name: prompt };
        return project;
      },
      getState: () => ({ project, selection }),
      translateText: async ({ scope, targetLanguage }) => {
        project = {
          ...project,
          elements: {
            ...project.elements,
            'text-1': {
              ...project.elements['text-1'],
              text: await translator.translate(scope, targetLanguage),
            },
          },
        };
        selection = { ...selection };
        return { project, translatedPageIds: ['page-1'] };
      },
    });

    const created = await controller.createProject({ name: 'Automated Deck' });
    const emptySlides = await controller.generateSlides({ prompt: '' });
    const generatedSlides = await controller.generateSlides({ prompt: 'Generated deck' });
    const invalidImage = await controller.generateImage({ height: 123, prompt: 'invalid', width: 512 });
    const generatedImage = await controller.generateImage({ height: 512, prompt: 'valid', width: 512 });
    const invalidTranslation = await controller.translateText({
      scope: 'everything',
      targetLanguage: 'pt',
    });
    const translated = await controller.translateText({ scope: 'selection', targetLanguage: 'pt' });
    const snapshot = controller.getProjectSnapshot();
    const video = document.createElement('video');
    video.dataset.elementId = 'video-1';
    video.dataset.trimStart = '2';
    video.dataset.trimEnd = '12';
    Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
    Object.defineProperty(video, 'paused', { configurable: true, value: true });
    video.play = () => {
      Object.defineProperty(video, 'paused', { configurable: true, value: false });
      return Promise.resolve();
    };
    video.pause = () => {
      Object.defineProperty(video, 'paused', { configurable: true, value: true });
    };
    document.body.append(video);
    const movieProject = {
      ...project,
      elements: {
        'video-1': {
          assetId: 'asset-video',
          height: 100,
          id: 'video-1',
          locked: false,
          opacity: 1,
          rotation: 0,
          trimStartSeconds: 2,
          type: 'video',
          visible: true,
          width: 100,
          x: 0,
          y: 0,
        },
      },
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['video-1'],
          height: 1080,
          id: 'page-video',
          name: 'Video',
          visible: true,
          width: 1920,
          animationBuilds: [
            {
              delayMs: 0,
              effect: 'reveal',
              elementId: 'video-1',
              id: 'movie-build',
              mediaAction: 'play',
              trigger: 'on-click',
            },
          ],
        },
      ],
    };
    const movieStarted = movieStartPlayback.playPendingMovieStart(document, movieProject, {
      activeBuildElementId: 'video-1',
      pageId: 'page-video',
      waitingForClick: true,
    });
    const consumedBuild = movieStartPlayback.consumeStartedBuild(video, 'movie-build');
    presentationMovieControls.control([video], 'end');
    const endTime = video.currentTime;
    presentationMovieControls.control([video], 'start');
    const startTime = video.currentTime;
    let holdState = presentationMovieControls.startHold([video], 'fast-forward', undefined);
    const fastForwardRate = video.playbackRate;
    holdState = presentationMovieControls.startHold([video], 'rewind', holdState);
    holdState = presentationMovieControls.stopHold(holdState);
    presentationMovieControls.pulse([video], 'fast-forward', holdState);

    return {
      createdName: created.ok ? created.data.name : '',
      detectedSpanish: await translator.detectLanguage('olá ¿qué tal?'),
      emptySlidesError: emptySlides.ok ? '' : emptySlides.errorCode,
      generatedImageOk: generatedImage.ok,
      generatedSlidesName: generatedSlides.ok ? generatedSlides.data.snapshot.name : '',
      invalidImageError: invalidImage.ok ? '' : invalidImage.errorCode,
      invalidTranslationError: invalidTranslation.ok ? '' : invalidTranslation.errorCode,
      maskScore: mask.score,
      paletteName: (await paletteService.generatePalette('Brand')).name,
      progressValues: progressEvents.map((event) => event.progress),
      remainingMs: progress.estimateRemainingMs({
        elapsedMs: 1000,
        loadedBytes: 25,
        totalBytes: 100,
      }),
      removedAssetId: removed.asset.id,
      smartGrabWidth: (await smartGrabService.suggestSubjectRegion()).width,
      snapshotPageCount: snapshot.ok ? snapshot.data.snapshot.pages.length : 0,
      translatedText: translated.ok
        ? translated.data.snapshot.pages[0]?.elements.find((element) => element.id === 'text-1')?.text
        : '',
      eraserMaskId: (await eraserService.createMask('asset-1')).maskAssetId,
      movieStarted,
      consumedBuild,
      endTime,
      fastForwardRate,
      startTime,
    };
  });

  expect(result).toMatchObject({
    createdName: 'Automated Deck',
    detectedSpanish: 'es',
    emptySlidesError: 'empty_prompt',
    generatedImageOk: true,
    generatedSlidesName: 'Generated deck',
    invalidImageError: 'invalid_image_dimensions',
    invalidTranslationError: 'invalid_translation_scope',
    maskScore: 0.9,
    paletteName: 'Brand',
    remainingMs: 3000,
    removedAssetId: 'asset-generated-neon-launch-card-transparent',
    smartGrabWidth: 0.8,
    snapshotPageCount: 1,
    translatedText: '[pt] selection',
    eraserMaskId: 'asset-1-mask',
    movieStarted: true,
    consumedBuild: true,
    endTime: 12,
    fastForwardRate: 2,
    startTime: 2,
  });
  expect(result.progressValues.at(-1)).toBe(100);
});
