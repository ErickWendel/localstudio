import type { Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { installFakeOpfs } from '../support/fake-opfs';
import { modelRuntimeContractPage } from '../support/model-runtime-contract-page';
import { createPresenterProtocolCommands } from '../support/presenter-protocol-commands-fixture';
import { createPresenterProtocolPreview } from '../support/presenter-protocol-preview-fixture';
import { createPresenterProtocolState } from '../support/presenter-protocol-state-fixture';
import { expect, test } from '../support/journey-test';
import { animationPresetContractPage } from './animation-preset-contract-page';
import { automationControllerContractPage } from './automation-controller-contract-page';
import { evaluateAutomationControllerCreateContract } from './automation-controller-create-contract-browser';
import { evaluateAutomationControllerImageContract } from './automation-controller-image-contract-browser';
import { evaluateAutomationControllerSlidesContract } from './automation-controller-slides-contract-browser';
import { evaluateAutomationControllerSnapshotContract } from './automation-controller-snapshot-contract-browser';
import { evaluateAutomationControllerTranslationContract } from './automation-controller-translation-contract-browser';
import { evaluateAssetFileUtilsContract } from './asset-file-utils-contract-browser';
import { bonsaiRuntimeContractPage } from './bonsai-runtime-contract-page';
import { evaluateEditorHighCoverageContract } from './editor-high-coverage-contract-browser';
import { evaluateEditorShellShareRecordingContract } from './editor-shell-share-recording-contract-browser';
import { mirrorFileContractProject } from './mirror-file-contract-project';
import { mirrorFileContractRuntimePage } from './mirror-file-contract-runtime-page';
import { modelDownloadContractPage } from './model-download-contract-page';
import { evaluateModelInMemoryContract } from './model-in-memory-contract-browser';
import { evaluateModelReadinessContract } from './model-readiness-contract-browser';
import { movieControlsContractPage } from './movie-controls-contract-page';
import { evaluateMockedAiContract } from './mocked-ai-contract-browser';
import { evaluatePptxImportLoggerContract } from './pptx-import-logger-contract-browser';
import { pptxPatcherContractFixtures } from './pptx-patcher-contract-fixtures';
import { evaluatePresenterLoggingContract } from './presenter-logging-contract-browser';
import { evaluatePresenterOptionsContract } from './presenter-options-contract-browser';
import { evaluatePresenterPeerTransportContract } from './presenter-peer-transport-contract-browser';
import { evaluatePresenterProtocolValidatorContract } from './presenter-protocol-validator-contract-browser';
import { evaluatePresenterSessionServiceContract } from './presenter-session-service-contract-browser';
import { evaluatePresenterSignalingExpiryContract } from './presenter-signaling-expiry-contract-browser';
import { evaluatePresenterSignalingSessionContract } from './presenter-signaling-session-contract-browser';
import { evaluatePresenterSignalingStateContract } from './presenter-signaling-state-contract-browser';
import { presenterSignalingContractPage } from './presenter-signaling-contract-page';
import { presenterSignalingWebRtcContractPage } from './presenter-signaling-webrtc-contract-page';
import { evaluateProgressContract } from './progress-contract-browser';
import { evaluateProjectMutationUtilsContract } from './project-mutation-utils-contract-browser';
import { evaluateSampleProjectContract } from './sample-project-contract-browser';
import { serviceContractsSupport } from './service-contracts-support';
import { createMirrorStorageContractProject, createStorageContractProject } from './storage-contract-project';
import { storageContractRuntimePage } from './storage-contract-runtime-page';
import { evaluateStorageDisabledContract } from './storage-disabled-contract-browser';
import { evaluateStorageMirrorImportContract } from './storage-mirror-import-contract-browser';
import { evaluateTransformersExtractionContract } from './transformers-extraction-contract-browser';
import { transformersFallbackContractPage } from './transformers-fallback-contract-page';
import { transformersRuntimeContractPage } from './transformers-runtime-contract-page';
import { evaluateWebMcpToolAdapterExecutionContract } from './webmcp-tool-adapter-execution-contract-browser';
import { evaluateWebMcpToolAdapterMetadataContract } from './webmcp-tool-adapter-metadata-contract-browser';
import { evaluateWebMcpToolAdapterRegistrationContract } from './webmcp-tool-adapter-registration-contract-browser';
import { webMcpContractPage } from './webmcp-contract-page';

async function gotoNewProject(page: Page) {
  const editor = new EditorAppPage(page, serviceContractsSupport.getServer().baseURL);
  await editor.gotoNewProject();
}

test.describe('editor service contracts coverage batch', () => {
  test('executes editor and automation service contracts in the browser runtime', async ({
    page,
  }) => {
    await test.step('animation presets', async () => {
      const result = await animationPresetContractPage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
      );

      expect(result.animationCanonicalEffects).toContain('fade-and-move');
      expect(result.animationMaskTotal).toBeGreaterThan(10);
      expect(result.animationParticleTotal).toBeGreaterThan(20);
      expect(result.sideMaskCounts).toEqual([1, 1, 1, 1]);
    });

    await test.step('asset file utilities', async () => {
      await gotoNewProject(page);
      const result = await page.evaluate(evaluateAssetFileUtilsContract);

      expect(result).toEqual({
        extensions: ['jpg', 'gif', 'webp', 'mp4', 'webm', 'mov', 'png'],
        readableBlobText: 'image-bytes',
        remoteBlobText: 'remote-image',
        unreadableBlob: undefined,
      });
    });

    await test.step('automation controller', async () => {
      const baseURL = serviceContractsSupport.getServer().baseURL;
      await expect(
        automationControllerContractPage.run(
          page,
          baseURL,
          evaluateAutomationControllerCreateContract,
        ),
      ).resolves.toMatchObject({ createdName: 'Automated Deck' });
      await expect(
        automationControllerContractPage.run(
          page,
          baseURL,
          evaluateAutomationControllerSlidesContract,
        ),
      ).resolves.toMatchObject({
        emptySlidesError: 'empty_prompt',
        generatedSlidesName: 'Generated deck',
      });
      await expect(
        automationControllerContractPage.run(
          page,
          baseURL,
          evaluateAutomationControllerImageContract,
        ),
      ).resolves.toMatchObject({
        generatedImageOk: true,
        invalidImageError: 'invalid_image_dimensions',
      });
      await expect(
        automationControllerContractPage.run(
          page,
          baseURL,
          evaluateAutomationControllerTranslationContract,
        ),
      ).resolves.toMatchObject({
        invalidTranslationError: 'invalid_translation_scope',
        translatedText: '[pt] selection',
      });
      await expect(
        automationControllerContractPage.run(
          page,
          baseURL,
          evaluateAutomationControllerSnapshotContract,
        ),
      ).resolves.toMatchObject({ snapshotPageCount: 1 });
    });

    await test.step('editor shell share recording selection', async () => {
      await gotoNewProject(page);
      const result = await page.evaluate(evaluateEditorShellShareRecordingContract, {
        editorSourceRoot: serviceContractsSupport.editorSourceRoot,
      });

      expect(result).toEqual({
        missingSelectionKeepsAll: ['first', 'second'],
        noSelectionKeepsIdentity: true,
        selectedRecordingIds: ['second'],
      });
    });

    await test.step('high-value editor runtime coverage contracts', async () => {
      await gotoNewProject(page);
      const result = await page.evaluate(evaluateEditorHighCoverageContract, {
        editorSourceRoot: serviceContractsSupport.editorSourceRoot,
        pptx: pptxPatcherContractFixtures.createInput(),
      });

      expect(result.generatedTexts).toEqual(['plain', 'chat content', 'nested chat', 'object text']);
      expect(result.detectedLanguages).toEqual([{ language: 'pt', score: 0.91 }, { language: 'en' }]);
      expect(result.parsingErrors).toHaveLength(2);
      expect(result.patchedWarningCodes).toEqual(
        expect.arrayContaining([
          'existing-warning',
          'pptx-animation-effect-downgraded',
          'pptx-animation-target-missing',
          'pptx-slide-file-missing',
        ]),
      );
      expect(result.progress).toMatchObject({
        estimated: 1500,
        invalidEstimate: null,
        mapped: 40,
      });
      expect(result.remote).toMatchObject({
        activePageName: 'Opening',
        emptyPageCount: 0,
        skeletonRemaining: 1,
        timerInvalid: false,
        timerValid: true,
      });
      expect(result.remote.batchCount).toBeGreaterThan(0);
      expect(result.remote.slidePreviewElements).toBeGreaterThan(0);
      expect(result.recorder).toMatchObject({
        objectUrl: 'blob:contract-audio',
        recordingBeforePause: true,
        revokedUrls: ['blob:contract-audio'],
        stopBeforeStartMessage: 'Recorder has not started.',
        stoppedTracks: 1,
        type: 'audio/webm',
      });
      expect(result.recorder.chunkCount).toBeGreaterThan(0);
      expect(result.session).toMatchObject({
        blockedStatus: 'blocked',
        postedCommands: 1,
        previewCount: 1,
        remoteClosed: true,
      });
      expect(result.session.stateCount).toBeGreaterThan(0);
      expect(result.speech).toMatchObject({
        changedSpeechLanguage: 'en-US',
        errors: [
          'Microphone permission is required for live transcription.',
          'Network down',
        ],
        text: 'ola mundo',
      });
      expect(result.speech.updates).toContainEqual({ final: false, text: 'ola mundo' });
      expect(result.speech.updates).toContainEqual({ final: true, text: 'ola mundo' });
    });

    await test.step('mocked AI', async () => {
      await gotoNewProject(page);
      const result = await page.evaluate(evaluateMockedAiContract);

      expect(result).toMatchObject({
        detectedSpanish: 'es',
        eraserMaskId: 'asset-1-mask',
        maskScore: 0.9,
        paletteName: 'Brand',
        removedAssetId: 'asset-generated-neon-launch-card-transparent',
        smartGrabWidth: 0.8,
        translatedText: '[pt] selection',
      });
      expect(result.backgroundProgress.at(-1)).toBe(100);
    });

    await test.step('sample project, progress, mutation utilities, and PPTX logger', async () => {
      await gotoNewProject(page);
      const sampleProject = await page.evaluate(evaluateSampleProjectContract);
      expect(sampleProject).toMatchObject({
        blankBackground: { color: '#050D10', type: 'color' },
        blankElementCount: 0,
        blankName: 'Untitled Project',
        sampleTitle: 'AI Design Revolution',
      });
      expect(sampleProject.sampleAssetUrl).toContain('encrypted-tbn0.gstatic.com');
      expect(sampleProject.sampleElementIds).toEqual(['image-hero', 'text-subtitle', 'text-title']);

      await gotoNewProject(page);
      const progress = await page.evaluate(evaluateProgressContract);
      expect(progress.remainingMs).toBe(3000);
      expect(progress.progressValues.at(0)).toBe(12);
      expect(progress.progressValues.at(-1)).toBe(100);

      await gotoNewProject(page);
      const mutation = await page.evaluate(
        evaluateProjectMutationUtilsContract,
        mirrorFileContractProject.createProject(),
      );
      expect(mutation.touchedName).toBe('Mirror Contract');
      expect(Date.parse(mutation.timestamp)).not.toBeNaN();
      expect(Date.parse(mutation.touchedUpdatedAt)).not.toBeNaN();

      await gotoNewProject(page);
      const logger = await page.evaluate(evaluatePptxImportLoggerContract);
      expect(logger.logs).toEqual(
        expect.arrayContaining([
          expect.stringContaining('[LocalStudio PPTX Import]'),
          expect.stringContaining('bad pptx'),
          expect.stringContaining('ObjectError'),
          expect.stringContaining('plain error'),
        ]),
      );
    });

    await test.step('mirror files and movie controls', async () => {
      const mirror = await mirrorFileContractRuntimePage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
      );
      expect(mirror).toMatchObject({
        mirroredAssetIds: ['asset-unreadable', 'asset-used'],
        mirroredProjectAssetStorage: 'file',
        mirroredProjectUnreadableObjectUrl: 'https://example.test/unreadable.png',
      });
      expect(mirror.manifest).toMatchObject({
        projectId: 'project-mirror-contract',
        projectName: 'Mirror Contract',
        publicBaseUrl: 'https://cdn.example.test/public',
        schemaVersion: 1,
        syncedAt: '2026-07-09T12:34:00.000Z',
      });
      expect(mirror.mirrorFilePaths).toEqual(
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

      const movie = await movieControlsContractPage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
      );
      expect(movie).toMatchObject({
        consumedBuild: true,
        endTime: 12,
        fastForwardRate: 2,
        movieStarted: true,
        startTime: 2,
      });
    });
  });

  test('executes model and storage service contracts in the browser runtime', async ({ page }) => {
    await test.step('model downloads', async () => {
      const baseURL = serviceContractsSupport.getServer().baseURL;
      const download = await modelDownloadContractPage.runDownloadContract(page, baseURL);
      expect(download).toMatchObject({
        imageEditingState: { progress: 100, status: 'ready' },
        imageGenerationState: { progress: 100, status: 'ready' },
        languageState: { progress: 100, status: 'ready' },
        llmState: { progress: 100, status: 'ready' },
        translationState: { progress: 100, status: 'ready' },
      });
      expect(download.modelLoads).toEqual(
        expect.arrayContaining(['image-editing', 'image-generation', expect.stringMatching(/^text:/)]),
      );
      expect(download.storageWrites).toEqual(
        expect.arrayContaining([expect.stringMatching(/:true$/)]),
      );

      const removal = await modelDownloadContractPage.runRemovalContract(page, baseURL);
      expect(removal).toMatchObject({
        removedImageEditing: { progress: 0, status: 'needs-download' },
        removedImageGeneration: { progress: 0, status: 'needs-download' },
        removedLlm: { progress: 0, status: 'needs-download' },
        removedTranslation: { progress: 0, status: 'needs-download' },
      });
      expect(removal.modelLoads).toEqual(
        expect.arrayContaining(['remove-image-editing', expect.stringMatching(/^delete:/)]),
      );

      const failure = await modelDownloadContractPage.runFailureContract(page, baseURL);
      expect(failure.failedState).toMatchObject({
        error: 'image editing failed',
        progress: 0,
        status: 'failed',
      });
    });

    await test.step('model readiness', async () => {
      await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);
      const inMemory = await page.evaluate(evaluateModelInMemoryContract);
      expect(inMemory.readyCount).toBeGreaterThan(0);
      expect(inMemory.removed).toMatchObject({ progress: 0, status: 'needs-download' });

      await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);
      const readiness = await page.evaluate(evaluateModelReadinessContract);
      expect(readiness.initiallyReady).toBeGreaterThanOrEqual(4);
    });

    await test.step('storage contracts', async () => {
      const storage = await storageContractRuntimePage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
      );
      expect(storage).toMatchObject({
        historyCount: 1,
        loadedAssetStorage: 'file',
        loadedFontStorage: 'file',
        loadedName: 'File Contract',
        loadedVersionName: 'File Contract v2',
        missingVersion: null,
      });
      expect(storage.persistedKeys).toEqual(
        expect.arrayContaining([
          expect.stringContaining('File Contract/project.json'),
          expect.stringContaining('File Contract/config/localstudio.json'),
          expect.stringContaining('File Contract/assets/asset-kept.png'),
          expect.stringContaining('File Contract/fonts/inter.woff2'),
          expect.stringContaining('File Contract v2/history/manifest.json'),
          expect.stringContaining('File Contract v2/history/versions/'),
        ]),
      );
      expect(storage.savedHandles).toEqual(
        expect.arrayContaining([expect.stringContaining('File Contract')]),
      );
      expect(storage.versionSummary).toContain('edits');

      await gotoNewProject(page);
      const disabled = await page.evaluate(
        evaluateStorageDisabledContract,
        createStorageContractProject(),
      );
      expect(disabled).toEqual({
        disabledLoad: null,
        permissionError:
          'LocalStudio.dev needs permission to read and write the selected project folder.',
      });

      await installFakeOpfs(page, { directoryPicker: true });
      await gotoNewProject(page);
      const mirror = await page.evaluate(
        evaluateStorageMirrorImportContract,
        createMirrorStorageContractProject(),
      );
      expect(mirror).toMatchObject({ importedName: 'Mirrored Contract' });
      expect(mirror.importedAssetObjectUrl).toContain('blob:');
      expect(mirror.persistedKeys).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Mirrored Contract/project.json'),
          expect.stringContaining('Mirrored Contract/assets/asset-kept.png'),
        ]),
      );
      expect(mirror.savedHandles).toEqual(
        expect.arrayContaining([expect.stringContaining('Mirrored Contract')]),
      );
    });
  });

  test('executes transformers and image runtime service contracts in the browser runtime', async ({
    page,
  }) => {
    await test.step('bonsai runtime', async () => {
      const result = await bonsaiRuntimeContractPage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
      );

      expect(result).toMatchObject({
        bonsaiBlobText: 'image:coverage image',
        bonsaiRequests: ['preload', 'generate'],
        bonsaiSteps: ['1/2'],
        fallbackBonsaiBlobText: 'fallback image',
      });
      expect(result.bonsaiProgress).toContain(60);
    });

    await test.step('transformers extraction and runtime workers', async () => {
      await modelRuntimeContractPage.gotoReady(page, serviceContractsSupport.getServer().baseURL);
      const extraction = await page.evaluate(evaluateTransformersExtractionContract);
      expect(extraction).toMatchObject({
        detectedFromNested: { language: 'fr', score: 0.66 },
        extractedNestedText: 'nested assistant text',
      });
      expect(extraction.textExtractionErrors).toEqual([
        'WebGPU text generation did not return text.',
        'Language detection model did not return a language label.',
      ]);

      const baseURL = serviceContractsSupport.getServer().baseURL;
      const text = await transformersRuntimeContractPage.runTextWorkerContract(page, baseURL);
      expect(text).toMatchObject({
        generatedText: 'generated:hello',
        requests: [
          'preload-text-generation',
          'generate-text',
          'release-text-generation',
          'remove-text-generation',
        ],
      });
      expect(text.progressEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
      );

      const language = await transformersRuntimeContractPage.runLanguageWorkerContract(page, baseURL);
      expect(language).toMatchObject({
        detectedLanguage: { language: 'es', score: 0.92 },
        requests: ['preload-language-detection', 'detect-language'],
      });
      expect(language.progressEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
      );

      const image = await transformersRuntimeContractPage.runImageEditingWorkerContract(
        page,
        baseURL,
      );
      expect(image).toMatchObject({
        requests: [
          'preload-image-editing',
          'prepare-background-removal',
          'segment-background-removal',
          'remove-image-editing',
        ],
        segmentationScore: 0.87,
      });
      expect(image.progressEvents).toEqual(
        expect.arrayContaining([expect.objectContaining({ progress: 50 })]),
      );
    });

    await test.step('transformers fallback runtime', async () => {
      const baseURL = serviceContractsSupport.getServer().baseURL;
      const fallbackText = await transformersFallbackContractPage.runFallbackTextContract(
        page,
        baseURL,
      );
      expect(fallbackText).toMatchObject({ text: 'fallback text' });
      expect(fallbackText.calls).toEqual([
        'preload-text:fallback-llm',
        'generate:fallback prompt',
        'release:fallback-llm',
        'remove:fallback-llm',
      ]);

      const fallbackLanguage = await transformersFallbackContractPage.runFallbackLanguageContract(
        page,
        baseURL,
      );
      expect(fallbackLanguage).toMatchObject({ language: { language: 'pt', score: 0.77 } });
      expect(fallbackLanguage.calls).toEqual(['preload-language:fallback-lang', 'detect:ola']);

      const fallbackImage = await transformersFallbackContractPage.runFallbackImageContract(
        page,
        baseURL,
      );
      expect(fallbackImage).toMatchObject({ segmentationScore: 1 });
      expect(fallbackImage.calls).toEqual([
        'preload-image-editing',
        'prepare:asset://fallback',
        'segment:asset://fallback:1',
        'remove-image-editing',
      ]);

      const fallbackWrapper = await transformersFallbackContractPage.runFallbackWrapperContract(
        page,
        baseURL,
      );
      expect(fallbackWrapper).toMatchObject({
        language: { language: 'pt', score: 0.77 },
        text: 'fallback text',
      });
      expect(fallbackWrapper.calls).toEqual([
        'preload-text:runtime-llm',
        'release:runtime-llm',
        'generate:runtime prompt',
        'remove:runtime-llm',
        'preload-language:runtime-lang',
        'detect:runtime text',
      ]);
    });
  });

  test('executes presenter service contracts in the browser runtime', async ({ page }) => {
    await test.step('presenter logging and options', async () => {
      await gotoNewProject(page);
      const logging = await page.evaluate(evaluatePresenterLoggingContract, {
        presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
      });
      expect(logging.logs).toEqual(
        expect.arrayContaining([
          expect.stringContaining('info:[LocalStudio presenter remote]|enabled'),
          expect.stringContaining('warn:[LocalStudio presenter remote]|object|{"ok":true}'),
          expect.stringContaining('error:[LocalStudio presenter remote]|failure|TypeError: bad stream'),
          expect.stringContaining('warn:[LocalStudio presenter remote]|circular|[object Object]'),
        ]),
      );
      expect(logging.logs).not.toEqual(
        expect.arrayContaining([expect.stringContaining('info:[LocalStudio presenter remote]|ready')]),
      );

      await gotoNewProject(page);
      const options = await page.evaluate(evaluatePresenterOptionsContract, {
        presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
      });
      expect(options).toEqual({
        missingPeerOptions: undefined,
        peerOptions: { host: 'localhost', path: '/peerjs', port: 9000, secure: false },
        timers: ['00:00', '01:05', '01:01:01'],
      });
    });

    await test.step('presenter protocol and peer transport', async () => {
      await gotoNewProject(page);
      const protocol = await page.evaluate(evaluatePresenterProtocolValidatorContract, {
        commands: createPresenterProtocolCommands(),
        presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
        preview: createPresenterProtocolPreview(),
        state: createPresenterProtocolState(),
      });
      expect(protocol).toMatchObject({
        invalidCommand: false,
        invalidPreviewBatch: false,
        invalidSession: false,
        invalidState: false,
        previewBatch: true,
        session: true,
        state: true,
      });
      expect(protocol.commandResults).toEqual(serviceContractsSupport.commandsAllTrue);

      const peerTransport = await presenterSignalingContractPage.run(
        page,
        serviceContractsSupport.getServer().baseURL,
        evaluatePresenterPeerTransportContract,
        {
          presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
          testSupportSourceRoot: serviceContractsSupport.testSupportSourceRoot,
        },
      );
      expect(peerTransport.clientStatuses).toEqual(['connecting', 'connected', 'failed']);
      expect(peerTransport.commandCount).toBe(1);
      expect(peerTransport.destroyedPeerCount).toBe(4);
      expect(peerTransport.hostClosed).toBe(true);
      expect(peerTransport.hostOpenCount).toBe(1);
      expect(peerTransport.previewBatchCount).toBe(1);
      expect(peerTransport.publisherAnsweredCall).toBe(true);
      expect(peerTransport.receiverStatuses.slice(0, 2)).toEqual(['connecting', 'connected']);
      expect(peerTransport.receiverStatuses.filter((status) => status === 'failed')).toHaveLength(
        2,
      );
      expect(peerTransport.requestStateSent).toBe(true);
      expect(peerTransport.sentCommandFailed).toBe(true);
      expect(peerTransport.sentCommandSucceeded).toBe(true);
      expect(peerTransport.stateCount).toBe(1);
      expect(peerTransport.streamPeerId).toBe('publisher-peer');
      expect(peerTransport.timeoutMessage).toBe('transport timeout');
    });

    await test.step('presenter session and signaling lifecycle', async () => {
      const baseURL = serviceContractsSupport.getServer().baseURL;
      const session = await presenterSignalingContractPage.run(
        page,
        baseURL,
        evaluatePresenterSessionServiceContract,
        {
          editorSourceRoot: serviceContractsSupport.editorSourceRoot,
          testSupportSourceRoot: serviceContractsSupport.testSupportSourceRoot,
        },
      );
      expect(session).toMatchObject({
        blockedStatus: 'blocked',
        duplicateSessionReused: true,
        hostCloseCount: 1,
        hostOpenCount: 1,
        openedPopupHrefIncludesPresenter: true,
        openedStatus: 'opened',
        popupClosed: true,
        remoteSession: {
          controlPeerId: 'peer-control-1',
          qrUrl: 'https://remote.localstudio.test/joystick/?peer=peer-control-1',
          transport: 'peerjs',
        },
      });
      expect(session.commandNames).toEqual([
        'update-notes',
        'go-to-page',
        'pause-timer',
        'next',
        'update-stream-peer',
        'go-to-page',
        'next',
      ]);
      expect(session.hostPreviewBatchCount).toBeGreaterThan(0);
      expect(session.hostStateCount).toBeGreaterThanOrEqual(4);
      expect(session.popupCommandCount).toBe(1);
      expect(session.popupStateCount).toBeGreaterThanOrEqual(2);

      const expiry = await presenterSignalingContractPage.run(
        page,
        baseURL,
        evaluatePresenterSignalingExpiryContract,
        { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
      );
      expect(expiry).toMatchObject({
        activeAfterExpiryCount: 0,
        lookupAfterExpiry: undefined,
      });

      const signalingSession = await presenterSignalingContractPage.run(
        page,
        baseURL,
        evaluatePresenterSignalingSessionContract,
        { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
      );
      expect(signalingSession).toMatchObject({
        connectedCount: 1,
        controllerClosed: true,
        lookupCode: 'ABCD-1234',
        missingConnection: undefined,
        missingControllerClosed: false,
        sessionAfterControllerClose: { connectedControllerCount: 0 },
        sessionClosed: true,
        sessionClosedAgain: false,
        singleActiveCode: 'ABCD-1234',
      });

      const signalingState = await presenterSignalingContractPage.run(
        page,
        baseURL,
        evaluatePresenterSignalingStateContract,
        { presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot },
      );
      expect(signalingState).toMatchObject({
        anonymousCommandPublished: true,
        commandPublished: true,
        drainedCommands: [],
        statePublished: true,
        untrustedCommandPublished: false,
      });
      expect(signalingState.commands.map((command) => command.type)).toEqual([
        'go-to-slide',
        'previous-slide',
      ]);
      expect(signalingState.publishedState).toMatchObject({
        connectedControllerCount: 1,
        notes: 'Remember the close',
        slideTitle: 'Intro',
      });
    });

    await test.step('presenter WebRTC signaling', async () => {
      const options = {
        baseURL: serviceContractsSupport.getServer().baseURL,
        presenterRemoteSourceRoot: serviceContractsSupport.presenterRemoteSourceRoot,
      };
      const offer = await presenterSignalingWebRtcContractPage.runOffer(page, options);
      expect(offer).toMatchObject({
        missingOffer: { status: 'not-found' },
        trustedOffer: { status: 'pending' },
        untrustedOffer: { status: 'not-found' },
      });
      expect(offer.pendingOffers).toEqual([{ controllerId: 'controller-1', offerSdp: 'offer-sdp' }]);

      const answer = await presenterSignalingWebRtcContractPage.runAnswer(page, options);
      expect(answer).toMatchObject({
        answer: 'answer-sdp',
        answerPublished: true,
        missingAnswerPublished: false,
      });

      const ice = await presenterSignalingWebRtcContractPage.runIce(page, options);
      expect(ice).toMatchObject({
        controllerIcePublished: true,
        drainedCandidates: [],
        missingIce: false,
        presenterIcePublished: true,
      });
      expect(ice.controllerCandidates).toEqual([{ candidate: 'presenter-candidate' }]);
      expect(ice.presenterCandidates).toEqual([{ candidate: 'controller-candidate' }]);
    });
  });

  test('executes WebMCP service contracts in the browser runtime', async ({ page }) => {
    const baseURL = serviceContractsSupport.getServer().baseURL;

    const metadata = await webMcpContractPage.run(
      page,
      baseURL,
      evaluateWebMcpToolAdapterMetadataContract,
    );
    expect(metadata.toolNames).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
    expect(metadata.toolDescriptions.join('\n')).toContain('Good prompt examples');

    const execution = await webMcpContractPage.run(
      page,
      baseURL,
      evaluateWebMcpToolAdapterExecutionContract,
    );
    expect(execution).toMatchObject({
      createProjectBlank: { data: { name: 'Untitled' }, ok: true },
      createProjectNamed: { data: { name: 'WebMCP Deck' }, ok: true },
      generatedImage: { data: { assetId: 'asset-generated' }, ok: true },
      generatedSlides: { data: { prompt: 'Create a launch slide' }, ok: true },
      snapshot: { data: { pageCount: 1 }, ok: true },
      translated: { data: { scope: 'slide' }, ok: true },
      translatedWithoutPage: { data: { scope: 'deck' }, ok: true },
    });
    expect(execution.controllerCalls.map((call) => call.name)).toEqual([
      'createProject',
      'createProject',
      'generateSlides',
      'generateImage',
      'translateText',
      'translateText',
      'getProjectSnapshot',
    ]);

    const registration = await webMcpContractPage.run(
      page,
      baseURL,
      evaluateWebMcpToolAdapterRegistrationContract,
    );
    expect(registration.registeredNames).toEqual([
      'create_project',
      'generate_slides',
      'generate_image',
      'translate_text',
      'get_project_snapshot',
    ]);
    expect(registration.individuallyRegisteredNames).toEqual(registration.registeredNames);
  });
});
