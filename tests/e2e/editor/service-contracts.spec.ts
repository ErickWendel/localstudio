/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { installFakeOpfs } from '../support/fake-opfs';
import { expect, test, withIsolatedDevServer } from '../support/journey-test';

const getServer = withIsolatedDevServer(test);

test.describe('editor service contracts', () => {
  test('executes mocked AI, progress, and automation controller contracts in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());
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

  test('executes model setup, transformers runtime, and Bonsai worker branches in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const [
        { aiModelCatalog },
        { bonsaiImageRuntime },
        { imageGenerationModel },
        { modelSetupService },
        { TransformersRuntimeClient },
        { webGpuLanguageDetectionRuntime },
        { webGpuTextGenerationRuntime },
      ] = (await Promise.all([
        import('/editor/src/services/model-setup/aiModelCatalog.ts'),
        import('/editor/src/services/image-generation/bonsaiImageRuntime.ts'),
        import('/editor/src/services/image-generation/imageGenerationModel.ts'),
        import('/editor/src/services/model-setup/modelSetupService.ts'),
        import('/editor/src/services/model-setup/transformersRuntimeClient.ts'),
        import('/editor/src/services/translation/webGpuLanguageDetectionRuntime.ts'),
        import('/editor/src/services/prompting/webGpuTextGenerationRuntime.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/model-setup/aiModelCatalog'),
        typeof import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime'),
        typeof import('../../../apps/editor/src/services/image-generation/imageGenerationModel'),
        typeof import('../../../apps/editor/src/services/model-setup/modelSetupService'),
        typeof import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient'),
        typeof import('../../../apps/editor/src/services/translation/webGpuLanguageDetectionRuntime'),
        typeof import('../../../apps/editor/src/services/prompting/webGpuTextGenerationRuntime'),
      ];

      type WorkerMessageHandler<TResponse> = (event: MessageEvent<TResponse>) => void;

      class ScriptedWorker<TRequest extends { id: string; type: string }, TResponse> {
        onerror: ((event: Event | ErrorEvent) => void) | null = null;
        onmessage: WorkerMessageHandler<TResponse> | null = null;
        requests: TRequest[] = [];

        constructor(private readonly respond: (request: TRequest) => TResponse[]) {}

        postMessage(request: TRequest) {
          this.requests.push(request);
          queueMicrotask(() => {
            for (const response of this.respond(request)) {
              this.onmessage?.({ data: response } as MessageEvent<TResponse>);
            }
          });
        }

        fail(message: string) {
          this.onerror?.(new ErrorEvent('error', { message }));
        }
      }

      const workerProgressEvents: Array<{ details?: unknown; progress: number }> = [];
      const transformersWorker = new ScriptedWorker<
        import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerRequest,
        import('../../../apps/editor/src/services/model-setup/transformersRuntimeClient').TransformersWorkerResponse
      >((request) => {
        if (request.type === 'generate-text') {
          return [
            { id: request.id, progress: 35, type: 'progress' },
            { id: request.id, result: `generated:${String(request.prompt)}`, type: 'result' },
          ];
        }
        if (request.type === 'detect-language') {
          return [
            {
              id: request.id,
              result: { language: request.text.includes('hola') ? 'es' : 'en', score: 0.92 },
              type: 'result',
            },
          ];
        }
        if (request.type === 'segment-background-removal') {
          return [
            {
              id: request.id,
              result: {
                imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
                subjectMask: { data: new Uint8Array([1]), height: 1, score: 0.87, width: 1 },
              },
              type: 'result',
            },
          ];
        }
        return [
          {
            details: { loadedBytes: 5, totalBytes: 10 },
            id: request.id,
            progress: 50,
            type: 'progress',
          },
          { id: request.id, type: 'result' },
        ];
      });
      const transformersClient = new TransformersRuntimeClient({
        createWorker: () => transformersWorker as unknown as Worker,
      });
      await transformersClient.preloadTextGeneration('llm-model', {
        onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
      });
      const generatedText = await transformersClient.generateText('llm-model', 'hello');
      await transformersClient.releaseTextGeneration('llm-model');
      await transformersClient.removeTextGeneration('llm-model');
      await transformersClient.preloadLanguageDetection('language-model', {
        onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
      });
      const detectedLanguage = await transformersClient.detectLanguage('language-model', 'hola mundo');
      await transformersClient.preloadImageEditing({
        onProgress: (progress, details) => workerProgressEvents.push({ details, progress }),
      });
      await transformersClient.prepareBackgroundRemoval('asset://image', {
        onProgress: (progress) => workerProgressEvents.push({ progress }),
      });
      const segmentation = await transformersClient.segmentBackgroundRemoval('asset://image', [
        { positive: true, x: 0.25, y: 0.5 },
      ]);
      await transformersClient.removeImageEditing();

      const fallbackCalls: string[] = [];
      const fallbackClient = new TransformersRuntimeClient({
        createWorker: () => {
          throw new Error('worker unavailable');
        },
        fallbackOperations: {
          detectLanguage: async (_modelId, text) => {
            fallbackCalls.push(`detect:${text}`);
            return { language: 'pt', score: 0.77 };
          },
          generateText: async (_modelId, prompt) => {
            fallbackCalls.push(`generate:${String(prompt)}`);
            return 'fallback text';
          },
          preloadImageEditing: async (options) => {
            fallbackCalls.push('preload-image-editing');
            options?.onProgress?.(100);
          },
          removeImageEditing: async () => {
            fallbackCalls.push('remove-image-editing');
          },
          preloadLanguageDetection: async (modelId, options) => {
            fallbackCalls.push(`preload-language:${modelId}`);
            options?.onProgress?.(100);
          },
          preloadTextGeneration: async (modelId, options) => {
            fallbackCalls.push(`preload-text:${modelId}`);
            options?.onProgress?.(100);
          },
          prepareBackgroundRemoval: async (objectUrl, options) => {
            fallbackCalls.push(`prepare:${objectUrl}`);
            options?.onProgress?.(100);
          },
          releaseTextGeneration: async (modelId) => {
            fallbackCalls.push(`release:${modelId}`);
          },
          removeTextGeneration: async (modelId) => {
            fallbackCalls.push(`remove:${modelId}`);
          },
          segmentBackgroundRemoval: async (objectUrl, points) => {
            fallbackCalls.push(`segment:${objectUrl}:${points.length}`);
            return {
              imageInput: { channels: 4, data: new Uint8Array([1, 2, 3, 255]), height: 1, width: 1 },
              subjectMask: { data: new Uint8Array([1]), height: 1, score: 1, width: 1 },
            };
          },
        },
      });
      await fallbackClient.preloadTextGeneration('fallback-llm');
      const fallbackText = await fallbackClient.generateText('fallback-llm', 'fallback prompt');
      await fallbackClient.releaseTextGeneration('fallback-llm');
      await fallbackClient.removeTextGeneration('fallback-llm');
      await fallbackClient.preloadLanguageDetection('fallback-lang');
      const fallbackLanguage = await fallbackClient.detectLanguage('fallback-lang', 'olá');
      await fallbackClient.preloadImageEditing();
      await fallbackClient.prepareBackgroundRemoval('asset://fallback');
      const fallbackSegmentation = await fallbackClient.segmentBackgroundRemoval('asset://fallback', [
        { positive: false, x: 0.1, y: 0.2 },
      ]);
      await fallbackClient.removeImageEditing();

      const textRuntime = new webGpuTextGenerationRuntime.TransformersTextGenerationRuntime(
        fallbackClient,
      );
      await textRuntime.loadTextGenerationModel('runtime-llm');
      await textRuntime.releaseTextGenerationModel('runtime-llm');
      const runtimeText = await textRuntime.generate('runtime-llm', 'runtime prompt');
      await textRuntime.removeTextGenerationModel('runtime-llm');

      const languageRuntime =
        new webGpuLanguageDetectionRuntime.TransformersLanguageDetectionRuntime(fallbackClient);
      await languageRuntime.loadLanguageDetectionModel('runtime-lang');
      const runtimeLanguage = await languageRuntime.detectLanguage('runtime-lang', 'runtime text');

      const bonsaiWorker = new ScriptedWorker<
        import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerRequest,
        import('../../../apps/editor/src/services/image-generation/bonsaiImageRuntime').BonsaiImageWorkerResponse
      >((request) => {
        if (request.type === 'generate') {
          return [
            { id: request.id, progress: 60, type: 'progress' },
            { id: request.id, step: 1, totalSteps: request.options.steps, type: 'step' },
            {
              blob: new Blob([`image:${request.options.prompt}`], { type: 'image/png' }),
              id: request.id,
              type: 'result',
            },
          ];
        }
        return [
          { details: { loadedBytes: 1, totalBytes: 2 }, id: request.id, progress: 50, type: 'progress' },
          { id: request.id, type: 'result' },
        ];
      });
      const bonsaiProgress: number[] = [];
      const bonsaiSteps: string[] = [];
      const bonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
        createWorker: () => bonsaiWorker as unknown as Worker,
      });
      await bonsaiRuntime.preload('bonsai-model', {
        onProgress: (progress) => bonsaiProgress.push(progress),
      });
      const bonsaiBlob = await bonsaiRuntime.generate({
        height: 512,
        modelId: 'bonsai-model',
        onLoadProgress: (progress) => bonsaiProgress.push(progress),
        onStep: (step, total) => bonsaiSteps.push(`${step}/${total}`),
        prompt: 'coverage image',
        seed: 42,
        steps: 2,
        width: 512,
      });

      const fallbackBonsaiRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
        createWorker: () => {
          throw new Error('image worker unavailable');
        },
        fallbackRuntime: {
          generate: async (options) => {
            options.onLoadProgress?.(100);
            options.onStep?.(options.steps, options.steps);
            return new Blob([options.prompt], { type: 'image/png' });
          },
          preload: async (_modelId, options) => {
            options?.onProgress?.(100);
          },
        },
      });
      await fallbackBonsaiRuntime.preload('fallback-bonsai');
      const fallbackBonsaiBlob = await fallbackBonsaiRuntime.generate({
        height: 256,
        modelId: 'fallback-bonsai',
        prompt: 'fallback image',
        steps: 1,
        width: 256,
      });

      const textExtractionErrors: string[] = [];
      const extractedNestedText = webGpuTextGenerationRuntime.extractGeneratedText([
        { generated_text: [{ content: 'nested assistant text' }] },
      ]);
      try {
        webGpuTextGenerationRuntime.extractGeneratedText([{ generated_text: [{ value: 1 }] }]);
      } catch (error) {
        textExtractionErrors.push(error instanceof Error ? error.message : String(error));
      }
      const detectedFromNested = webGpuLanguageDetectionRuntime.extractDetectedLanguage([
        [{ label: 'fr', score: 0.66 }],
      ]);
      try {
        webGpuLanguageDetectionRuntime.extractDetectedLanguage([{ score: 0.1 }]);
      } catch (error) {
        textExtractionErrors.push(error instanceof Error ? error.message : String(error));
      }

      const readyStorage = new Map<string, string>([
        [aiModelCatalog.GEMMA_LLM_READY_KEY, 'true'],
        [aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true'],
        [aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true'],
        [imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true'],
      ]);
      const storageWrites: string[] = [];
      const storage = {
        getItem: (key: string) => readyStorage.get(key) ?? null,
        removeItem: (key: string) => {
          storageWrites.push(`remove:${key}`);
          readyStorage.delete(key);
        },
        setItem: (key: string, value: string) => {
          storageWrites.push(`${key}:${value}`);
          readyStorage.set(key, value);
        },
      };
      const readySetup = new modelSetupService.BrowserModelSetupService(
        undefined,
        storage,
        undefined,
        undefined,
        undefined,
        undefined,
      );
      const initiallyReady = (await readySetup.getModelStates()).filter(
        (state) => state.status === 'ready',
      ).length;
      readyStorage.clear();
      const modelLoads: string[] = [];
      const browserSetup = new modelSetupService.BrowserModelSetupService(
        {
          loadImageEditingModel: async (options) => {
            modelLoads.push('image-editing');
            options?.onProgress?.(75, { loadedBytes: 3, totalBytes: 4 });
          },
          removeImageEditingModel: async () => {
            modelLoads.push('remove-image-editing');
          },
        },
        storage,
        {
          loadImageGenerationModel: async (options) => {
            modelLoads.push('image-generation');
            options?.onProgress?.(40, { loadedBytes: 2, totalBytes: 4 });
          },
        },
        {
          loadTextGenerationModel: async (modelId, options) => {
            modelLoads.push(`text:${modelId}`);
            options?.onProgress?.(55, { loadedBytes: 5, totalBytes: 10 });
          },
          releaseTextGenerationModel: async (modelId) => {
            modelLoads.push(`release:${modelId}`);
          },
          removeTextGenerationModel: async (modelId) => {
            modelLoads.push(`remove-text:${modelId}`);
          },
        },
        {
          deleteModelArtifacts: async (modelId) => {
            modelLoads.push(`delete:${modelId}`);
          },
        },
        {
          loadLanguageDetectionModel: async (modelId, options) => {
            modelLoads.push(`language:${modelId}`);
            options?.onProgress?.(65, { loadedBytes: 6, totalBytes: 10 });
          },
        },
      );
      const imageEditingState = await browserSetup.downloadModel(
        modelSetupService.IMAGE_EDITING_MODEL_ID,
      );
      const imageGenerationState = await browserSetup.downloadModel(
        imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      );
      const llmState = await browserSetup.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
      const translationState = await browserSetup.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);
      const languageState = await browserSetup.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID);
      await browserSetup.downloadRequiredModels();
      const removedLlm = await browserSetup.removeModel(aiModelCatalog.GEMMA_LLM_MODEL_ID);
      const removedTranslation = await browserSetup.removeModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID);
      const removedImageEditing = await browserSetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);
      const removedImageGeneration = await browserSetup.removeModel(
        imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
      );

      const failingSetup = new modelSetupService.BrowserModelSetupService(
        {
          loadImageEditingModel: async () => {
            throw new Error('image editing failed');
          },
        },
        storage,
      );
      const failedState = await failingSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

      const inMemorySetup = new modelSetupService.InMemoryModelSetupService();
      const inMemoryRequired = await inMemorySetup.downloadRequiredModels();
      const inMemoryRemoved = await inMemorySetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);

      return {
        bonsaiBlobText: await bonsaiBlob.text(),
        bonsaiProgress,
        bonsaiRequests: bonsaiWorker.requests.map((request) => request.type),
        bonsaiSteps,
        detectedFromNested,
        detectedLanguage,
        extractedNestedText,
        failedState,
        fallbackBonsaiBlobText: await fallbackBonsaiBlob.text(),
        fallbackCalls,
        fallbackLanguage,
        fallbackSegmentationScore: fallbackSegmentation.subjectMask.score,
        fallbackText,
        generatedText,
        imageEditingState,
        imageGenerationState,
        initiallyReady,
        inMemoryReadyCount: inMemoryRequired.filter((state) => state.status === 'ready').length,
        inMemoryRemoved,
        languageState,
        llmState,
        modelLoads,
        removedImageEditing,
        removedImageGeneration,
        removedLlm,
        removedTranslation,
        runtimeLanguage,
        runtimeText,
        segmentationScore: segmentation.subjectMask.score,
        storageWrites,
        textExtractionErrors,
        translationState,
        workerProgressEvents,
        workerRequests: transformersWorker.requests.map((request) => request.type),
      };
    });

    expect(result).toMatchObject({
      bonsaiBlobText: 'image:coverage image',
      bonsaiRequests: ['preload', 'generate'],
      bonsaiSteps: ['1/2'],
      detectedFromNested: { language: 'fr', score: 0.66 },
      detectedLanguage: { language: 'es', score: 0.92 },
      extractedNestedText: 'nested assistant text',
      failedState: { error: 'image editing failed', progress: 0, status: 'failed' },
      fallbackBonsaiBlobText: 'fallback image',
      fallbackLanguage: { language: 'pt', score: 0.77 },
      fallbackSegmentationScore: 1,
      fallbackText: 'fallback text',
      generatedText: 'generated:hello',
      imageEditingState: { progress: 100, status: 'ready' },
      imageGenerationState: { progress: 100, status: 'ready' },
      inMemoryRemoved: { progress: 0, status: 'needs-download' },
      languageState: { progress: 100, status: 'ready' },
      llmState: { progress: 100, status: 'ready' },
      removedImageEditing: { progress: 0, status: 'needs-download' },
      removedImageGeneration: { progress: 0, status: 'needs-download' },
      removedLlm: { progress: 0, status: 'needs-download' },
      removedTranslation: { progress: 0, status: 'needs-download' },
      runtimeLanguage: { language: 'pt', score: 0.77 },
      runtimeText: 'fallback text',
      segmentationScore: 0.87,
      translationState: { progress: 100, status: 'ready' },
      workerRequests: [
        'preload-text-generation',
        'generate-text',
        'release-text-generation',
        'remove-text-generation',
        'preload-language-detection',
        'detect-language',
        'preload-image-editing',
        'prepare-background-removal',
        'segment-background-removal',
        'remove-image-editing',
      ],
    });
    expect(result.bonsaiProgress).toContain(60);
    expect(result.fallbackCalls).toEqual(
      expect.arrayContaining([
        'preload-text:fallback-llm',
        'generate:fallback prompt',
        'release:fallback-llm',
        'remove:fallback-llm',
        'preload-language:fallback-lang',
        'detect:olá',
        'preload-image-editing',
        'prepare:asset://fallback',
        'segment:asset://fallback:1',
        'remove-image-editing',
      ]),
    );
    expect(result.initiallyReady).toBeGreaterThanOrEqual(4);
    expect(result.inMemoryReadyCount).toBeGreaterThan(0);
    expect(result.modelLoads).toEqual(
      expect.arrayContaining([
        'image-editing',
        'image-generation',
        'remove-image-editing',
        expect.stringMatching(/^delete:/),
      ]),
    );
    expect(result.storageWrites).toEqual(expect.arrayContaining([expect.stringMatching(/:true$/)]));
    expect(result.textExtractionErrors).toEqual([
      'WebGPU text generation did not return text.',
      'Language detection model did not return a language label.',
    ]);
    expect(result.workerProgressEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
    );
  });

  test('executes presenter signaling, sample project, and animation preset contracts in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const [{ animationPresetEngine }, { sampleProject }, { InMemoryPresenterRemoteSignalingService }] =
        (await Promise.all([
          import('/editor/src/ui/editor/animation/animationPresetEngine.ts'),
          import('/editor/src/domain/projects/sampleProject.ts'),
          import(
            '/@fs/Users/erickwendel/Downloads/projetos/canva-webai-clone/packages/presenter-remote/src/signaling-service.ts'
          ),
        ])) as [
          typeof import('../../../apps/editor/src/ui/editor/animation/animationPresetEngine'),
          typeof import('../../../apps/editor/src/domain/projects/sampleProject'),
          typeof import('../../../packages/presenter-remote/src/signaling-service'),
        ];

      let now = Date.parse('2026-07-09T12:00:00.000Z');
      const service = new InMemoryPresenterRemoteSignalingService({
        now: () => now,
        randomCode: () => 'ABCD-1234',
        randomId: () => 'session-1',
      });

      const session = service.registerSession({
        presenterDeviceId: 'presenter-device',
        presenterLabel: 'Main stage',
        ttlMs: 60_000,
      });
      const singleActiveCode = service.getSingleActiveSession()?.code;
      const lookupCode = service.lookupSession('abcd1234')?.code;
      const missingConnection = service.connectController(session.code, '');
      const connected = service.connectController(' abcd 1234 ', 'controller-1');
      const trustedOffer = service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'offer-sdp',
        sessionCode: session.code,
      });
      const untrustedOffer = service.createControllerOffer({
        controllerId: 'controller-2',
        offerSdp: 'ignored-offer',
        sessionCode: session.code,
      });
      const missingOffer = service.createControllerOffer({
        controllerId: 'controller-1',
        offerSdp: 'missing-offer',
        sessionCode: '000000',
      });
      const pendingOffers = service.takePendingOffers(session.code);
      const missingAnswerPublished = service.publishAnswer(session.code, 'controller-2', 'answer-sdp');
      const answerPublished = service.publishAnswer(session.code, 'controller-1', 'answer-sdp');
      const answer = service.getAnswer(session.code, 'controller-1');
      const presenterIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
        candidate: { candidate: 'controller-candidate' },
        target: 'presenter',
      });
      const controllerIcePublished = service.publishIceCandidate(session.code, 'controller-1', {
        candidate: { candidate: 'presenter-candidate' },
        target: 'controller',
      });
      const presenterCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
      const controllerCandidates = service.takeIceCandidates(session.code, 'controller-1', 'controller');
      const drainedCandidates = service.takeIceCandidates(session.code, 'controller-1', 'presenter');
      const missingIce = service.publishIceCandidate(session.code, 'missing-controller', {
        candidate: { candidate: 'missing' },
        target: 'controller',
      });
      const statePublished = service.publishState(session.code, {
        canGoNext: true,
        canGoPrevious: false,
        connectedControllerCount: 0,
        currentSlideIndex: 0,
        notes: 'Remember the close',
        slideCount: 2,
        slideTitle: 'Intro',
        timerElapsedMs: 12_000,
        timerRunning: true,
      });
      const publishedState = service.getPublishedState(session.code);
      const commandPublished = service.publishCommand(
        session.code,
        { type: 'go-to-slide', slideIndex: 1 },
        'controller-1',
      );
      const untrustedCommandPublished = service.publishCommand(
        session.code,
        { type: 'next-slide' },
        'controller-2',
      );
      const anonymousCommandPublished = service.publishCommand(session.code, { type: 'previous-slide' });
      const commands = service.takeCommands(session.code);
      const drainedCommands = service.takeCommands(session.code);
      const controllerClosed = service.closeController(session.code, 'controller-1');
      const sessionAfterControllerClose = service.lookupSession(session.code);
      const missingControllerClosed = service.closeController('000000', 'controller-1');
      const sessionClosed = service.closeSession(session.code);
      const sessionClosedAgain = service.closeSession(session.code);

      const expiring = new InMemoryPresenterRemoteSignalingService({
        now: () => now,
        randomCode: () => 'EFGH-5678',
        randomId: () => 'session-expiring',
      });
      const expiringSession = expiring.registerSession({
        presenterLabel: 'Expiring',
        ttlMs: 1,
      });
      now += 2;
      const activeAfterExpiry = expiring.listActiveSessions();
      const lookupAfterExpiry = expiring.lookupSession(expiringSession.code);

      const blank = sampleProject.createBlankProject();
      const sample = sampleProject.createSampleProject();

      const bounds = { height: 180, width: 320, x: 10, y: 20 };
      const effects = [
        'fade',
        'fade-and-move',
        'move-in',
        'push',
        'drop',
        'fall',
        'scale',
        'switch',
        'swap',
        'flip',
        'flop',
        'cube',
        'doorway',
        'page-flip',
        'revolving-door',
        'twirl',
        'twist',
        'pivot',
        'reflection',
        'clothesline',
        'wipe',
        'reveal',
        'iris',
        'radial-wipe',
        'droplet',
        'grid',
        'mosaic',
        'blinds',
        'color-planes',
        'fade-through-color',
        'confetti',
        'swoosh',
        'keyboard-typing',
        'line-draw',
        'dissolve',
      ] as const;
      const directions = ['left', 'right', 'up', 'down'] as const;
      const animationStates = effects.map((effect, index) =>
        animationPresetEngine.getRenderState({
          bounds,
          direction: directions[index % directions.length],
          effect,
          progress: index % 3 === 0 ? 0 : index % 3 === 1 ? 0.45 : 1,
          seed: `seed-${effect}`,
        }),
      );
      const sideMaskCounts = directions.map(
        (direction) =>
          animationPresetEngine.getRenderState({
            bounds,
            direction,
            effect: 'wipe',
            progress: 0.5,
            seed: `wipe-${direction}`,
          }).masks.length,
      );

      return {
        activeAfterExpiryCount: activeAfterExpiry.length,
        animationCanonicalEffects: animationStates.map((state) => state.canonicalEffect),
        animationMaskTotal: animationStates.reduce((sum, state) => sum + state.masks.length, 0),
        animationParticleTotal: animationStates.reduce(
          (sum, state) => sum + state.particles.length,
          0,
        ),
        answer,
        answerPublished,
        anonymousCommandPublished,
        blankBackground: blank.pages[0]?.background,
        blankElementCount: Object.keys(blank.elements).length,
        blankName: blank.name,
        commandPublished,
        commands,
        connectedCount: connected?.connectedControllerCount,
        controllerCandidates,
        controllerClosed,
        controllerIcePublished,
        drainedCandidates,
        drainedCommands,
        lookupAfterExpiry,
        lookupCode,
        missingAnswerPublished,
        missingConnection,
        missingControllerClosed,
        missingIce,
        missingOffer,
        pendingOffers,
        presenterCandidates,
        presenterIcePublished,
        publishedState,
        sampleAssetUrl: sample.assets['asset-hero']?.objectUrl,
        sampleElementIds: sample.pages[0]?.elementIds,
        sampleTitle: sample.elements['text-title']?.text,
        sessionAfterControllerClose,
        sessionClosed,
        sessionClosedAgain,
        sideMaskCounts,
        singleActiveCode,
        statePublished,
        trustedOffer,
        untrustedCommandPublished,
        untrustedOffer,
      };
    });

    expect(result).toMatchObject({
      activeAfterExpiryCount: 0,
      answer: 'answer-sdp',
      answerPublished: true,
      anonymousCommandPublished: true,
      blankBackground: { color: '#050D10', type: 'color' },
      blankElementCount: 0,
      blankName: 'Untitled Project',
      commandPublished: true,
      connectedCount: 1,
      controllerClosed: true,
      controllerIcePublished: true,
      drainedCandidates: [],
      drainedCommands: [],
      lookupAfterExpiry: undefined,
      lookupCode: 'ABCD-1234',
      missingAnswerPublished: false,
      missingConnection: undefined,
      missingControllerClosed: false,
      missingIce: false,
      missingOffer: { status: 'not-found' },
      presenterIcePublished: true,
      sampleTitle: 'AI Design Revolution',
      sessionAfterControllerClose: { connectedControllerCount: 0 },
      sessionClosed: true,
      sessionClosedAgain: false,
      singleActiveCode: 'ABCD-1234',
      statePublished: true,
      trustedOffer: { status: 'pending' },
      untrustedCommandPublished: false,
      untrustedOffer: { status: 'not-found' },
    });
    expect(result.animationCanonicalEffects).toContain('fade-and-move');
    expect(result.animationMaskTotal).toBeGreaterThan(10);
    expect(result.animationParticleTotal).toBeGreaterThan(20);
    expect(result.commands.map((command) => command.type)).toEqual(['go-to-slide', 'previous-slide']);
    expect(result.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
    expect(result.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);
    expect(result.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
    expect(result.publishedState).toMatchObject({
      connectedControllerCount: 1,
      notes: 'Remember the close',
      slideTitle: 'Intro',
    });
    expect(result.sampleAssetUrl).toContain('encrypted-tbn0.gstatic.com');
    expect(result.sampleElementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);
    expect(result.sideMaskCounts).toEqual([1, 1, 1, 1]);
  });

  test('executes local file repository and asset storage contracts in the browser runtime', async ({
    page,
  }) => {
    await page.addInitScript(installFakeOpfs, { directoryPicker: true });
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const [{ assetFileUtils }, { BrowserFileSystemProjectRepository }, { DisabledProjectRepository }] =
        (await Promise.all([
          import('/editor/src/services/storage/assetFileUtils.ts'),
          import('/editor/src/services/storage/browserFileSystemProjectRepository.ts'),
          import('/editor/src/services/storage/disabledProjectRepository.ts'),
        ])) as [
          typeof import('../../../apps/editor/src/services/storage/assetFileUtils'),
          typeof import('../../../apps/editor/src/services/storage/browserFileSystemProjectRepository'),
          typeof import('../../../apps/editor/src/services/storage/disabledProjectRepository'),
        ];

      const savedHandles: string[] = [];
      const repository = new BrowserFileSystemProjectRepository({
        recentProjectStore: {
          load: async () => null,
          save: async (handle, projectName) => {
            savedHandles.push(`${handle.name}:${projectName ?? ''}`);
          },
        },
      });
      const dataUrl = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
      const fontUrl = 'data:font/woff2;base64,Zm9udC1ieXRlcw==';
      const project = {
        assets: {
          'asset-kept': {
            id: 'asset-kept',
            mimeType: 'image/png',
            name: 'Kept image',
            objectUrl: dataUrl,
            type: 'image',
          },
        },
        createdAt: '2026-07-09T00:00:00.000Z',
        elements: {
          'image-1': {
            assetId: 'asset-kept',
            height: 100,
            id: 'image-1',
            locked: false,
            opacity: 1,
            rotation: 0,
            type: 'image',
            visible: true,
            width: 100,
            x: 0,
            y: 0,
          },
        },
        fonts: {
          inter: {
            family: 'Inter',
            fileName: 'inter.woff2',
            id: 'inter',
            objectUrl: fontUrl,
            storage: 'browser',
          },
        },
        id: 'project-file-contract',
        name: 'File Contract',
        pages: [
          {
            background: { color: '#ffffff', type: 'color' },
            elementIds: ['image-1'],
            height: 1080,
            id: 'page-1',
            name: 'Slide 1',
            visible: true,
            width: 1920,
          },
        ],
        updatedAt: '2026-07-09T12:00:00.000Z',
      };

      await repository.saveProjectAs(project, { projectDirectoryName: 'File Contract' });
      const loadedProject = await repository.loadProject();
      const version = await repository.saveVersion(
        {
          ...project,
          name: 'File Contract v2',
          elements: {
            ...project.elements,
            'image-1': { ...project.elements['image-1'], x: 42 },
          },
        },
        { previousProject: project },
      );
      const history = await repository.getVersionHistory();
      const loadedVersion = await repository.loadVersion(version.id);
      const missingVersion = await repository.loadVersion('missing-version');

      const mirrorProject = {
        ...project,
        name: 'Mirrored Contract',
        assets: {
          'asset-kept': {
            fileName: 'asset-kept.png',
            id: 'asset-kept',
            mimeType: 'image/png',
            name: 'Kept image',
            storage: 'file',
            type: 'image',
          },
        },
        fonts: {},
      };
      const importedProject = await repository.importMirrorFiles([
        {
          blob: new Blob([JSON.stringify(mirrorProject)], { type: 'application/json' }),
          path: 'project.json',
        },
        {
          blob: new Blob(['mirror-image'], { type: 'image/png' }),
          path: 'assets/asset-kept.png',
        },
        {
          blob: new Blob([JSON.stringify({ schemaVersion: 1, versions: [] })], {
            type: 'application/json',
          }),
          path: 'history/manifest.json',
        },
      ]);

      const disabledRepository = new DisabledProjectRepository();
      await disabledRepository.saveProject(project);
      const disabledLoad = await disabledRepository.loadProject();

      const deniedRepository = new BrowserFileSystemProjectRepository({
        pickDirectory: async () =>
          ({
            name: 'denied-root',
            queryPermission: async () => 'denied',
            requestPermission: async () => 'denied',
          }) as unknown as FileSystemDirectoryHandle,
        recentProjectStore: {
          load: async () => null,
          save: async () => undefined,
        },
      });
      const permissionError = await deniedRepository
        .saveProject(project)
        .then(() => '')
        .catch((error) => (error instanceof Error ? error.message : String(error)));

      const remoteBlobText = await assetFileUtils
        .objectUrlToBlob('https://example.test/image.png', async () => new Response('remote-image'))
        .then((blob) => blob.text());
      const unreadableBlob = await assetFileUtils.objectUrlToBlobIfReadable(
        'https://example.test/no-fetch.png',
        undefined,
      );
      const readableBlob = await assetFileUtils.objectUrlToBlobIfReadable(dataUrl, undefined);

      const persistedKeys = Array.from(
        { length: window.localStorage.length },
        (_, index) => window.localStorage.key(index),
      )
        .filter((key): key is string => Boolean(key))
        .filter((key) => key.includes('localstudio.e2e.opfs.file:'))
        .sort();

      return {
        disabledLoad,
        extensions: [
          assetFileUtils.getAssetFileExtension('image/jpeg'),
          assetFileUtils.getAssetFileExtension('image/gif'),
          assetFileUtils.getAssetFileExtension('image/webp'),
          assetFileUtils.getAssetFileExtension('video/mp4'),
          assetFileUtils.getAssetFileExtension('video/webm'),
          assetFileUtils.getAssetFileExtension('video/quicktime'),
          assetFileUtils.getAssetFileExtension('application/octet-stream'),
        ],
        historyCount: history.length,
        importedAssetObjectUrl: importedProject.assets['asset-kept']?.objectUrl,
        importedName: importedProject.name,
        loadedAssetStorage: loadedProject?.assets['asset-kept']?.storage,
        loadedFontStorage: loadedProject?.fonts?.inter?.storage,
        loadedName: loadedProject?.name,
        loadedVersionName: loadedVersion?.name,
        missingVersion,
        permissionError,
        persistedKeys,
        readableBlobText: readableBlob ? await readableBlob.text() : '',
        remoteBlobText,
        savedHandles,
        unreadableBlob,
        versionSummary: version.summary,
      };
    });

    expect(result).toMatchObject({
      disabledLoad: null,
      extensions: ['jpg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'png'],
      historyCount: 1,
      importedName: 'Mirrored Contract',
      loadedAssetStorage: 'file',
      loadedFontStorage: 'file',
      loadedName: 'File Contract',
      loadedVersionName: 'File Contract v2',
      missingVersion: null,
      permissionError:
        'LocalStudio.dev needs permission to read and write the selected project folder.',
      readableBlobText: 'image-bytes',
      remoteBlobText: 'remote-image',
      unreadableBlob: undefined,
    });
    expect(result.importedAssetObjectUrl).toContain('blob:');
    expect(result.persistedKeys).toEqual(
      expect.arrayContaining([
        expect.stringContaining('File Contract/project.json'),
        expect.stringContaining('File Contract/config/localstudio.json'),
        expect.stringContaining('File Contract/assets/asset-kept.png'),
        expect.stringContaining('File Contract/fonts/inter.woff2'),
        expect.stringContaining('File Contract v2/history/manifest.json'),
        expect.stringContaining('File Contract v2/history/versions/'),
        expect.stringContaining('Mirrored Contract/project.json'),
      ]),
    );
    expect(result.savedHandles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('File Contract'),
        expect.stringContaining('Mirrored Contract'),
      ]),
    );
    expect(result.versionSummary).toContain('edits');
  });

  test('executes presenter protocol utility contracts in the browser runtime', async ({ page }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const [
        { presenterRemoteDebugLog },
        { getRuntimePeerOptions },
        { presenterRemoteProtocol },
        { presenterRemoteTimerFormat },
      ] = (await Promise.all([
        import(
          '/@fs/Users/erickwendel/Downloads/projetos/canva-webai-clone/packages/presenter-remote/src/debug-log.ts'
        ),
        import(
          '/@fs/Users/erickwendel/Downloads/projetos/canva-webai-clone/packages/presenter-remote/src/peer-options.ts'
        ),
        import(
          '/@fs/Users/erickwendel/Downloads/projetos/canva-webai-clone/packages/presenter-remote/src/protocol.ts'
        ),
        import(
          '/@fs/Users/erickwendel/Downloads/projetos/canva-webai-clone/packages/presenter-remote/src/timer-format.ts'
        ),
      ])) as [
        typeof import('../../../packages/presenter-remote/src/debug-log'),
        typeof import('../../../packages/presenter-remote/src/peer-options'),
        typeof import('../../../packages/presenter-remote/src/protocol'),
        typeof import('../../../packages/presenter-remote/src/timer-format'),
      ];

      const logs: string[] = [];
      const originalInfo = console.info;
      const originalWarn = console.warn;
      const originalError = console.error;
      console.info = (...values: unknown[]) => logs.push(`info:${values.join('|')}`);
      console.warn = (...values: unknown[]) => logs.push(`warn:${values.join('|')}`);
      console.error = (...values: unknown[]) => logs.push(`error:${values.join('|')}`);
      presenterRemoteDebugLog.info('ready');
      presenterRemoteDebugLog.warn('object', { ok: true });
      presenterRemoteDebugLog.error('failure', new TypeError('bad stream'));
      const circular: { self?: unknown } = {};
      circular.self = circular;
      presenterRemoteDebugLog.warn('circular', circular);
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;

      const textElement = {
        align: 'center',
        fill: '#ffffff',
        fontFamily: 'Inter',
        fontSize: 40,
        fontWeight: 700,
        height: 120,
        id: 'text',
        kind: 'text',
        opacity: 1,
        rotation: 0,
        text: 'Hello',
        width: 400,
        x: 0,
        y: 0,
      };
      const mediaElement = {
        assetUrl: 'blob:video',
        autoplay: true,
        controls: true,
        height: 180,
        id: 'media',
        kind: 'media',
        loop: false,
        mediaType: 'video',
        muted: true,
        opacity: 1,
        rotation: 0,
        width: 320,
        x: 10,
        y: 10,
      };
      const shapeElement = {
        fill: '#111111',
        height: 100,
        id: 'shape',
        kind: 'shape',
        opacity: 1,
        rotation: 0,
        shape: 'rectangle',
        stroke: '#ffffff',
        strokeWidth: 2,
        width: 100,
        x: 20,
        y: 20,
      };
      const preview = {
        backgroundColor: '#000000',
        backgroundImageUrl: 'blob:bg',
        elements: [textElement, mediaElement, shapeElement],
        height: 1080,
        width: 1920,
      };
      const state = {
        activePageId: 'page-1',
        activePageIndex: 0,
        activePageName: 'Intro',
        builds: { current: 1, remaining: 2, total: 3 },
        buildsRemaining: 2,
        commandAvailability: ['next', 'previous'],
        connectedControllerCount: 1,
        deckName: 'Deck',
        nextPageName: 'Close',
        nextSlidePreview: preview,
        notes: 'Notes',
        pageCount: 2,
        pages: [{ id: 'page-1', name: 'Intro', preview }],
        previewMode: 'stream',
        presenterMode: 'presenting',
        shortcuts: ['ArrowRight'],
        slidePreview: preview,
        stream: {
          enabled: true,
          fps: 24,
          height: 720,
          peerId: 'peer-1',
          transport: 'peerjs',
          width: 1280,
        },
        timer: { elapsedMs: 65_000, paused: false, updatedAtEpochMs: 1_000 },
        type: 'state',
        upcomingSlidePreviews: [{ pageId: 'page-2', pageName: 'Close', preview }],
      };
      const commands = [
        { command: 'close', type: 'command' },
        { command: 'next', type: 'command' },
        { command: 'previous', type: 'command' },
        { command: 'pause-timer', type: 'command' },
        { command: 'resume-timer', type: 'command' },
        { command: 'reset-timer', type: 'command' },
        { command: 'request-state', type: 'command' },
        { command: 'start-presenting', type: 'command' },
        { command: 'go-to-page', pageId: 'page-2', type: 'command' },
        { command: 'request-previews', pageIds: ['page-1'], requestId: 'request-1', type: 'command' },
        { command: 'update-notes', notes: 'Updated', pageId: 'page-1', type: 'command' },
      ];
      globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = {
        host: 'localhost',
        path: '/peerjs',
        port: 9000,
        secure: false,
      };
      const peerOptions = getRuntimePeerOptions();
      globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__ = { host: '', port: 0 };
      const missingPeerOptions = getRuntimePeerOptions();

      return {
        commandResults: commands.map((command) => presenterRemoteProtocol.isCommand(command)),
        invalidCommand: presenterRemoteProtocol.isCommand({
          command: 'go-to-page',
          type: 'command',
        }),
        invalidPreviewBatch: presenterRemoteProtocol.isPreviewBatch({
          previews: [{ id: 'bad' }],
          type: 'preview-batch',
        }),
        invalidSession: presenterRemoteProtocol.isSession({ code: 'ABCD-1234' }),
        invalidState: presenterRemoteProtocol.isState({ ...state, timer: { paused: false } }),
        invalidStreamPreference: presenterRemoteProtocol.isStreamPreference({
          fps: 0,
          height: 720,
          quality: 'ultra',
          type: 'stream-preference',
          width: 1280,
        }),
        logs,
        missingPeerOptions,
        peerOptions,
        previewBatch: presenterRemoteProtocol.isPreviewBatch({
          previews: [{ id: 'page-1', name: 'Intro', preview }],
          requestId: 'request-1',
          type: 'preview-batch',
        }),
        session: presenterRemoteProtocol.isSession({
          code: 'ABCD-1234',
          connectedControllerCount: 1,
          expiresAt: '2026-07-09T12:00:00.000Z',
          presenterDeviceId: 'presenter',
          presenterLabel: 'Stage',
          sessionId: 'session-1',
        }),
        state: presenterRemoteProtocol.isState(state),
        streamPreference: presenterRemoteProtocol.isStreamPreference({
          fps: 30,
          height: 720,
          quality: 'medium',
          type: 'stream-preference',
          width: 1280,
        }),
        timers: [
          presenterRemoteTimerFormat.formatElapsed(-1),
          presenterRemoteTimerFormat.formatElapsed(65_000),
          presenterRemoteTimerFormat.formatElapsed(3_661_000),
        ],
      };
    });

    expect(result).toMatchObject({
      invalidCommand: false,
      invalidPreviewBatch: false,
      invalidSession: false,
      invalidState: false,
      invalidStreamPreference: false,
      missingPeerOptions: undefined,
      peerOptions: { host: 'localhost', path: '/peerjs', port: 9000, secure: false },
      previewBatch: true,
      session: true,
      state: true,
      streamPreference: true,
      timers: ['00:00', '01:05', '01:01:01'],
    });
    expect(result.commandResults).toEqual(commandsAllTrue);
    expect(result.logs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('info:[LocalStudio presenter remote]|ready'),
        expect.stringContaining('warn:[LocalStudio presenter remote]|object|{"ok":true}'),
        expect.stringContaining('error:[LocalStudio presenter remote]|failure|TypeError: bad stream'),
        expect.stringContaining('warn:[LocalStudio presenter remote]|circular|[object Object]'),
      ]),
    );
  });

  test('executes WebMCP, mirror file, logger, and mutation utility contracts in the browser runtime', async ({
    page,
  }) => {
    await page.goto(new URL('/editor/?newProject=1', getServer().baseURL).toString());

    const result = await page.evaluate(async () => {
      const [
        { minioMirrorFiles },
        { projectMutationUtils },
        { pptxImportLogger },
        { WebMcpToolAdapter },
      ] = (await Promise.all([
        import('/editor/src/services/mirror/minioMirrorFiles.ts'),
        import('/editor/src/domain/commands/shared/projectMutationUtils.ts'),
        import('/editor/src/services/importing/pptx/pptxImportLogger.ts'),
        import('/editor/src/services/webmcp/webMcpToolAdapter.ts'),
      ])) as [
        typeof import('../../../apps/editor/src/services/mirror/minioMirrorFiles'),
        typeof import('../../../apps/editor/src/domain/commands/shared/projectMutationUtils'),
        typeof import('../../../apps/editor/src/services/importing/pptx/pptxImportLogger'),
        typeof import('../../../apps/editor/src/services/webmcp/webMcpToolAdapter'),
      ];

      const logs: string[] = [];
      const originalInfo = console.info;
      const originalError = console.error;
      console.info = (...values: unknown[]) => logs.push(`info:${JSON.stringify(values)}`);
      console.error = (...values: unknown[]) => logs.push(`error:${JSON.stringify(values)}`);
      pptxImportLogger.info('started');
      pptxImportLogger.info('with details', { slideCount: 2 });
      pptxImportLogger.error('failed', new TypeError('bad pptx'), { fileName: 'broken.pptx' });
      pptxImportLogger.error('object failed', { message: 'object message', name: 'ObjectError' });
      pptxImportLogger.error('plain failed', 'plain error');
      console.info = originalInfo;
      console.error = originalError;

      const controllerCalls: Array<{ input: unknown; name: string }> = [];
      const adapter = new WebMcpToolAdapter({
        createProject: (input) => {
          controllerCalls.push({ input, name: 'createProject' });
          return { data: { name: input.name ?? 'Untitled' }, ok: true };
        },
        generateImage: (input) => {
          controllerCalls.push({ input, name: 'generateImage' });
          return { data: { assetId: 'asset-generated' }, ok: true };
        },
        generateSlides: (input) => {
          controllerCalls.push({ input, name: 'generateSlides' });
          return { data: { prompt: input.prompt }, ok: true };
        },
        getProjectSnapshot: () => {
          controllerCalls.push({ input: {}, name: 'getProjectSnapshot' });
          return { data: { pageCount: 1 }, ok: true };
        },
        translateText: (input) => {
          controllerCalls.push({ input, name: 'translateText' });
          return { data: { scope: input.scope }, ok: true };
        },
      });
      const tools = adapter.createTools();
      const createProjectNamed = await tools[0].execute({ name: 'WebMCP Deck' });
      const createProjectBlank = await tools[0].execute({ name: 123 });
      const generatedSlides = await tools[1].execute({ prompt: 'Create a launch slide' });
      const generatedImage = await tools[2].execute({
        height: 512,
        prompt: 'neon card',
        seed: Number.NaN,
        steps: 8,
        width: 512,
      });
      const translated = await tools[3].execute({
        pageId: 'page-1',
        scope: 'slide',
        targetLanguage: 'pt',
      });
      const translatedWithoutPage = await tools[3].execute({
        pageId: 5,
        scope: 'deck',
        targetLanguage: 'es',
      });
      const snapshot = await tools[4].execute({});
      const registeredNames: string[] = [];
      const unregisterBatch = adapter.register({
        registerTools: (registeredTools) => {
          registeredNames.push(...registeredTools.map((tool) => tool.name));
        },
      });
      unregisterBatch();
      const individuallyRegisteredNames: string[] = [];
      adapter.register({
        registerTool: (tool) => {
          individuallyRegisteredNames.push(tool.name);
        },
      });

      const project = {
        assets: {
          'asset-used': {
            id: 'asset-used',
            mimeType: 'image/png',
            name: 'Used image',
            objectUrl: 'data:image/png;base64,bWlycm9yLWltYWdl',
            type: 'image',
          },
          'asset-unused': {
            id: 'asset-unused',
            mimeType: 'image/png',
            name: 'Unused image',
            objectUrl: 'data:image/png;base64,dW51c2Vk',
            type: 'image',
          },
          'asset-unreadable': {
            id: 'asset-unreadable',
            mimeType: 'image/png',
            name: 'Unreadable image',
            objectUrl: 'https://example.test/unreadable.png',
            type: 'image',
          },
        },
        createdAt: '2026-07-09T00:00:00.000Z',
        elements: {
          'image-1': {
            assetId: 'asset-used',
            height: 100,
            id: 'image-1',
            locked: false,
            opacity: 1,
            rotation: 0,
            type: 'image',
            visible: true,
            width: 100,
            x: 0,
            y: 0,
          },
          'image-2': {
            assetId: 'asset-unreadable',
            height: 120,
            id: 'image-2',
            locked: false,
            opacity: 1,
            rotation: 0,
            type: 'image',
            visible: true,
            width: 120,
            x: 120,
            y: 0,
          },
        },
        fonts: {
          inter: {
            family: 'Inter',
            fileName: 'inter.woff2',
            id: 'inter',
            objectUrl: 'data:font/woff2;base64,bWlycm9yLWZvbnQ=',
            storage: 'browser',
          },
        },
        id: 'project-mirror-contract',
        name: 'Mirror Contract',
        pages: [
          {
            background: { color: '#ffffff', type: 'color' },
            elementIds: ['image-1', 'image-2'],
            height: 1080,
            id: 'page-1',
            name: 'Slide 1',
            visible: true,
            width: 1920,
          },
        ],
        updatedAt: '2026-07-09T12:00:00.000Z',
      };
      const versionProject = {
        ...project,
        assets: {
          'asset-used': {
            ...project.assets['asset-used'],
            objectUrl: 'data:image/png;base64,dmVyc2lvbi1pbWFnZQ==',
          },
        },
        fonts: {},
        id: 'project-mirror-contract-version',
      };
      const mirrorFiles = await minioMirrorFiles.createMirrorFiles(
        project,
        {
          getVersionHistory: async () => [
            {
              changeCount: 1,
              createdAt: '2026-07-09T12:01:00.000Z',
              fileName: 'version-1.json',
              id: 'version-1',
              projectName: 'Mirror Contract',
              summary: '1 edit',
            },
            {
              changeCount: 1,
              createdAt: '2026-07-09T12:02:00.000Z',
              fileName: 'missing-version.json',
              id: 'missing-version',
              projectName: 'Mirror Contract',
              summary: 'missing',
            },
          ],
          loadVersion: async (versionId) => (versionId === 'version-1' ? versionProject : null),
        },
        {
          accessKeyId: 'access',
          bucket: 'bucket',
          endpoint: 'https://s3.example.test',
          publicBaseUrl: ' https://cdn.example.test/public ',
          region: 'us-east-1',
          secretAccessKey: 'secret',
        },
        {
          fetch: async () => new Response('remote-blob'),
          now: () => new Date('2026-07-09T12:34:00.000Z'),
        },
      );
      const manifest = JSON.parse(
        await mirrorFiles.find((file) => file.path === minioMirrorFiles.MIRROR_MANIFEST_FILE_NAME)!.blob.text(),
      );
      const mirroredProject = JSON.parse(
        await mirrorFiles.find((file) => file.path === minioMirrorFiles.PROJECT_FILE_NAME)!.blob.text(),
      ) as { assets: Record<string, { objectUrl?: string; storage?: string }> };
      const touched = projectMutationUtils.touchProject(project);
      const timestamp = projectMutationUtils.getProjectUpdatedAt();

      return {
        controllerCalls,
        createProjectBlank,
        createProjectNamed,
        generatedImage,
        generatedSlides,
        individuallyRegisteredNames,
        logs,
        manifest,
        mirrorFilePaths: mirrorFiles.map((file) => file.path).sort(),
        mirroredAssetIds: Object.keys(mirroredProject.assets).sort(),
        mirroredProjectAssetStorage: mirroredProject.assets['asset-used']?.storage,
        mirroredProjectUnreadableObjectUrl: mirroredProject.assets['asset-unreadable']?.objectUrl,
        registeredNames,
        snapshot,
        timestamp,
        touchedName: touched.name,
        touchedUpdatedAt: touched.updatedAt,
        translated,
        translatedWithoutPage,
        toolDescriptions: tools.map((tool) => tool.description),
        toolNames: tools.map((tool) => tool.name),
      };
    });

    expect(result.toolNames).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
    expect(result).toMatchObject({
      createProjectBlank: { data: { name: 'Untitled' }, ok: true },
      createProjectNamed: { data: { name: 'WebMCP Deck' }, ok: true },
      generatedImage: { data: { assetId: 'asset-generated' }, ok: true },
      generatedSlides: { data: { prompt: 'Create a launch slide' }, ok: true },
      mirroredAssetIds: ['asset-unreadable', 'asset-used'],
      mirroredProjectAssetStorage: 'file',
      mirroredProjectUnreadableObjectUrl: 'https://example.test/unreadable.png',
      registeredNames: [
        'create_project',
        'generate_slides',
        'generate_image',
        'translate_text',
        'get_project_snapshot',
      ],
      snapshot: { data: { pageCount: 1 }, ok: true },
      touchedName: 'Mirror Contract',
      translated: { data: { scope: 'slide' }, ok: true },
      translatedWithoutPage: { data: { scope: 'deck' }, ok: true },
    });
    expect(result.controllerCalls.map((call) => call.name)).toEqual([
      'createProject',
      'createProject',
      'generateSlides',
      'generateImage',
      'translateText',
      'translateText',
      'getProjectSnapshot',
    ]);
    expect(result.individuallyRegisteredNames).toEqual(result.registeredNames);
    expect(result.logs).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[LocalStudio PPTX Import]'),
        expect.stringContaining('bad pptx'),
        expect.stringContaining('ObjectError'),
        expect.stringContaining('plain error'),
      ]),
    );
    expect(result.manifest).toMatchObject({
      projectId: 'project-mirror-contract',
      projectName: 'Mirror Contract',
      publicBaseUrl: 'https://cdn.example.test/public',
      schemaVersion: 1,
      syncedAt: '2026-07-09T12:34:00.000Z',
    });
    expect(result.mirrorFilePaths).toEqual(
      expect.arrayContaining([
        'assets/asset-used.png',
        'config/localstudio.json',
        'fonts/inter.woff2',
        'history/manifest.json',
        'history/versions/version-1.json',
        'localstudio-mirror.json',
        'project.json',
      ]),
    );
    expect(Date.parse(result.timestamp)).not.toBeNaN();
    expect(Date.parse(result.touchedUpdatedAt)).not.toBeNaN();
    expect(result.toolDescriptions.join('\n')).toContain('Good prompt examples');
  });
});

const commandsAllTrue = Array.from({ length: 11 }, () => true);
