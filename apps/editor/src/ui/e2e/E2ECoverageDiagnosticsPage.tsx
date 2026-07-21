/* eslint-disable react-hooks/refs, @typescript-eslint/require-await, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-return, @typescript-eslint/unbound-method, @typescript-eslint/no-this-alias, @typescript-eslint/no-floating-promises, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions */
import { useEffect, useMemo, useRef, useState } from 'react';
import { pptxPackagePatcher } from '../../services/exporting/pptxPackagePatcher';
import { progress } from '../../services/model-setup/progress';
import { transformersResultParsing } from '../../services/model-setup/transformersResultParsing';
import { slideLayoutPresets } from '../../services/prompting/slideLayoutPresets';
import { createProjectForSelectedShareRecording } from '../editor/shell/createProjectForSelectedShareRecording';
import { PowerPointFontReplacementDialog } from '../editor/shell/PowerPointFontReplacementDialog';
import { presenterRemoteStateFactory } from '../../services/presenter/presenterRemoteStateFactory';
import { PresenterAudioRecorder } from '../../services/transcription/presenterAudioRecorder';
import { PresenterSpeechTranscriber } from '../../services/transcription/presenterSpeechTranscriber';
import type {
  GeneratedSlideElement,
  GeneratedSlideTask,
  GeneratedSlideTasksDocument,
} from '../../domain/generated-slides/generatedSlide';
import { generatedSlide } from '../../domain/generated-slides/generatedSlide';
import type { ProjectDocument } from '../../domain/documents/model';
import { editorAutomationController } from '../../services/automation/editorAutomationController';
import { BrowserPresenterSessionService } from '../../services/presenter/presenterSessionService';
import { BrowserFileSystemProjectRepository } from '../../services/storage/browserFileSystemProjectRepository';
import { DisabledProjectRepository } from '../../services/storage/disabledProjectRepository';
import { OpfsProjectRepository } from '../../services/storage/opfsProjectRepository';
import { animationPresetEngine } from '../editor/animation/animationPresetEngine';
import { WebMcpToolAdapter } from '../../services/webmcp/webMcpToolAdapter';
import { aiModelCatalog } from '../../services/model-setup/aiModelCatalog';
import { imageGenerationModel } from '../../services/image-generation/imageGenerationModel';
import { bonsaiImageRuntime } from '../../services/image-generation/bonsaiImageRuntime';
import { modelSetupService } from '../../services/model-setup/modelSetupService';
import { TransformersRuntimeClient } from '../../services/model-setup/transformersRuntimeClient';
import { BrowserBackgroundRemovalService } from '../../services/background-removal/browserBackgroundRemovalService';
import { BrowserShareService } from '../../services/sharing/shareService';
import { minioMirrorService } from '../../services/mirror/minioMirrorService';
import { BrowserLocalFontMirrorService } from '../../services/fonts/localFontMirrorService';
import { BrowserPptxExportService } from '../../services/exporting/pptxExportService';
import { pptxPackage } from '../../services/importing/pptx/pptxPackage';
import { pptxParser } from '../../services/importing/pptx/pptxParser';
import { slideLayoutCommands } from '../../domain/commands/elements/slide-layout-commands';
import { elementStructureCommands } from '../../domain/commands/elements/element-structure-commands';
import { mediaElementCommands } from '../../domain/commands/elements/media-element-commands';
import { shapeLineDraw } from '../editor/canvas/shape-line-draw';
import { movieStartPlayback } from '../editor/media/movieStartPlayback';
import { createAppServices } from '../../app/composition';
import { useEditorViewModel } from '../editor/state/useEditorViewModel';
import { MirrorSettingsPanel } from '../editor/panels/MirrorSettingsPanel';
import { RemoteImportPanel } from '../editor/panels/RemoteImportPanel';
import { EditorMobileUnavailable } from '../editor/shell/EditorMobileUnavailable';
import { EditorShell } from '../editor/shell/EditorShell';
import { SpeakerNotesEditor } from '../editor/shell/SpeakerNotesEditor';
import { editorImageExport } from '../editor/shell/editor-image-export';
import { SharePanel } from '../share/SharePanel';
import { PublicDeckViewer } from '../share/PublicDeckViewer';
import { preloadPublicDeckAssets } from '../share/publicDeckAssetPreloader';
import { DeckTranslationControl } from '../editor/toolbars/DeckTranslationControl';
import { TRANSLATION_LANGUAGE_OPTIONS } from '../editor/translation/translationLanguages';

const minimalPptxPackageBase64 =
  'UEsDBBQAAAAIAHN/6Vwvs4W/qAAAADUBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QSw7CMAxErxJli9oUFixQPwvgBlwgCmkbkZ9iU5Xb47SsKmBpj59n7LqbnWWTTmCCb/i+rHjX1rdX1MBI8dDwETGehAA1aiehDFF7UvqQnEQq0yCiVA85aHGoqqNQwaP2WGDewdv6onv5tMiuM7VXF8I5O69z2arhMkZrlESSRVbFVy5pC3/Ayd836YpPspLIZQZGE2H32yH6YWNgXL4s94kQy2PaN1BLAwQUAAAACABzf+lcxai+J0sAAABWAAAAFAAAAHBwdC9wcmVzZW50YXRpb24ueG1ssymwKihKLU7NK0ksyczPU6jIzckrtiqwVcooKSmw0tcvTs5IzU0s1ssvSM0DyqXlF+UmlgC5Ren6yPpyc/SNDAzM9HMTM/OU9O0AUEsDBBQAAAAIAHN/6VzkAO1e6QAAAN0BAAAVAAAAcHB0L3NsaWRlcy9zbGlkZTEueG1sjVDLTsMwEPyVyHdwQcAhSnJCSFxQpPIDrr1JVvJjtTaln48dNwKqHnraWXtmZ2c7aqM1zclZH1vqxZIStVJGvYBT8T4Q+Pw3BXYq5ZZnSQwRfFIJg3dWPu52L9Ip9OI8RN0yxLD6Rj9f0/Mt+jBNqOE16C+Xd6lDGOy6VFyQohhyMr23ptRInwxQEKEuxR9H1COvnI/jyA2aXjyJxisHvUCnZrh7EHLo5D/uwSK9obVDp1bccAvuAFnL72bj/5Jyc/aLVF33dGn6vJkmOKU/npWZYZGupUbIcEuV0OUTFhSsqbrtqQgy6QdQSwMEFAAAAAgAc3/pXENyEzaeAAAAcgEAACAAAABwcHQvc2xpZGVzL19yZWxzL3NsaWRlMS54bWwucmVsc62QMQ7CMAxFr1LlAHFbIQZEO7F0RVwgStw0ok6sJCC4PQEWKnVg6Ohv6f2nfzzjrLILPk2OU/Wg2adOTDnzASDpCUklGRh9+YwhksrljBZY6auyCG1d7yH+MkS/YFaD6UQcTCOqy5PxH3YYR6fxFPSN0OeVCnBUugtQRYu5E1ICoXHqmzeSvRWwrtFuqXF3BsOKxidvJPHurQGLifsXUEsDBBQAAAAIAHN/6VwdgLxVBQAAAAMAAAAUAAAAcHB0L21lZGlhL2ltYWdlMS5wbmdjZGIGAFBLAwQUAAAACABzf+lcviBcbAUAAAADAAAAFAAAAHBwdC9tZWRpYS92aWRlbzEubXA0Y2FlAwBQSwECFAAUAAAACABzf+lcL7OFv6gAAAA1AQAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIAHN/6VzFqL4nSwAAAFYAAAAUAAAAAAAAAAAAAAAAANkAAABwcHQvcHJlc2VudGF0aW9uLnhtbFBLAQIUABQAAAAIAHN/6VzkAO1e6QAAAN0BAAAVAAAAAAAAAAAAAAAAAFYBAABwcHQvc2xpZGVzL3NsaWRlMS54bWxQSwECFAAUAAAACABzf+lcQ3ITNp4AAAByAQAAIAAAAAAAAAAAAAAAAAByAgAAcHB0L3NsaWRlcy9fcmVscy9zbGlkZTEueG1sLnJlbHNQSwECFAAUAAAACABzf+lcHYC8VQUAAAADAAAAFAAAAAAAAAAAAAAAAABOAwAAcHB0L21lZGlhL2ltYWdlMS5wbmdQSwECFAAUAAAACABzf+lcviBcbAUAAAADAAAAFAAAAAAAAAAAAAAAAACFAwAAcHB0L21lZGlhL3ZpZGVvMS5tcDRQSwUGAAAAAAYABgCYAQAAvAMAAAAA';

function createTextElement(id: string, text = 'Demo'): GeneratedSlideElement {
  return {
    align: 'left',
    fill: '#FFFFFF',
    fontFamily: 'Open Sans',
    fontSize: 36,
    fontWeight: 400,
    height: 80,
    id,
    opacity: 1,
    rotation: 0,
    text,
    type: 'text' as const,
    width: 320,
    x: 0,
    y: 0,
  };
}

function createSlideDocument(
  tasks: Array<Record<string, unknown>>,
  name = 'Coverage',
): GeneratedSlideTasksDocument {
  return {
    language: 'en',
    page: { background: { color: '#111827', type: 'color' as const }, height: 1080 as const, name, width: 1920 as const },
    tasks: tasks as GeneratedSlideTask[],
  };
}

export function E2ECoverageDiagnosticsPage() {
  const [result, setResult] = useState('running');
  const [dialogOpen, setDialogOpen] = useState(true);

  useEffect(() => {
    let mounted = true;
    void runDiagnostics().then((nextResult) => {
      if (mounted) setResult(nextResult);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main aria-label="E2E coverage diagnostics">
      {dialogOpen ? (
        <PowerPointFontReplacementDialog
          downloadableFonts={[
            { family: 'Inter', source: 'google-fonts' },
            {
              aliases: ['Roboto Condensed'],
              family: 'Roboto',
              source: 'google-fonts',
            },
          ]}
          missingFonts={[
            { family: 'Aptos', fontWeights: [400, 700] },
            { family: 'Calibri', fontWeights: [400] },
          ]}
          onClose={() => setDialogOpen(false)}
          onReplaceFont={async () => undefined}
        />
      ) : null}
      {dialogOpen ? null : (
        <>
          <EditorViewModelDiagnostics />
          <EditorViewModelSequentialDiagnostics />
          <EditorViewModelPersistenceDiagnostics />
          <E2EDiagnosticsComponentGallery />
        </>
      )}
      <output aria-label="Diagnostics result">{result}</output>
    </main>
  );
}

function E2EDiagnosticsComponentGallery() {
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [mirrorOpen, setMirrorOpen] = useState(true);
  const [localFontsEnabled, setLocalFontsEnabled] = useState(true);
  const [deckTranslationMenuOpen, setDeckTranslationMenuOpen] = useState(true);
  const [deckTranslationSourceLanguage, setDeckTranslationSourceLanguage] = useState('en');
  const [deckTranslationTargetLanguage, setDeckTranslationTargetLanguage] = useState('pt');
  const [shellDiagnostics, setShellDiagnostics] = useState('pending');
  const [shareCopyMode, setShareCopyMode] = useState<'fail' | 'ready'>('fail');
  const [panelsVisible, setPanelsVisible] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [notesPage, setNotesPage] = useState(
    () =>
      ({
        ...(createCommandDiagnosticProject().pages[0] as ProjectDocument['pages'][number]),
        speakerNotes: 'Diagnostics notes',
      }) as ProjectDocument['pages'][number],
  );
  const deckTranslationMenuRef = useRef<HTMLDivElement>(null);
  const publicProject = useMemo(() => createPublicDeckDiagnosticProject(), []);
  const publicProjectWithoutRecording = useMemo(
    () =>
      ({
        ...createPublicDeckDiagnosticProject(),
        id: 'public-diagnostic-project-no-recording',
        name: 'Public Diagnostic No Recording',
        recordings: {},
      }) as ProjectDocument,
    [],
  );
  const publicProjectWithoutSlides = useMemo(
    () =>
      ({
        ...createPublicDeckDiagnosticProject(),
        id: 'public-diagnostic-project-empty',
        name: 'Public Diagnostic Empty',
        pages: [],
        recordings: {},
      }) as ProjectDocument,
    [],
  );
  const shellServices = useMemo(
    () => createDiagnosticAppServices() as unknown as ReturnType<typeof createAppServices>,
    [],
  );
  const shareService = useMemo(
    () =>
      ({
        createShare: async () => createDiagnosticShareMetadata('diagnostic-share'),
        getEmbedHtml: () => '<iframe title="Diagnostic"></iframe>',
        getEmbedUrl: () => 'https://localstudio.test/editor/?embed=diagnostic-share',
        getProjectShareMetadata: () => createDiagnosticShareMetadata('diagnostic-share'),
        getPublicUrl: () => 'https://localstudio.test/editor/?share=diagnostic-share',
        getShare: async (shareId: string) => {
          if (shareId === 'diagnostic-share-missing') return undefined;
          const project =
            shareId === 'diagnostic-share-no-recording'
              ? publicProjectWithoutRecording
              : shareId === 'diagnostic-share-empty'
                ? publicProjectWithoutSlides
                : publicProject;
          return {
            createdAt: '2026-07-20T00:00:00.000Z',
            project: project as ProjectDocument,
            shareId,
            updatedAt: '2026-07-20T00:00:00.000Z',
          };
        },
        updateShare: async () => createDiagnosticShareMetadata('diagnostic-share'),
      }) as never,
    [publicProject, publicProjectWithoutRecording, publicProjectWithoutSlides],
  );
  const fontImportService = useMemo(
    () =>
      ({
        listDownloadableFonts: () => [],
        loadProjectFonts: async () => undefined,
      }) as never,
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));

    async function driveEditorShellEvents() {
      await nextFrame();
      const dispatchKey = (key: string, init: KeyboardEventInit = {}) => {
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key,
            ...init,
          }),
        );
      };
      dispatchKey('a', { metaKey: true });
      await nextFrame();
      const clipboardData = new DataTransfer();
      window.dispatchEvent(
        new ClipboardEvent('copy', {
          bubbles: true,
          cancelable: true,
          clipboardData,
        }),
      );
      window.dispatchEvent(
        new ClipboardEvent('cut', {
          bubbles: true,
          cancelable: true,
          clipboardData,
        }),
      );
      await nextFrame();
      window.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData,
        }),
      );
      dispatchKey('z', { metaKey: true });
      dispatchKey('z', { metaKey: true, shiftKey: true });
      dispatchKey('Delete');
      if (!cancelled) setShellDiagnostics('done');
    }

    void driveEditorShellEvents().catch((error) => {
      if (!cancelled) {
        setShellDiagnostics(error instanceof Error ? error.message : 'shell diagnostics failed');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Diagnostics component gallery">
      <output aria-label="Editor shell diagnostics">{shellDiagnostics}</output>
      <DeckTranslationControl
        canTranslateDeck
        deckTranslationStatus="Translating diagnostics · 1/3"
        isMenuOpen={deckTranslationMenuOpen}
        isTranslatingDeck
        menuRef={deckTranslationMenuRef}
        translationLanguageOptions={TRANSLATION_LANGUAGE_OPTIONS.slice(0, 4)}
        translationSourceLanguage={deckTranslationSourceLanguage}
        translationTargetLanguage={deckTranslationTargetLanguage}
        onMenuOpenChange={setDeckTranslationMenuOpen}
        onTranslateDeck={() => setDeckTranslationTargetLanguage('es')}
        onTranslationSourceLanguageChange={setDeckTranslationSourceLanguage}
        onTranslationTargetLanguageChange={setDeckTranslationTargetLanguage}
      />
      <EditorMobileUnavailable />
      <button type="button" aria-label="Hide diagnostics panels" onClick={() => setPanelsVisible(false)}>
        Hide diagnostics panels
      </button>
      {panelsVisible ? (
        <>
      <RemoteImportPanel
        error="Remote failed"
        projects={[]}
        status="failed"
        onClose={() => undefined}
        onImportProject={() => undefined}
      />
      <RemoteImportPanel
        projects={[]}
        status="loading"
        onClose={() => undefined}
        onImportProject={() => undefined}
      />
      <RemoteImportPanel
        projects={[]}
        status="empty"
        onClose={() => undefined}
        onImportProject={() => undefined}
      />
      <RemoteImportPanel
        projects={[
          {
            id: 'remote-a',
            name: 'Remote A',
            syncedAt: '2026-07-20T00:00:00.000Z',
          },
          {
            id: 'remote-b',
            name: 'Remote B',
            syncedAt: 'not-a-date',
          },
        ]}
        status="ready"
        onClose={() => setShellDiagnostics('remote-close')}
        onDeleteProject={(projectId) => setShellDiagnostics(`delete:${projectId}`)}
        onImportProject={(projectId) => setShellDiagnostics(`import:${projectId}`)}
      />
      <SharePanel
        projectName="Diagnostics Share"
        publicLinkUnavailableReason={shareCopyMode === 'fail' ? 'Configure the mirror first.' : undefined}
        recordingOptions={[
          { id: 'recording-a', label: 'Recording A', segmentCount: 2 },
          { id: 'recording-b', label: 'Recording B', segmentCount: 4 },
        ]}
        share={
          shareCopyMode === 'ready'
            ? createDiagnosticShareMetadata('diagnostic-visible-share')
            : {
                ...createDiagnosticShareMetadata('diagnostic-syncing-share'),
                status: 'syncing',
              }
        }
        shareProgressLabel={shareCopyMode === 'ready' ? undefined : 'Preparing public link'}
        onClose={() => setShellDiagnostics('share-close')}
        onConfigurePublicLink={() => setShareCopyMode('ready')}
        onCopyLink={async (recordingId) => ({
          ...createDiagnosticShareMetadata(`diagnostic-${recordingId ?? 'none'}`),
          status: 'copied',
        })}
        onDownload={() => setShellDiagnostics('share-download')}
        onPresent={() => setShellDiagnostics('share-present')}
      />
      <SharePanel
        projectName="Diagnostics Share Failed"
        onClose={() => undefined}
        onCopyLink={async () => {
          throw new Error('Share failed');
        }}
        onDownload={() => undefined}
        onPresent={() => undefined}
      />
      <SpeakerNotesEditor
        open={notesOpen}
        page={notesPage}
        pageIndex={2}
        onClose={() => setNotesOpen(false)}
        onUpdateNotes={(pageId, notes) =>
          setNotesPage((current) => ({
            ...current,
            id: pageId,
            speakerNotes: notes,
          }))
        }
      />
      <SpeakerNotesEditor
        open={false}
        page={notesPage}
        pageIndex={0}
        onClose={() => undefined}
        onUpdateNotes={() => undefined}
      />
        </>
      ) : null}
      {mirrorOpen ? (
        <MirrorSettingsPanel
          config={{
            accessKey: 'localstudio-writer',
            bucket: 'localstudio',
            endpoint: 'https://s3.localstudio.test/',
            pathStyle: true,
            prefix: 'diagnostics',
            publicBaseUrl: '',
            readerAccessKey: 'localstudio-reader',
            readerSecretKey: 'reader-secret',
            region: '',
            secretKey: 'writer-secret',
            writerAccessKey: 'localstudio-writer',
            writerSecretKey: 'writer-secret',
          }}
          localFontMirrorSettings={{
            enabled: localFontsEnabled,
            folderLabel: 'Local Fonts',
            supported: true,
            systemHint: '~/Library/Fonts',
          }}
          localFontOptions={[
            { family: 'Inter', source: 'local-font-folder' },
            { family: 'Orbitron', source: 'local-font-folder' },
          ]}
          mirrorState={{
            enabled: mirrorEnabled,
            status: mirrorEnabled ? 'synced' : 'idle',
          }}
          onChooseLocalFontFolder={async () => {
            setLocalFontsEnabled(true);
          }}
          onClose={() => setMirrorOpen(false)}
          onEnabledChange={(enabled) => setMirrorEnabled(enabled)}
          onLocalFontMirrorEnabledChange={setLocalFontsEnabled}
          onSave={() => undefined}
          onTestConnection={async (_config, options) => {
            options?.onProgress?.({
              label: 'Checking diagnostics bucket',
              stage: 'verifying-mirrored-fonts',
            });
            return 'Diagnostics connection warning';
          }}
        />
      ) : null}
      <PublicDeckViewer
        fontImportService={fontImportService}
        shareId="diagnostic-share"
        shareService={shareService}
      />
      <PublicDeckViewer
        fontImportService={fontImportService}
        shareId="diagnostic-share-no-recording"
        shareService={shareService}
      />
      <PublicDeckViewer
        fontImportService={fontImportService}
        shareId="diagnostic-share-missing"
        shareService={shareService}
      />
      <PublicDeckViewer
        fontImportService={fontImportService}
        shareId="diagnostic-share-empty"
        shareService={shareService}
      />
      <div aria-hidden="true" className="e2e-hidden-editor-shell">
        <EditorShell services={shellServices} />
      </div>
    </section>
  );
}

function createDiagnosticShareMetadata(shareId: string) {
  return {
    createdAt: '2026-07-20T00:00:00.000Z',
    embedHtml: '<iframe title="Diagnostic"></iframe>',
    embedUrl: `https://localstudio.test/editor/?embed=${shareId}`,
    publicUrl: `https://localstudio.test/editor/?share=${shareId}`,
    shareId,
    status: 'published' as const,
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

type DiagnosticAppServicesOptions = {
  projectRepository?: unknown;
  skipStoredProjectLoad?: boolean;
  storedProjectName?: string;
};

function createDiagnosticAppServices(options: DiagnosticAppServicesOptions = {}) {
  const baseProject = createCommandDiagnosticProject() as ProjectDocument;
  const versionProject = {
    ...baseProject,
    name: 'Diagnostics Version',
    updatedAt: '2026-07-20T00:05:00.000Z',
  };
  const versionEntry = {
    authorName: 'Diagnostics',
    changeCount: 1,
    createdAt: '2026-07-20T00:00:00.000Z',
    fileName: 'version-1.json',
    firstChangedElementId: 'text-1',
    firstChangedPageId: 'page-1',
    id: 'version-1',
    projectName: versionProject.name,
    summary: 'Diagnostics version',
  };
  const readyModel = {
    id: 'diagnostic-model',
    label: 'Diagnostic Model',
    description: 'Browser diagnostics model.',
    progress: 100,
    provider: 'transformers' as const,
    required: true,
    status: 'ready' as const,
  };
  const imageReadyModel = {
    ...readyModel,
    id: imageGenerationModel.IMAGE_GENERATION_MODEL_ID,
    label: 'Image generation diagnostics',
  };
  const promptReadyModel = {
    ...readyModel,
    id: aiModelCatalog.GEMMA_LLM_MODEL_ID,
    label: 'Prompt diagnostics',
  };
  const translationReadyModel = {
    ...readyModel,
    id: aiModelCatalog.TRANSLATEGEMMA_MODEL_ID,
    label: 'Translation diagnostics',
  };
  const languageReadyModel = {
    ...readyModel,
    id: aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID,
    label: 'Language diagnostics',
  };
  const modelStates = [readyModel, imageReadyModel, promptReadyModel, translationReadyModel, languageReadyModel];
  const promptProviders = [
    {
      capability: 'prompt' as const,
      compatibility: 'compatible' as const,
      description: 'Diagnostics prompt provider.',
      id: 'diagnostic-prompt',
      label: 'Diagnostic prompt',
      modelId: readyModel.id,
      readiness: 'ready' as const,
      runtime: 'webgpu-huggingface' as const,
      selected: true,
    },
  ];
  const translationProviders = [
    {
      capability: 'translation' as const,
      compatibility: 'compatible' as const,
      description: 'Diagnostics translation provider.',
      id: 'diagnostic-translation',
      label: 'Diagnostic translation',
      modelId: readyModel.id,
      readiness: 'ready' as const,
      runtime: 'webgpu-huggingface' as const,
      selected: true,
    },
  ];
  const languageProviders = [
    {
      capability: 'language-detection' as const,
      compatibility: 'compatible' as const,
      description: 'Diagnostics language provider.',
      id: 'diagnostic-language',
      label: 'Diagnostic language',
      modelId: readyModel.id,
      readiness: 'ready' as const,
      runtime: 'webgpu-huggingface' as const,
      selected: true,
    },
  ];
  const services = createAppServices({
    initialProject: baseProject,
    skipStoredProjectLoad: options.skipStoredProjectLoad ?? true,
  });

  return {
    ...services,
    persistenceAvailable: true,
    persistenceMode: 'directory' as const,
    storedProjectName: options.storedProjectName,
    projectRepository: options.projectRepository ?? {
      getVersionHistory: async () => [versionEntry],
      importProject: async () => ({
        ...versionProject,
        name: 'Imported Diagnostics Project',
        updatedAt: '2026-07-20T00:06:00.000Z',
      }),
      importMirrorFiles: async () => versionProject,
      loadProject: async () => baseProject,
      loadVersion: async () => versionProject,
      saveProject: async () => undefined,
      saveProjectAs: async () => undefined,
      saveVersion: async () => versionEntry,
    },
    mirrorService: {
      clearConfig: () => undefined,
      deleteProject: async () => undefined,
      downloadProject: async () => [
        {
          blob: new Blob([JSON.stringify(versionProject)], { type: 'application/json' }),
          path: 'project.json',
        },
      ],
      getPublicObjectUrl: (key: string) => `https://cdn.localstudio.test/${key}`,
      listProjects: async () => [
        {
          id: 'mirror-project',
          name: 'Mirror Project',
          syncedAt: '2026-07-20T00:00:00.000Z',
        },
      ],
      loadConfig: () => null,
      saveConfig: () => undefined,
      syncProject: async () => ({
        enabled: true,
        lastSyncedAt: '2026-07-20T00:00:00.000Z',
        status: 'synced' as const,
      }),
      uploadPublicObject: async () => undefined,
    },
    localFontMirrorService: {
      chooseFontFolder: async () => ({
        enabled: true,
        folderLabel: 'Diagnostics Fonts',
        supported: true,
        systemHint: '~/Library/Fonts',
      }),
      getSettings: () => ({
        enabled: true,
        folderLabel: 'Diagnostics Fonts',
        supported: true,
        systemHint: '~/Library/Fonts',
      }),
      getTestFontFiles: async () => [],
      importFontFamily: async (project: ProjectDocument) => ({
        addedFonts: [],
        project,
        unresolvedFamilies: [],
        warnings: [],
      }),
      importProjectFonts: async (project: ProjectDocument) => ({
        addedFonts: [],
        project,
        unresolvedFamilies: [],
        warnings: [],
      }),
      listAvailableFonts: async () => [{ family: 'Inter', source: 'local-font-folder' as const }],
      setEnabled: (enabled: boolean) => ({
        enabled,
        folderLabel: enabled ? 'Diagnostics Fonts' : undefined,
        supported: true,
        systemHint: '~/Library/Fonts',
      }),
      validateTestFontFiles: async () => ({}),
    },
    modelSetupService: {
      downloadModel: async (_id: string, options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(100);
        return readyModel;
      },
      downloadRequiredModels: async () => modelStates,
      getModelStates: async () => modelStates,
      removeModel: async (id: string) => ({ ...readyModel, id, progress: 0, status: 'needs-download' as const }),
    },
    promptService: {
      checkAvailability: async () => 'ready' as const,
      generateSlideElementFromTask: async (task: never) => {
        if ((task as { type: string }).type === 'add-placeholder-image') {
          return {
            assetRole: 'placeholder',
            height: 320,
            id: 'generated-image',
            opacity: 1,
            rotation: 0,
            type: 'image' as const,
            width: 480,
            x: 120,
            y: 260,
          };
        }
        return createTextElement('generated-text', 'Generated diagnostics text');
      },
      generateSlideTasksFromPrompt: async () =>
        createSlideDocument([
          { id: 'generated-title', placementHint: '', text: 'Generated diagnostics', type: 'add-title' },
          { id: 'generated-body', placementHint: '', text: 'Coverage path', type: 'add-body-text' },
        ]),
      getProviderStates: async () => promptProviders,
      getSelectedProviderId: () => 'diagnostic-prompt',
      preparePromptApi: async (options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(100);
      },
      setSelectedProvider: async () => promptProviders,
    },
    translatorService: {
      detectLanguage: async () => 'en',
      getLanguageDetectionProviderStates: async () => languageProviders,
      getProviderStates: async () => translationProviders,
      getSelectedProviderId: () => 'diagnostic-translation',
      prepareLanguageDetection: async (options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(100);
      },
      prepareTranslation: async (_source: string, _target: string, options?: { onProgress?: (progress: number) => void }) => {
        options?.onProgress?.(100);
      },
      setLanguageDetectionProvider: async () => languageProviders,
      setSelectedProvider: async () => translationProviders,
      translate: async (text: string, targetLanguage: string) => `[${targetLanguage}] ${text}`,
    },
    imageGenerationService: {
      generateImage: async (_prompt: string, options?: { onProgress?: (state: { label: string; progress: number }) => void }) => {
        options?.onProgress?.({ label: 'Diagnostics', progress: 100 });
        return {
          id: 'generated-image-asset',
          mimeType: 'image/png',
          name: 'Generated diagnostics image',
          objectUrl: 'data:image/png;base64,aW1hZ2U=',
          type: 'image' as const,
        };
      },
    },
    presentationImportService: {
      importPowerPoint: async () => ({
        ...baseProject,
        importWarnings: [
          {
            code: 'font-missing',
            message: 'Aptos is missing.',
            severity: 'warning' as const,
          },
        ],
        name: 'Imported Diagnostics',
      }),
    },
    presentationExportService: {
      exportPowerPoint: async (_project: ProjectDocument, options?: { onProgress?: (progress: { detail?: string; progress: number; stage: string; title: string }) => void }) => {
        options?.onProgress?.({
          detail: 'Diagnostics export',
          progress: 100,
          stage: 'writing',
          title: 'Exporting',
        });
        return {
          blob: new Blob(['pptx'], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }),
          warnings: [],
        };
      },
    },
    exportService: {
      downloadDataUrl: () => undefined,
      downloadBlob: () => undefined,
      getImagesArchiveFileName: () => 'diagnostic-images.zip',
      getPageImageFileName: () => 'diagnostic.png',
      getPdfFileName: () => 'diagnostic.pdf',
      getPowerPointFileName: () => 'diagnostic.pptx',
    },
    fontImportService: {
      listDownloadableFonts: () => [{ family: 'Inter', source: 'google-fonts' as const }],
      loadProjectFonts: async () => undefined,
      resolveAndDownloadFonts: async () => ({
        fonts: {},
        resolutions: [],
        warnings: [],
      }),
    },
  };
}

function EditorViewModelDiagnostics() {
  const services = useMemo(
    () => createDiagnosticAppServices() as unknown as ReturnType<typeof createAppServices>,
    [],
  );
  const viewModel = useEditorViewModel(services);
  const ranRef = useRef(false);
  const [summary, setSummary] = useState('pending');

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void runEditorViewModelDiagnostic(viewModel)
      .then((result) => setSummary(JSON.stringify(result)))
      .catch((error) =>
        setSummary(error instanceof Error ? error.message : 'view model diagnostic failed'),
      );
  }, [viewModel]);

  return <output aria-label="Editor view model diagnostics">{summary}</output>;
}

function EditorViewModelSequentialDiagnostics() {
  const services = useMemo(
    () => createDiagnosticAppServices() as unknown as ReturnType<typeof createAppServices>,
    [],
  );
  const viewModel = useEditorViewModel(services);
  const viewModelRef = useRef(viewModel);
  const ranRef = useRef(false);
  const [summary, setSummary] = useState('pending');
  viewModelRef.current = viewModel;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));
    const current = () => viewModelRef.current;

    async function run() {
      current().setProjectName('Sequential Diagnostics Deck');
      await nextFrame();
      current().setPersistence(false);
      await nextFrame();
      current().addPage();
      await nextFrame();
      const addedPageId = current().project.pages.at(-1)?.id;
      if (addedPageId) {
        current().renamePage(addedPageId, 'Sequential slide');
        current().selectPage(addedPageId);
        current().activateScrolledPage(addedPageId);
        current().updatePageSpeakerNotes(addedPageId, 'Sequential notes');
      }
      await nextFrame();
      current().duplicatePage(current().activePageId);
      await nextFrame();
      current().reorderPage(current().activePageId, 0);
      current().setPageVisibility(current().activePageId, false);
      await nextFrame();
      current().setPageVisibility(current().activePageId, true);
      current().insertTextElement('subtitle');
      await nextFrame();
      const insertedTextId = current().selection.elementIds[0];
      if (insertedTextId) {
        current().updateTextContent(insertedTextId, 'Sequential diagnostics text');
        current().updateElementStyle(insertedTextId, {
          fill: '#37FD76',
          fontFamily: 'Inter',
          fontSize: 48,
        });
        current().duplicateSelectedElement();
        await nextFrame();
        current().cutSelectedElements();
        await nextFrame();
        current().pasteCopiedElements();
      }
      await nextFrame();
      current().selectElement('image-1');
      await nextFrame();
      await current().generateImageFromPrompt('Replace the selected image with a diagnostics card', {
        height: 768,
        seed: 7,
        steps: 6,
        width: 1024,
      }).catch(() => undefined);
      await nextFrame();
      current().clearSelection();
      await current().generateImageFromPrompt('Create a standalone diagnostics image', {
        height: 512,
        seed: 11,
        steps: 4,
        width: 512,
      }).catch(() => undefined);
      await nextFrame();
      await current().generateSlideFromPrompt('Create a cinematic AI image background').catch(() => undefined);
      await current().generateSlideFromPrompt('Create a browser AI architecture slide').catch(() => undefined);
      await nextFrame();
      current().selectAllElementsOnActivePage();
      await nextFrame();
      await current().translateSelectedText().catch(() => undefined);
      await current().translateDeck().catch(() => undefined);
      const firstPageId = current().project.pages[0]?.id;
      if (firstPageId) {
        await current().translatePage(firstPageId).catch(() => undefined);
      }
      await nextFrame();
      current().toggleBackgroundSelectionMode();
      await nextFrame();
      current().previewBackgroundSubject('image-1', { x: 180, y: 120 });
      current().refineBackgroundSubject('image-1', { x: 220, y: 180 });
      await current().pickBackgroundSubject('image-1', { x: 220, y: 180 }).catch(() => undefined);
      current().cancelBackgroundSelectionMode();
      await nextFrame();
      current().selectElement('video-1');
      await nextFrame();
      await current()
        .replaceVideoAsset(
          'video-1',
          new File(['video-bytes'], 'replacement.webm', { type: 'video/webm' }),
        )
        .catch(() => undefined);
      current().clearMediaImportProgress();
      current().removeAsset('asset-missing');
      await nextFrame();
      await current().setPersistence(true);
      await current().saveLocalNow().catch(() => undefined);
      await current().saveLocalAs().catch(() => undefined);
      current().closeLocalProjectSetup();
      await nextFrame();
      current().setHighlightVersionChanges(false);
      await current().openVersionHistory().catch(() => undefined);
      await nextFrame();
      current().closeVersionHistory();
      current().undo();
      await nextFrame();
      current().redo();

      setSummary(
        JSON.stringify({
          activePageId: current().activePageId,
          canRedo: current().canRedo,
          canUndo: current().canUndo,
          pages: current().project.pages.length,
          selection: current().selection.elementIds.length,
        }),
      );
    }

    void run().catch((error) =>
      setSummary(error instanceof Error ? error.message : 'sequential diagnostic failed'),
    );
  }, []);

  return <output aria-label="Sequential view model diagnostics">{summary}</output>;
}

function EditorViewModelPersistenceDiagnostics() {
  const savedRepositoryCalls = useRef<string[]>([]);
  const savedProject = useMemo(
    () =>
      ({
        ...(createCommandDiagnosticProject() as ProjectDocument),
        name: 'Loaded Diagnostics Project',
        updatedAt: '2026-07-20T01:00:00.000Z',
      }) as ProjectDocument,
    [],
  );
  const savedServices = useMemo(
    () =>
      createDiagnosticAppServices({
        skipStoredProjectLoad: false,
        storedProjectName: 'Loaded Diagnostics Project',
        projectRepository: {
          getVersionHistory: async () => [],
          loadProject: async () => {
            savedRepositoryCalls.current.push('load');
            return savedProject;
          },
          saveProject: async () => {
            savedRepositoryCalls.current.push('save');
          },
          saveVersion: async () => ({
            authorName: 'Diagnostics',
            changeCount: 1,
            createdAt: '2026-07-20T01:01:00.000Z',
            fileName: 'autosave.json',
            firstChangedPageId: savedProject.pages[0]?.id,
            id: 'autosave',
            projectName: savedProject.name,
            summary: 'Autosave',
          }),
        },
      }) as unknown as ReturnType<typeof createAppServices>,
    [savedProject],
  );
  const emptyServices = useMemo(
    () =>
      createDiagnosticAppServices({
        skipStoredProjectLoad: false,
        projectRepository: {
          loadProject: async () => null,
          saveProject: async () => undefined,
        },
      }) as unknown as ReturnType<typeof createAppServices>,
    [],
  );
  const failingServices = useMemo(
    () =>
      createDiagnosticAppServices({
        skipStoredProjectLoad: false,
        projectRepository: {
          loadProject: async () => {
            throw new Error('load failed');
          },
          saveProject: async () => {
            throw new Error('save failed');
          },
        },
      }) as unknown as ReturnType<typeof createAppServices>,
    [],
  );
  const savedViewModel = useEditorViewModel(savedServices);
  const emptyViewModel = useEditorViewModel(emptyServices);
  const failingViewModel = useEditorViewModel(failingServices);
  const ranRef = useRef(false);
  const [summary, setSummary] = useState('pending');

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 0));

    async function run() {
      await nextFrame();
      savedViewModel.setProjectName('Loaded Diagnostics Autosave');
      await nextFrame();
      await savedViewModel.saveLocalNow().catch(() => undefined);
      emptyViewModel.setProjectName('Empty Diagnostics Autosave');
      failingViewModel.setProjectName('Failing Diagnostics Autosave');
      await nextFrame();
      await Promise.resolve(failingViewModel.setPersistence(true)).catch(() => false);
      await failingViewModel.saveLocalNow().catch(() => undefined);
      setSummary(
        JSON.stringify({
          emptyPersistence: emptyViewModel.persistenceEnabled,
          failingPersistence: failingViewModel.persistenceEnabled,
          savedCalls: savedRepositoryCalls.current,
          savedProject: savedViewModel.project.name,
        }),
      );
    }

    void run().catch((error) =>
      setSummary(error instanceof Error ? error.message : 'persistence diagnostic failed'),
    );
  }, [emptyViewModel, failingViewModel, savedViewModel]);

  return <output aria-label="Persistence view model diagnostics">{summary}</output>;
}

async function runEditorViewModelDiagnostic(
  viewModel: ReturnType<typeof useEditorViewModel>,
) {
  viewModel.setProjectName('Diagnostics Deck');
  viewModel.setActiveTab('text');
  viewModel.selectElement('text-1');
  viewModel.updateTextContent('text-1', 'Diagnostics title');
  viewModel.updateElementFrame('text-1', { height: 140, width: 640, x: 44, y: 56 });
  viewModel.updateElementStyle('text-1', {
    fill: '#37FD76',
    fontFamily: 'Inter',
    fontSize: 64,
    fontWeight: 700,
  });
  viewModel.selectAllElementsOnActivePage();
  viewModel.copySelectedElements();
  viewModel.pasteCopiedElements();
  viewModel.clearSelection();
  viewModel.selectSlideBackground();
  viewModel.updatePageBackground({ color: '#020617', type: 'color' });
  viewModel.selectPresentation();
  viewModel.addPage('page-1');
  viewModel.renamePage('page-1', 'Opening diagnostics');
  viewModel.updatePageSpeakerNotes('page-1', 'Presenter notes from diagnostics');
  viewModel.setPageVisibility('page-1', true);
  viewModel.duplicatePage('page-1');
  viewModel.reorderPage('page-1', 1);
  viewModel.togglePagesPanel();
  viewModel.zoomIn();
  viewModel.zoomOut();
  viewModel.resetZoom();
  viewModel.insertTextElement('subtitle');
  viewModel.insertShapeElement('rect');
  viewModel.selectElement('image-1');
  viewModel.flipSelectedImage();
  viewModel.updateImageCrop('image-1', {
    crop: { height: 0.6, width: 0.6, x: 0.2, y: 0.2 },
    height: 280,
    width: 360,
  });
  viewModel.selectElement('video-1');
  viewModel.updateMediaPlayback('video-1', {
    playbackPositionSeconds: 4,
    playing: true,
    trimEndSeconds: 20,
    trimStartSeconds: 2,
  });
  viewModel.setElementAnimationBuilds(['video-1'], {
    delayMs: 0,
    effect: 'reveal',
    mediaAction: 'play',
    trigger: 'on-click',
  });
  viewModel.playAnimationPreview('page-1');
  viewModel.advanceAnimationPreview();
  viewModel.clearAnimationPreview();
  viewModel.setPageTransition({ delayMs: 1000, durationMs: 500, effect: 'fade' });
  viewModel.clearPageTransition();
  viewModel.addTranscriptRecording({
    audio: {
      mimeType: 'audio/webm;codecs=opus',
      objectUrl: 'blob:view-model-recording',
      storage: 'inline',
    },
    createdAt: '2026-07-20T00:00:00.000Z',
    durationMs: 2_000,
    id: 'view-model-recording',
    language: 'en-US',
    modelPresetId: 'web-speech-api',
    name: 'View model recording',
    segments: [
      {
        endMs: 2_000,
        final: true,
        id: 'view-model-segment',
        pageId: 'page-1',
        pageIndex: 0,
        pageName: 'Opening diagnostics',
        startMs: 0,
        text: 'View model diagnostics transcript.',
      },
    ],
    updatedAt: '2026-07-20T00:00:00.000Z',
  });
  viewModel.openSettings();
  viewModel.closeSettings();
  viewModel.openMediaSettings();
  viewModel.closeMediaSettings();
  viewModel.openMirrorSettings();
  viewModel.closeMirrorSettings();
  viewModel.setLocalFontMirrorEnabled(true);
  await viewModel.chooseLocalFontMirrorFolder().catch(() => undefined);
  await viewModel.prepareProjectFontsForPublicShare({
    onProgress: () => undefined,
  }).catch(() => viewModel.project);
  const mirrorConfig = {
    accessKey: 'writer',
    bucket: 'localstudio',
    endpoint: 'https://s3.localstudio.test',
    pathStyle: true,
    prefix: 'diagnostics',
    publicBaseUrl: 'https://cdn.localstudio.test',
    region: 'us-east-1',
    secretKey: 'secret',
  };
  await viewModel.testMirrorConnection(mirrorConfig, { onProgress: () => undefined }).catch(() => undefined);
  viewModel.saveMirrorConfig(mirrorConfig);
  viewModel.setMirrorEnabledFromSettings(true, mirrorConfig);
  await viewModel.syncMirrorNow().catch(() => undefined);
  viewModel.requestMirrorNow();
  await viewModel.importRemoteMirror().catch(() => undefined);
  await viewModel.importRemoteMirrorProject('mirror-project').catch(() => undefined);
  await viewModel.deleteRemoteMirrorProject('mirror-project').catch(() => undefined);
  viewModel.closeRemoteImport();
  viewModel.setPersistence(false);
  await viewModel.confirmLocalProjectSetup('Diagnostics Local Project').catch(() => false);
  await viewModel.saveLocalAs().catch(() => undefined);
  await viewModel.saveLocalNow().catch(() => undefined);
  await viewModel.openVersionHistory().catch(() => undefined);
  await viewModel.selectVersion('version-1', {
    authorName: 'Diagnostics',
    changeCount: 1,
    createdAt: '2026-07-20T00:00:00.000Z',
    fileName: 'version-1.json',
    firstChangedElementId: 'text-1',
    firstChangedPageId: 'page-1',
    id: 'version-1',
    projectName: 'Version 1',
    summary: 'Diagnostics version',
  }).catch(() => undefined);
  await viewModel.restoreVersion('version-1').catch(() => undefined);
  viewModel.closeVersionHistory();
  await viewModel.downloadRequiredModels().catch(() => undefined);
  await viewModel.downloadModel('diagnostic-model').catch(() => undefined);
  await viewModel.removeModel('diagnostic-model').catch(() => undefined);
  await viewModel.preparePromptApi().catch(() => undefined);
  await viewModel.setPromptProvider('diagnostic-prompt').catch(() => undefined);
  await viewModel.setTranslationProvider('diagnostic-translation').catch(() => undefined);
  await viewModel.setLanguageDetectionProvider('diagnostic-language').catch(() => undefined);
  await viewModel.setTranslationTargetLanguage('pt').catch(() => undefined);
  await viewModel.setTranslationTargetLanguageForSource('pt', { sourceLanguage: 'en' }).catch(() => undefined);
  viewModel.setActiveSlideLanguage('es');
  await viewModel.translateCurrentSlide().catch(() => undefined);
  await viewModel.generateSlideFromPrompt('Create a diagnostics status slide').catch(() => undefined);
  await viewModel.generateImageFromPrompt('Create a diagnostics green browser card', {
    height: 512,
    seed: 42,
    steps: 8,
    width: 512,
  }).catch(() => undefined);
  viewModel.stopPromptGeneration();
  await viewModel.importPowerPoint({
    file: new File(['pptx'], 'diagnostic.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }),
  }).catch(() => undefined);
  viewModel.dismissMissingPowerPointFonts();
  await viewModel.replacePowerPointFont('Aptos', 'Inter').catch(() => undefined);
  viewModel.toggleSlideLayoutPlaceholder('missing-layout', 'title', false);
  await viewModel.importProject().catch(() => undefined);
  await viewModel.exportPowerPoint().catch(() => undefined);
  const automationSnapshot = viewModel.automation.getState();
  await viewModel.automation.generateImage({
    height: 640,
    prompt: 'Automation diagnostics image',
    seed: 13,
    steps: 5,
    width: 640,
  }).catch(() => undefined);
  await viewModel.automation.translateText({
    pageId: viewModel.activePageId,
    scope: 'slide',
    targetLanguage: 'pt',
  }).catch(() => undefined);
  await viewModel.automation.generateSlides({
    prompt: 'Automation diagnostics generated slides',
  }).catch(() => undefined);
  await viewModel.automation.createProject({ name: 'Automation Diagnostics Deck' }).catch(() => undefined);
  viewModel.undo();
  viewModel.redo();

  return {
    activeTab: viewModel.activeTab,
    automationPageId: automationSnapshot.selection.pageId,
    canUndo: viewModel.canUndo,
    pageCount: viewModel.project.pages.length,
    recordingCount: Object.keys(viewModel.project.recordings ?? {}).length,
    zoom: viewModel.zoomPercent,
  };
}

async function runDiagnostics() {
  const pptxBytes = Uint8Array.from(atob(minimalPptxPackageBase64), (character) => character.charCodeAt(0));
  const patched = pptxPackagePatcher.patchPackageBuffer(
    pptxBytes.buffer,
    [
      {
        animationBuilds: [
          {
            delayMs: -50,
            direction: 'left',
            durationMs: 400,
            effect: 'keyboard-typing',
            elementId: 'text-1',
            id: 'build-text',
            kind: 'build-in',
            trigger: 'on-click',
          },
          {
            delayMs: 0,
            effect: 'reveal',
            elementId: 'missing-element',
            id: 'build-missing',
            mediaAction: 'play',
            trigger: 'after-previous',
          },
        ],
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['image-1', 'text-1', 'missing-element'],
        height: 1080,
        id: 'page-1',
        name: 'Patch me',
        transition: { delayMs: 250, direction: 'left', durationMs: 700, effect: 'push', trigger: 'after-delay' },
        visible: true,
        width: 1920,
      },
      {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['ghost'],
        height: 1080,
        id: 'missing-slide',
        name: 'Missing slide',
        transition: { delayMs: 0, durationMs: -5, effect: 'orbit', trigger: 'on-click' },
        visible: true,
        width: 1920,
      },
    ] as never,
    [{ category: 'media', code: 'existing-warning', message: 'Existing warning.' }],
    [{ elements: [{ crop: { height: 0.7, width: 0.6, x: 0.1, y: 0.2 }, id: 'image-1' }], pageId: 'page-1' }],
  );

  const progressValues: number[] = [];
  const report = progress.createMonotonicProgressReporter((value) => progressValues.push(value), {
    initial: 10,
    max: 95,
    min: 5,
  });
  report(4);
  report(50);
  report(120);
  progress.createTransformersProgressCallback((value) => progressValues.push(value))({
    file: 'model.bin',
    loaded: 50,
    name: 'model',
    status: 'progress',
    total: 100,
  });

  const generated = transformersResultParsing.extractGeneratedText([
    { generated_text: [{ content: 'nested assistant text' }] },
  ]);
  const language = transformersResultParsing.extractDetectedLanguage([[{ label: 'pt', score: 0.93 }]]);
  const titleOnly = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([{ id: 'title', placementHint: '', text: 'Only title', type: 'add-title' }]),
    'make a title only slide',
  );
  const centered = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([], 'Fallback title'),
    'black background green title "Local AI" white subtitle "Runs here"',
  );
  const bullets = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([
      { description: 'Browser', id: 'hero-image', placementHint: 'left image', type: 'add-placeholder-image' },
      { id: 'title', placementHint: '', text: 'LocalStudio', type: 'add-title' },
      { id: 'one', placementHint: '', text: 'Overview privacy', type: 'add-body-text' },
    ]),
    'left image with three bullets - Fast - Private - Local',
  );
  const grid = slideLayoutPresets.normalizeSlideTasksForLayout(
    createSlideDocument([
      { description: 'One', id: 'grid-1', placementHint: 'grid image 1', type: 'add-placeholder-image' },
      { description: 'Two', id: 'grid-2', placementHint: 'grid image 2', type: 'add-placeholder-image' },
      { id: 'grid-title', placementHint: '', text: 'Grid', type: 'add-title' },
      { id: 'caption-1', placementHint: '', text: 'First', type: 'add-body-text' },
      { id: 'caption-2', placementHint: '', text: 'Second', type: 'add-body-text' },
    ]),
    'two-image grid with matching captions',
  );
  const hero = createSlideDocument([
    { description: 'Hero', id: 'hero-media', placementHint: 'left media block', type: 'add-placeholder-image' },
    { id: 'hero-title', placementHint: 'right text block', text: 'Hero', type: 'add-title' },
    { id: 'hero-subtitle', placementHint: 'right text block', text: 'Subtitle', type: 'add-subtitle' },
  ]);
  const layoutSamples = [
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('title'), {
      allTasks: titleOnly.tasks,
      page: titleOnly.page,
      task: titleOnly.tasks[0] as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('center'), {
      allTasks: centered.tasks,
      page: centered.page,
      task: centered.tasks.find((task) => task.type === 'add-title') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('bullet-title'), {
      allTasks: bullets.tasks,
      page: bullets.page,
      task: bullets.tasks.find((task) => task.type === 'add-title') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('grid-caption'), {
      allTasks: grid.tasks,
      page: grid.page,
      task: grid.tasks.find((task) => task.type === 'add-body-text') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset({
      assetRole: 'placeholder',
      height: 180,
      id: 'grid-1',
      opacity: 1,
      rotation: 0,
      type: 'image',
      width: 320,
      x: 0,
      y: 0,
    } as never, {
      allTasks: grid.tasks,
      page: grid.page,
      task: grid.tasks.find((task) => task.type === 'add-placeholder-image') as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset({
      assetRole: 'placeholder',
      height: 180,
      id: 'hero-media',
      opacity: 1,
      rotation: 0,
      type: 'image',
      width: 320,
      x: 0,
      y: 0,
    } as never, {
      allTasks: hero.tasks,
      page: hero.page,
      task: hero.tasks[0] as never,
    }),
    slideLayoutPresets.applySlideElementLayoutPreset(createTextElement('hero-title'), {
      allTasks: hero.tasks,
      page: hero.page,
      task: hero.tasks[1] as never,
    }),
  ];

  const remoteProject = createRemoteProject();
  const remotePayload = {
    activePageId: 'slide-1',
    animationPreview: {
      hiddenElementIds: ['title'],
      mode: 'presenter',
      pageId: 'slide-1',
      phase: 'active',
      playing: true,
    },
    presenterMode: 'presenting',
    project: remoteProject,
    streamPeerId: 'stream-peer',
  };
  const restoreRemotePreviewMedia = installRemotePreviewMediaDiagnostics();
  let remoteState: Awaited<ReturnType<typeof presenterRemoteStateFactory.createRemoteState>>;
  let batches: Awaited<ReturnType<typeof presenterRemoteStateFactory.createRemotePreviewBatches>>;
  try {
    remoteState = await presenterRemoteStateFactory.createRemoteState(remotePayload as never, 2, {
      elapsedMs: 2_500,
      paused: false,
      updatedAtEpochMs: 1_786_000_000_000,
    });
    batches = await presenterRemoteStateFactory.createRemotePreviewBatches(
      remotePayload as never,
      ['slide-1', 'slide-2', 'slide-3', 'missing'],
      'request-1',
    );
  } finally {
    restoreRemotePreviewMedia();
  }

  const recording = await runRecorderDiagnostic();
  const transcript = await runSpeechDiagnostic();
  const automation = await runAutomationDiagnostic();
  const presenterSession = await runPresenterSessionDiagnostic(remotePayload);
  const storage = await runStorageDiagnostic();
  const animation = runAnimationDiagnostic();
  const webmcp = await runWebMcpDiagnostic();
  const modelSetup = await runModelSetupDiagnostic();
  const transformersRuntime = await runTransformersRuntimeDiagnostic();
  const backgroundRemoval = await runBackgroundRemovalDiagnostic();
  const bonsaiRuntime = await runBonsaiRuntimeDiagnostic();
  const generatedSlideParsing = runGeneratedSlideParsingDiagnostic();
  const slideLayoutPresetCoverage = runSlideLayoutPresetDiagnostic();
  const progressUtilities = await runProgressUtilitiesDiagnostic();
  const pptxParsing = await runPptxParserDiagnostic();
  const pptxExport = await runPptxExportDiagnostic();
  const imageExportUtilities = await runImageExportDiagnostic();
  const publicPreload = await runPublicDeckAssetPreloadDiagnostic();
  const sharing = await runSharingDiagnostic();
  const localFonts = await runLocalFontMirrorDiagnostic();
  const commandUtilities = runCommandUtilitiesDiagnostic();
  const selectedProject = createProjectForSelectedShareRecording(createShareProject() as never, 'second');

  return JSON.stringify({
    generated,
    language,
    automation,
    animation,
    layoutCount: layoutSamples.length,
    patchedWarnings: patched.warnings.length,
    progressValues,
    recording,
    remote: {
      batches: batches.length,
      current: remoteState.activePageName,
      previews: remoteState.upcomingSlidePreviews?.length ?? 0,
    },
    selectedRecordings: Object.keys(selectedProject.recordings ?? {}),
    presenterSession,
    storage,
    webmcp,
    modelSetup,
    transformersRuntime,
    backgroundRemoval,
    bonsaiRuntime,
    generatedSlideParsing,
    slideLayoutPresetCoverage,
    progressUtilities,
    pptxParsing,
    pptxExport,
    imageExportUtilities,
    publicPreload,
    sharing,
    localFonts,
    commandUtilities,
    transcript,
  });
}

function runCommandUtilitiesDiagnostic() {
  let project = createCommandDiagnosticProject() as ProjectDocument;
  const layout = {
    elementIds: ['layout-title', 'layout-body'],
    elements: {
      'layout-title': {
        ...createTextElement('layout-title', 'Title placeholder'),
        align: 'center',
        height: 100,
        placeholderRole: 'title',
        templateSource: 'slide-layout',
        width: 1200,
        x: 360,
        y: 120,
      },
      'layout-body': {
        ...createTextElement('layout-body', 'Body placeholder'),
        fontSize: 30,
        height: 420,
        placeholderRole: 'body',
        templateSource: 'slide-layout',
        width: 960,
        x: 480,
        y: 320,
      },
    },
    id: 'layout-a',
    name: 'Title and body',
    placeholderVisibility: { body: true, title: true },
  };

  project = new slideLayoutCommands.SaveSlideLayoutCommand(layout as never).execute(project);
  project = new slideLayoutCommands.ToggleSlideLayoutPlaceholderVisibilityCommand(
    'layout-a',
    'body',
    false,
  ).execute(project);
  project = new slideLayoutCommands.ToggleSlideLayoutPlaceholderVisibilityCommand(
    'layout-a',
    'body',
    true,
  ).execute(project);
  project = new slideLayoutCommands.ApplySlideLayoutCommand('page-1', 'layout-a').execute(project);
  project = new slideLayoutCommands.EditSlideLayoutCommand({ ...layout, name: 'Edited layout' } as never).execute(project);

  project = new elementStructureCommands.AlignElementCommand(
    'page-1',
    'text-1',
    'page-center',
  ).execute(project);
  project = new elementStructureCommands.SetZOrderCommand('page-1', 'text-1', 'front').execute(project);
  project = new elementStructureCommands.SetZOrderCommand('page-1', 'text-1', 'back').execute(project);
  project = new elementStructureCommands.SetZOrderCommand('page-1', 'image-1', 'forward').execute(project);
  project = new elementStructureCommands.SetZOrderCommand('page-1', 'video-1', 'backward').execute(project);
  project = new elementStructureCommands.DuplicateElementCommand('page-1', 'text-1', 'text-copy').execute(project);
  project = new elementStructureCommands.ReorderElementCommand('page-1', 'text-copy', 1).execute(project);
  project = new elementStructureCommands.SetElementVisibilityCommand('text-copy', false).execute(project);
  project = new elementStructureCommands.SetElementLockCommand('text-copy', true).execute(project);
  project = new elementStructureCommands.DeleteElementCommand('page-1', 'text-copy').execute(project);

  const newImageAsset = {
    id: 'asset-new-image',
    mimeType: 'image/png',
    name: 'New image',
    objectUrl: 'blob:new-image',
    type: 'image',
  };
  project = new mediaElementCommands.AddImageElementCommand('page-1', {
    asset: newImageAsset,
    element: {
      assetId: newImageAsset.id,
      height: 180,
      id: 'image-added',
      locked: false,
      opacity: 1,
      rotation: 0,
      type: 'image',
      visible: true,
      width: 240,
      x: 80,
      y: 90,
    },
  } as never).execute(project);
  project = new mediaElementCommands.AddMediaElementCommand('page-1', {
    asset: { id: 'asset-gif', mimeType: 'image/gif', name: 'Gif', objectUrl: 'blob:gif', type: 'gif' },
    element: {
      assetId: 'asset-gif',
      autoplayInPreview: false,
      height: 160,
      id: 'gif-1',
      locked: false,
      loop: false,
      opacity: 1,
      playbackPositionSeconds: 0,
      playing: false,
      repeatMode: 'none',
      rotation: 0,
      type: 'gif',
      visible: true,
      width: 220,
      x: 120,
      y: 140,
    },
  } as never).execute(project);
  project = new mediaElementCommands.UpdateMediaPlaybackCommand('gif-1', {
    loop: true,
    muted: true,
    playbackPositionSeconds: 1,
    playing: true,
  } as never).execute(project);
  project = new mediaElementCommands.UpdateMediaPlaybackCommand('video-1', {
    playbackPositionSeconds: 12,
    playing: false,
    trimEndSeconds: undefined,
  } as never).execute(project);
  project = new mediaElementCommands.ReplaceImageAssetCommand('image-1', {
    id: 'asset-replacement',
    mimeType: 'image/png',
    name: 'Replacement',
    objectUrl: 'blob:replacement',
    type: 'image',
  } as never).execute(project);
  project = new mediaElementCommands.ReplaceVideoAssetCommand(
    'video-1',
    {
      id: 'asset-video-replacement',
      mimeType: 'video/mp4',
      name: 'Replacement video',
      objectUrl: 'blob:replacement-video',
      type: 'video',
    } as never,
    { durationSeconds: 42 },
  ).execute(project);
  project = new mediaElementCommands.ToggleImageFlipCommand('image-1').execute(project);
  project = new mediaElementCommands.UpdateImageCropCommand('image-1', {
    crop: { height: 0.6, width: 0.7, x: 0.1, y: 0.2 },
    height: 360,
    width: 480,
  } as never).execute(project);

  const linePoints = [
    shapeLineDraw.getPoints([0, 0, 100, 100], 0.25, 'start-to-end'),
    shapeLineDraw.getPoints([0, 0, 100, 100], 0.5, 'end-to-start'),
    shapeLineDraw.getPoints([0, 0, 100, 100], 0.75, 'middle-to-ends'),
  ];
  const lineDash = shapeLineDraw.getDash(120, 0.5, 'middle-to-ends');
  const lineState = shapeLineDraw.getState({
    activeBuild: {
      effect: 'line-draw',
      elementId: 'shape-1',
      id: 'build-line',
      lineDrawDirection: 'middle-to-ends',
      trigger: 'on-click',
    },
    progress: 0.5,
  } as never);

  const video = document.createElement('video');
  video.dataset.elementId = 'video-1';
  video.play = () => Promise.resolve();
  video.pause = () => undefined;
  const root = document.createElement('div');
  root.append(video);
  const movieStarted = movieStartPlayback.playPendingMovieStart(root, project, {
    activeBuildElementId: 'video-1',
    pageId: 'page-1',
    waitingForClick: true,
  } as never);
  const movieConsumed = movieStartPlayback.consumeStartedBuild(video, 'movie-build-1');
  const movieConsumedAfterSet = (() => {
    video.dataset.startedMovieBuildId = 'movie-build-1';
    return movieStartPlayback.consumeStartedBuild(video, 'movie-build-1');
  })();

  return {
    elementCount: Object.keys(project.elements).length,
    layoutName: project.slideLayouts?.['layout-a']?.name,
    lineDash: lineDash.dash.length,
    linePoints: linePoints.length,
    lineProgress: lineState.progress > 0,
    movieConsumed,
    movieConsumedAfterSet,
    movieStarted,
    pageElementCount: project.pages[0]?.elementIds.length ?? 0,
  };
}

async function runLocalFontMirrorDiagnostic() {
  const fontRoot = new E2EFakeDirectoryHandle('Fonts');
  fontRoot.addFile('Inter-Regular.woff2', new Blob(['font-bytes'], { type: 'font/woff2' }));
  fontRoot.addFile('Roboto-Bold.ttf', new Blob(['font-bytes'], { type: 'font/ttf' }));
  class FakeFontFace {
    constructor(
      readonly family: string,
      readonly source: string,
    ) {}
    async load() {
      return this;
    }
  }
  const service = new BrowserLocalFontMirrorService({
    createObjectURL: (blob) => `blob:font-${blob instanceof Blob ? blob.size : 0}`,
    fontDirectoryHandle: fontRoot as never,
    fontFaceConstructor: FakeFontFace as never,
    now: () => new Date('2026-07-20T00:00:00.000Z'),
    showDirectoryPicker: async () => fontRoot as never,
  });
  service.setEnabled(true);
  await service.chooseFontFolder();
  const available = await service.listAvailableFonts();
  const importedFamily = await service.importFontFamily(createAutomationProject() as never, {
    family: 'Inter',
    fontStyle: 'normal',
    fontWeight: 400,
  });
  const importedProject = await service.importProjectFonts(createAutomationProject() as never);
  const testFiles = await service.getTestFontFiles();
  const validation = await service.validateTestFontFiles(testFiles);
  service.setEnabled(false);
  const disabledAvailable = await service.listAvailableFonts();
  const disabledImport = await service.importFontFamily(createAutomationProject() as never, {
    family: 'Orbitron',
    fontStyle: 'normal',
    fontWeight: 800,
  });
  const unsupportedService = new BrowserLocalFontMirrorService({
    createObjectURL: () => 'blob:unsupported-font',
    showDirectoryPicker: undefined,
  });
  const unsupportedMessage = await unsupportedService
    .chooseFontFolder()
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));
  const deniedService = new BrowserLocalFontMirrorService({
    createObjectURL: () => 'blob:denied-font',
    fontDirectoryHandle: new E2EDeniedDirectoryHandle('Denied Fonts') as never,
    showDirectoryPicker: async () => new E2EDeniedDirectoryHandle('Denied Fonts') as never,
  });
  deniedService.setEnabled(true);
  const deniedFiles = await deniedService.getTestFontFiles();
  const emptyValidation = await service.validateTestFontFiles([]);
  class FailingFontFace {
    constructor(
      readonly family: string,
      readonly source: string,
    ) {}
    async load() {
      throw new Error('font failed');
    }
  }
  const failingValidation = await new BrowserLocalFontMirrorService({
    createObjectURL: () => 'blob:failing-font',
    fontDirectoryHandle: fontRoot as never,
    fontFaceConstructor: FailingFontFace as never,
    showDirectoryPicker: async () => fontRoot as never,
  }).validateTestFontFiles(testFiles);
  const missingFamily = await new BrowserLocalFontMirrorService({
    createObjectURL: () => 'blob:missing-font',
    fontDirectoryHandle: fontRoot as never,
    showDirectoryPicker: async () => fontRoot as never,
  }).importFontFamily(createAutomationProject() as never, {
    family: 'Missing',
    fontStyle: 'normal',
    fontWeight: 300,
  });

  return {
    available: available.map((font) => font.family),
    deniedFiles: deniedFiles.length,
    disabledAvailable: disabledAvailable.length,
    disabledWarnings: disabledImport.warnings.map((warning) => warning.code),
    emptyValidation,
    failingValidation,
    importedFamily: importedFamily.addedFonts.length,
    importedProject: importedProject.addedFonts.length,
    missingWarnings: missingFamily.warnings.map((warning) => warning.code),
    unsupportedMessage,
    validation,
  };
}

async function runSharingDiagnostic() {
  const config = {
    accessKey: 'writer',
    bucket: 'localstudio',
    endpoint: 'https://s3.localstudio.test',
    pathStyle: true,
    prefix: 'diag',
    publicBaseUrl: 'https://cdn.localstudio.test',
    region: 'us-east-1',
    secretKey: 'secret',
  };
  const uploadedKeys: string[] = [];
  const mirrorService = {
    getPublicObjectUrl: (key: string) => `https://cdn.localstudio.test/${key}`,
    loadConfig: () => config,
    uploadPublicObject: async (key: string) => {
      uploadedKeys.push(key);
    },
  };
  const shareService = new BrowserShareService({
    basePath: '/editor/',
    fetch: async () => new Response('asset-bytes'),
    mirrorService: mirrorService as never,
    origin: 'https://localstudio.test',
  });
  const project = createStorageDiagnosticProject();
  const metadata = await shareService.createShare(project as never);
  const updated = await shareService.updateShare('share-diagnostic', project as never);
  shareService.getEmbedHtml(metadata.shareId);
  shareService.getProjectShareMetadata(project as never);
  const minioCalls: string[] = [];
  const storage = new Map<string, string>();
  const minio = new minioMirrorService.MinioMirrorService({
    fetch: async (input, init) => {
      minioCalls.push(`${init?.method ?? 'GET'}:${String(input)}`);
      const url = String(input);
      if (url.includes('list-type=2')) {
        if (url.includes('continuation-token=page-2')) {
          return new Response(
            '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>diag/Storage Diagnostic/assets/asset-kept.png</Key></Contents></ListBucketResult>',
          );
        }
        return new Response(
          '<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>page-2</NextContinuationToken><Contents><Key>diag/Storage Diagnostic/localstudio-mirror.json</Key></Contents></ListBucketResult>',
        );
      }
      if (url.endsWith('localstudio-mirror.json')) {
        return new Response(
          JSON.stringify({
            schemaVersion: 1,
            projectId: project.id,
            projectName: project.name,
            publicBaseUrl: config.publicBaseUrl,
            syncedAt: '2026-07-20T00:00:00.000Z',
            files: {
              'project.json': {
                checksum: 'checksum-project',
                contentType: 'application/json',
                path: 'project.json',
                size: 2,
              },
            },
          }),
        );
      }
      if (url.endsWith('project.json')) return new Response('{}', { headers: { 'content-type': 'application/json' } });
      return new Response('', { status: 200 });
    },
    now: () => new Date('2026-07-20T00:00:00.000Z'),
    storage: {
      getItem: (key) => storage.get(key) ?? null,
      removeItem: (key) => {
        storage.delete(key);
      },
      setItem: (key, value) => {
        storage.set(key, value);
      },
    },
  });
  minio.saveConfig(config);
  const loadedConfig = minio.loadConfig();
  await minio.uploadPublicObject('diag/share.json', new Blob(['{}']), config);
  const listedProjects = await minio.listProjects(config).catch(() => []);
  const downloadedFiles = await minio.downloadProject('Storage Diagnostic', config).catch(() => []);
  await minio.deleteProject('Storage Diagnostic', config).catch(() => undefined);
  const publicObjectUrl = minio.getPublicObjectUrl('diag/share.json', config);
  minio.clearConfig();
  minio.saveConfig({
    bucket: config.bucket,
    pathStyle: config.pathStyle,
    prefix: config.prefix,
    region: config.region,
    accessKey: 'localstudio',
    endpoint: 'http://localhost:9000',
    publicBaseUrl: 'http://localhost:9000/localstudio',
    secretKey: 'localstudio123',
  });
  const legacyConfig = minio.loadConfig();
  const errorMinio = new minioMirrorService.MinioMirrorService({
    fetch: async (input) => {
      const url = String(input);
      if (url.includes('list-type=2')) return new Response('', { status: 403 });
      return new Response('', { status: 500 });
    },
    storage: {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => undefined,
    },
  });
  const listError = await errorMinio
    .listProjects(config)
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));
  const downloadError = await errorMinio
    .downloadProject('missing-project', config)
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));

  return {
    downloadedFiles: downloadedFiles.map((file) => file.path),
    legacyWriterAccessKey: legacyConfig?.writerAccessKey,
    listError,
    listedProjects: listedProjects.map((item) => item.id),
    loadedConfig: loadedConfig?.bucket,
    publicObjectUrl,
    downloadError,
    minioCalls: minioCalls.length,
    publicUrl: metadata.publicUrl,
    updatedUrl: updated.publicUrl,
    uploadedKeys,
  };
}

function runAnimationDiagnostic() {
  const bounds = { height: 180, width: 320, x: 10, y: 20 };
  const directions = ['left', 'right', 'up', 'down'] as const;
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
  const states = effects.map((effect, index) =>
    animationPresetEngine.getRenderState({
      bounds,
      direction: directions[index % directions.length],
      effect,
      progress: index % 3 === 0 ? 0 : index % 3 === 1 ? 0.45 : 1,
      seed: `seed-${effect}`,
    }),
  );
  const sideMasks = directions.map(
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
    masks: states.reduce((sum, state) => sum + state.masks.length, 0),
    particles: states.reduce((sum, state) => sum + state.particles.length, 0),
    sideMasks,
  };
}

async function runWebMcpDiagnostic() {
  const calls: string[] = [];
  const adapter = new WebMcpToolAdapter({
    createProject: (input?: Record<string, unknown>) => {
      calls.push(`create:${String(input?.name ?? '')}`);
      return Promise.resolve({ data: { name: String(input?.name ?? 'Untitled') }, ok: true });
    },
    generateImage: (input: Record<string, unknown>) => {
      calls.push(`image:${input.prompt}`);
      return Promise.resolve({ data: { assetId: 'asset-generated' }, ok: true });
    },
    generateSlides: (input: Record<string, unknown>) => {
      calls.push(`slides:${input.prompt}`);
      return Promise.resolve({ data: { prompt: input.prompt }, ok: true });
    },
    getProjectSnapshot: () => {
      calls.push('snapshot');
      return { data: { pageCount: 1 }, ok: true };
    },
    translateText: (input: Record<string, unknown>) => {
      calls.push(`translate:${input.scope}:${input.targetLanguage}`);
      return Promise.resolve({ data: { scope: input.scope }, ok: true });
    },
  } as never);
  const registeredNames: string[] = [];
  const unregister = adapter.register({
    registerTools: (tools) => registeredNames.push(...tools.map((tool) => tool.name)),
  });
  unregister();
  adapter.register({ registerTool: (tool) => registeredNames.push(tool.name) });
  const tools = adapter.createTools();
  await tools[0]!.execute({ name: 'WebMCP Deck' });
  await tools[0]!.execute({ name: 123 });
  await tools[1]!.execute({ prompt: 'Create a launch slide' });
  await tools[2]!.execute({ height: 512, prompt: 'neon card', seed: Number.NaN, steps: 8, width: 512 });
  await tools[3]!.execute({ pageId: 'page-1', scope: 'slide', targetLanguage: 'pt' });
  await tools[3]!.execute({ pageId: 5, scope: 'deck', targetLanguage: 'es' });
  await tools[4]!.execute({});
  return { calls, registeredNames };
}

async function runModelSetupDiagnostic() {
  const readyStorage = new Map<string, string>([
    [aiModelCatalog.GEMMA_LLM_READY_KEY, 'true'],
    [aiModelCatalog.TRANSLATEGEMMA_READY_KEY, 'true'],
    [aiModelCatalog.LANGUAGE_DETECTION_READY_KEY, 'true'],
    [imageGenerationModel.IMAGE_GENERATION_READY_KEY, 'true'],
  ]);
  const browserSetup = new modelSetupService.BrowserModelSetupService(
    undefined,
    {
      getItem: (key: string) => readyStorage.get(key) ?? null,
      removeItem: (key: string) => {
        readyStorage.delete(key);
      },
      setItem: (key: string, value: string) => {
        readyStorage.set(key, value);
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
  );
  const inMemorySetup = new modelSetupService.InMemoryModelSetupService();
  const required = await inMemorySetup.downloadRequiredModels();
  const removed = await inMemorySetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID);
  const storageWrites: string[] = [];
  const downloadStorage = new Map<string, string>();
  const downloadStorageAdapter = {
    getItem: (key: string) => downloadStorage.get(key) ?? null,
    removeItem: (key: string) => {
      storageWrites.push(`remove:${key}`);
      downloadStorage.delete(key);
    },
    setItem: (key: string, value: string) => {
      storageWrites.push(`${key}:${value}`);
      downloadStorage.set(key, value);
    },
  };
  const modelLoads: string[] = [];
  const fakeImageEditingLoader = {
    loadImageEditingModel: async (options?: { onProgress?: (progress: number, details?: { loadedBytes: number; totalBytes: number }) => void }) => {
      modelLoads.push('image-editing');
      options?.onProgress?.(75, { loadedBytes: 3, totalBytes: 4 });
    },
    removeImageEditingModel: async () => {
      modelLoads.push('remove-image-editing');
    },
  };
  const fakeImageGenerationLoader = {
    loadImageGenerationModel: async (options?: { onProgress?: (progress: number, details?: { loadedBytes: number; totalBytes: number }) => void }) => {
      modelLoads.push('image-generation');
      options?.onProgress?.(40, { loadedBytes: 2, totalBytes: 4 });
    },
  };
  const fakeTextGenerationLoader = {
    loadTextGenerationModel: async (modelId: string, options?: { onProgress?: (progress: number, details?: { loadedBytes: number; totalBytes: number }) => void }) => {
      modelLoads.push(`text:${modelId}`);
      options?.onProgress?.(55, { loadedBytes: 5, totalBytes: 10 });
    },
    releaseTextGenerationModel: async (modelId: string) => {
      modelLoads.push(`release:${modelId}`);
    },
    removeTextGenerationModel: async (modelId: string) => {
      modelLoads.push(`remove-text:${modelId}`);
    },
  };
  const fakeModelCache = {
    deleteModelArtifacts: async (modelId: string) => {
      modelLoads.push(`delete:${modelId}`);
    },
  };
  const fakeLanguageDetectionLoader = {
    loadLanguageDetectionModel: async (modelId: string, options?: { onProgress?: (progress: number, details?: { loadedBytes: number; totalBytes: number }) => void }) => {
      modelLoads.push(`language:${modelId}`);
      options?.onProgress?.(65, { loadedBytes: 6, totalBytes: 10 });
    },
  };
  const downloadSetup = new modelSetupService.BrowserModelSetupService(
    fakeImageEditingLoader,
    downloadStorageAdapter,
    fakeImageGenerationLoader,
    fakeTextGenerationLoader,
    fakeModelCache,
    fakeLanguageDetectionLoader,
  );
  const downloadedStates = [
    await downloadSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID),
    await downloadSetup.downloadModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
    await downloadSetup.downloadModel(aiModelCatalog.GEMMA_LLM_MODEL_ID),
    await downloadSetup.downloadModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID),
    await downloadSetup.downloadModel(aiModelCatalog.LANGUAGE_DETECTION_MODEL_ID),
  ];
  await downloadSetup.downloadRequiredModels();
  const removedStates = [
    await downloadSetup.removeModel(aiModelCatalog.GEMMA_LLM_MODEL_ID),
    await downloadSetup.removeModel(aiModelCatalog.TRANSLATEGEMMA_MODEL_ID),
    await downloadSetup.removeModel(modelSetupService.IMAGE_EDITING_MODEL_ID),
    await downloadSetup.removeModel(imageGenerationModel.IMAGE_GENERATION_MODEL_ID),
  ];
  const failingSetup = new modelSetupService.BrowserModelSetupService(
    {
      loadImageEditingModel: async () => {
        throw new Error('image editing failed');
      },
    },
    downloadStorageAdapter,
  );
  const failedState = await failingSetup.downloadModel(modelSetupService.IMAGE_EDITING_MODEL_ID);
  const unknownDownload = await downloadSetup.downloadModel('missing-model').catch((error: Error) => error.message);
  const unknownRemoval = await downloadSetup.removeModel('missing-model').catch((error: Error) => error.message);
  return {
    downloaded: downloadedStates.filter((state) => state.status === 'ready').length,
    failedState,
    modelLoads,
    ready: (await browserSetup.getModelStates()).filter((state) => state.status === 'ready').length,
    required: required.filter((state) => state.status === 'ready').length,
    removed,
    removedStates: removedStates.filter((state) => state.status === 'needs-download').length,
    storageWrites,
    unknownDownload,
    unknownRemoval,
  };
}

type DiagnosticWorkerResponse = { id: string; [key: string]: unknown };

class E2EFakeWorker {
  onerror: ((event: Event | ErrorEvent) => void) | null = null;
  onmessage: ((event: MessageEvent<DiagnosticWorkerResponse>) => void) | null = null;
  postCount = 0;
  terminated = false;

  constructor(
    private readonly responder: (
      request: Record<string, unknown>,
      worker: E2EFakeWorker,
    ) => DiagnosticWorkerResponse[],
  ) {}

  postMessage(request: Record<string, unknown>) {
    this.postCount += 1;
    for (const response of this.responder(request, this)) {
      queueMicrotask(() => this.onmessage?.({ data: response } as MessageEvent<DiagnosticWorkerResponse>));
    }
  }

  terminate() {
    this.terminated = true;
  }
}

function createDiagnosticSegmentationResult(fillSubject = true) {
  return {
    imageInput: {
      channels: 3,
      data: new Uint8ClampedArray([
        255, 0, 0,
        0, 255, 0,
        0, 0, 255,
        255, 255, 255,
      ]),
      height: 2,
      width: 2,
    },
    subjectMask: {
      data: new Uint8Array(fillSubject ? [1, 0, 0, 1] : [0, 0, 0, 0]),
      height: 2,
      score: fillSubject ? 0.91 : 0,
      width: 2,
    },
  };
}

async function runTransformersRuntimeDiagnostic() {
  const fallbackCalls: string[] = [];
  const fallbackOperations = {
    detectLanguage: async (modelId: string, text: string) => {
      fallbackCalls.push(`detect:${modelId}:${text}`);
      return { language: 'en', score: 0.99 };
    },
    generateText: async (modelId: string) => {
      fallbackCalls.push(`generate:${modelId}`);
      return 'Generated fallback text';
    },
    preloadImageEditing: async (options?: { onProgress?: (progress: number) => void }) => {
      fallbackCalls.push('preload-image');
      options?.onProgress?.(20);
    },
    removeImageEditing: async () => {
      fallbackCalls.push('remove-image');
    },
    preloadLanguageDetection: async (modelId: string, options?: { onProgress?: (progress: number) => void }) => {
      fallbackCalls.push(`preload-language:${modelId}`);
      options?.onProgress?.(30);
    },
    preloadTextGeneration: async (modelId: string, options?: { onProgress?: (progress: number) => void }) => {
      fallbackCalls.push(`preload-text:${modelId}`);
      options?.onProgress?.(40);
    },
    prepareBackgroundRemoval: async (objectUrl: string, options?: { onProgress?: (progress: number) => void }) => {
      fallbackCalls.push(`prepare:${objectUrl}`);
      options?.onProgress?.(50);
    },
    releaseTextGeneration: async (modelId: string) => {
      fallbackCalls.push(`release:${modelId}`);
    },
    removeTextGeneration: async (modelId: string) => {
      fallbackCalls.push(`remove:${modelId}`);
    },
    segmentBackgroundRemoval: async (objectUrl: string) => {
      fallbackCalls.push(`segment:${objectUrl}`);
      return createDiagnosticSegmentationResult();
    },
  };
  const fallbackClient = new TransformersRuntimeClient({
    createWorker: () => {
      throw new Error('worker unavailable');
    },
    fallbackOperations,
  });
  const fallbackProgress: number[] = [];
  await fallbackClient.preloadTextGeneration('fallback-text', { onProgress: (value) => fallbackProgress.push(value) });
  await fallbackClient.generateText('fallback-text', 'Prompt text');
  await fallbackClient.releaseTextGeneration('fallback-text');
  await fallbackClient.removeTextGeneration('fallback-text');
  await fallbackClient.preloadLanguageDetection('fallback-language', {
    onProgress: (value) => fallbackProgress.push(value),
  });
  await fallbackClient.detectLanguage('fallback-language', 'hello');
  await fallbackClient.preloadImageEditing({ onProgress: (value) => fallbackProgress.push(value) });
  await fallbackClient.prepareBackgroundRemoval('blob:fallback', {
    onProgress: (value) => fallbackProgress.push(value),
  });
  await fallbackClient.segmentBackgroundRemoval('blob:fallback', [{ positive: true, x: 1, y: 1 }]);
  await fallbackClient.removeImageEditing();

  let createdWorkers = 0;
  const workerProgress: number[] = [];
  const workerClient = new TransformersRuntimeClient({
    createWorker: () => {
      createdWorkers += 1;
      return new E2EFakeWorker((request) => {
        const id = String(request.id);
        if (request.type === 'detect-language') return [{ id, result: { language: 'pt', score: 0.8 }, type: 'result' }];
        if (request.type === 'segment-background-removal')
          return [{ id, result: createDiagnosticSegmentationResult(), type: 'result' }];
        if (request.type === 'generate-text') return [{ id, progress: 10, type: 'progress' }, { id, result: 'Worker text', type: 'result' }];
        return [{ id, progress: 25, type: 'progress' }, { id, type: 'result' }];
      }) as never;
    },
  });
  await workerClient.preloadTextGeneration('worker-text', { onProgress: (value) => workerProgress.push(value) });
  await workerClient.generateText('worker-text', 'Prompt text');
  await workerClient.preloadLanguageDetection('worker-language', {
    onProgress: (value) => workerProgress.push(value),
  });
  await workerClient.detectLanguage('worker-language', 'olá');
  await workerClient.preloadImageEditing({ onProgress: (value) => workerProgress.push(value) });
  await workerClient.prepareBackgroundRemoval('blob:worker', {
    onProgress: (value) => workerProgress.push(value),
  });
  await workerClient.segmentBackgroundRemoval('blob:worker', [{ positive: true, x: 0, y: 0 }]);

  let emittedRecoverableError = false;
  const recoveringClient = new TransformersRuntimeClient({
    createWorker: () =>
      new E2EFakeWorker((request, worker) => {
        const id = String(request.id);
        if (!emittedRecoverableError && worker.postCount === 1) {
          emittedRecoverableError = true;
          return [{ id, message: 'GPU device was lost', type: 'error' }];
        }
        return [{ id, result: 'Recovered text', type: 'result' }];
      }) as never,
  });
  const recoveredText = await recoveringClient.generateText('worker-text', 'Recover');

  const throwingClient = new TransformersRuntimeClient({
    createWorker: () =>
      ({
        onerror: null,
        onmessage: null,
        postMessage: () => {
          throw new Error('post failed');
        },
        terminate: () => undefined,
      }) as never,
  });
  const postError = await throwingClient.generateText('worker-text', 'Throw').catch((error: Error) => error.message);

  const invalidClient = new TransformersRuntimeClient({
    createWorker: () =>
      new E2EFakeWorker((request) => [{ id: String(request.id), result: {}, type: 'result' }]) as never,
  });
  const invalidLanguage = await invalidClient.detectLanguage('bad-language', 'x').catch((error: Error) => error.message);

  return {
    createdWorkers,
    fallbackCalls: fallbackCalls.length,
    fallbackProgress,
    invalidLanguage,
    postError,
    recoveredText,
    workerProgress,
  };
}

async function runBackgroundRemovalDiagnostic() {
  const calls: string[] = [];
  const service = new BrowserBackgroundRemovalService({
    prepareBackgroundRemoval: async (objectUrl, options) => {
      calls.push(`prepare:${objectUrl}`);
      options?.onProgress?.(66);
    },
    segmentBackgroundRemoval: async (objectUrl, points) => {
      calls.push(`segment:${objectUrl}:${points.length}`);
      return createDiagnosticSegmentationResult(!objectUrl.includes('empty'));
    },
  });
  const asset = {
    id: 'asset-bg',
    mimeType: 'image/png',
    name: 'Background',
    objectUrl: 'blob:bg',
    type: 'image',
  };
  const emptyAsset = { ...asset, id: 'asset-empty', objectUrl: 'blob:empty' };
  const progressValues: number[] = [];
  await service.prepareBackgroundRemoval(asset as never, {
    onProgress: (value) => progressValues.push(value),
  });
  const preview = await service.previewBackgroundMask(asset as never, {
    subjectPoint: { x: 1, y: 1 },
  });
  const removed = await service.removeBackground(asset as never, {
    points: [{ positive: true, x: 0, y: 0 }],
  });
  const emptyRemoved = await service.removeBackground(emptyAsset as never, {
    subjectPoint: { x: 0, y: 0 },
  });
  const missingSource = await service.prepareBackgroundRemoval({ ...asset, objectUrl: undefined } as never).catch(
    (error: Error) => error.message,
  );
  const missingPoint = await service.previewBackgroundMask(asset as never).catch((error: Error) => error.message);
  return {
    bounds: removed.bounds,
    calls,
    emptyBounds: emptyRemoved.bounds,
    missingPoint,
    missingSource,
    previewScore: preview.score,
    progressValues,
  };
}

async function runBonsaiRuntimeDiagnostic() {
  const workerEvents: string[] = [];
  const workerRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () =>
      new E2EFakeWorker((request) => {
        const id = String(request.id);
        workerEvents.push(String(request.type));
        if (request.type === 'generate') {
          return [
            { id, progress: 55, type: 'progress' },
            { id, step: 1, totalSteps: 2, type: 'step' },
            { blob: new Blob(['image'], { type: 'image/png' }), id, type: 'result' },
          ];
        }
        return [{ id, progress: 45, type: 'progress' }, { id, type: 'result' }];
      }) as never,
  });
  const progressValues: number[] = [];
  const steps: string[] = [];
  await workerRuntime.preload('bonsai-worker', { onProgress: (value) => progressValues.push(value) });
  const blob = await workerRuntime.generate({
    height: 512,
    modelId: 'bonsai-worker',
    onLoadProgress: (value) => progressValues.push(value),
    onStep: (step, total) => steps.push(`${step}/${total}`),
    prompt: 'green product card',
    steps: 2,
    width: 512,
  });

  const fallbackEvents: string[] = [];
  const fallbackRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () => {
      throw new Error('worker unavailable');
    },
    fallbackRuntime: {
      generate: async (options) => {
        fallbackEvents.push(`generate:${options.prompt}`);
        options.onLoadProgress?.(70);
        options.onStep?.(2, 2);
        return new Blob(['fallback-image'], { type: 'image/png' });
      },
      preload: async (modelId, options) => {
        fallbackEvents.push(`preload:${modelId}`);
        options?.onProgress?.(60);
      },
    },
  });
  await fallbackRuntime.preload('bonsai-fallback', {
    onProgress: (value) => progressValues.push(value),
  });
  const fallbackBlob = await fallbackRuntime.generate({
    height: 256,
    modelId: 'bonsai-fallback',
    onLoadProgress: (value) => progressValues.push(value),
    onStep: (step, total) => steps.push(`${step}/${total}`),
    prompt: 'fallback image',
    steps: 2,
    width: 256,
  });

  const errorRuntime = new bonsaiImageRuntime.WorkerBackedBonsaiImageRuntime({
    createWorker: () =>
      new E2EFakeWorker((request) => [{ id: String(request.id), message: 'Bonsai failed', type: 'error' }]) as never,
  });
  const error = await errorRuntime.generate({
    height: 128,
    modelId: 'bonsai-error',
    prompt: 'broken image',
    steps: 1,
    width: 128,
  }).catch((caught: Error) => caught.message);

  return {
    blobSize: blob.size,
    error,
    fallbackBlobSize: fallbackBlob.size,
    fallbackEvents,
    progressValues,
    steps,
    workerEvents,
  };
}

function runGeneratedSlideParsingDiagnostic() {
  const tasks = generatedSlide.parseGeneratedSlideTasksJson(`
    \`\`\`json
    {
      "language": "",
      "page": {
        "name": "",
        "width": 1,
        "height": 1,
        "background": { "type": "color", "color": "not-a-color" }
      },
      "tasks": [
        { "type": "set-background", "color": "#123abc" },
        { "type": "add-placeholder-image", "id": "Hero Image!", "description": "", "placementHint": "" },
        { "type": "add-remote-image", "id": "", "url": "https://example.test/image.png", "description": "", "placementHint": "" },
        { "type": "add-title", "id": "", "text": "", "placementHint": "" },
        { "type": "add-subtitle", "id": "Sub Title", "text": "Subtitle", "placementHint": "top" },
        { "type": "add-body-text", "id": "Body", "text": "Body", "placementHint": "middle" },
        { "type": "add-cta", "id": "CTA", "text": "Go", "placementHint": "bottom" },
        { "type": "add-bullets", "id": "Bullets", "items": ["One", "", 2, "Three"], "placementHint": "" },
        { "type": "add-shape", "id": "Shape", "shape": "ellipse", "placementHint": "" },
        { "type": "add-shape", "id": "Shape 2", "shape": "triangle", "placementHint": "" }
      ]
    }
    \`\`\`
  `);
  const textElement = generatedSlide.parseGeneratedSlideElementJson(
    JSON.stringify({
      align: 'unknown',
      fill: 'bad',
      fontFamily: 'Unknown',
      fontSize: 500,
      fontWeight: 123,
      height: 1,
      id: 'Text Element!',
      opacity: 2,
      rotation: 999,
      text: '',
      type: 'text',
      width: 1,
      x: -10,
      y: 9_999,
    }),
  );
  const remoteImage = generatedSlide.parseGeneratedSlideElementJson(
    JSON.stringify({
      assetRole: 'remote',
      height: 200,
      id: 'Remote Image',
      opacity: 1,
      rotation: 0,
      src: 'https://example.test/remote.png',
      type: 'image',
      width: 300,
      x: 100,
      y: 100,
    }),
  );
  const shape = generatedSlide.parseGeneratedSlideElementJson(
    JSON.stringify({
      fill: '#abcdef',
      height: 200,
      id: 'Shape Element',
      opacity: 0.5,
      rotation: 10,
      shape: 'ellipse',
      stroke: '#123456',
      strokeWidth: 999,
      type: 'shape',
      width: 300,
      x: 100,
      y: 100,
    }),
  );
  const errors = [
    () => generatedSlide.parseGeneratedSlideTasksJson('[]'),
    () => generatedSlide.parseGeneratedSlideTasksJson(JSON.stringify({ page: { background: {} }, tasks: [{ type: 'add-remote-image', url: 'http://bad.test' }] })),
    () => generatedSlide.parseGeneratedSlideTasksJson(JSON.stringify({ page: { background: {} }, tasks: [{ type: 'unknown' }] })),
    () => generatedSlide.parseGeneratedSlideElementJson(JSON.stringify({ type: 'image', assetRole: 'bad' })),
    () => generatedSlide.parseGeneratedSlideElementJson(JSON.stringify({ type: 'image', assetRole: 'remote', src: 'http://bad.test' })),
    () => generatedSlide.parseGeneratedSlideElementJson(JSON.stringify({ type: 'unknown' })),
  ].map((run) => {
    try {
      run();
      return 'no-error';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  });

  return {
    errors,
    pageName: tasks.page.name,
    remoteRole: remoteImage.type === 'image' ? remoteImage.assetRole : undefined,
    shapeStrokeWidth: shape.type === 'shape' ? shape.strokeWidth : undefined,
    taskCount: tasks.tasks.length,
    textAlign: textElement.type === 'text' ? textElement.align : undefined,
  };
}

function runSlideLayoutPresetDiagnostic() {
  const basePage = {
    background: { color: '#020617', type: 'color' as const },
    height: 1080 as const,
    name: 'Preset diagnostics',
    width: 1920 as const,
  };
  const centeredDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      language: 'en',
      page: basePage,
      tasks: [],
    },
    'black background with green title "Browser AI" and white subtitle "Runs locally"',
  );
  const bulletDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      language: 'en',
      page: basePage,
      tasks: [
        {
          description: 'Remote hero',
          id: 'remote-hero',
          placementHint: 'left image',
          type: 'add-remote-image',
          url: 'https://localstudio.test/hero.png',
        },
        { id: 'body-1', placementHint: '', text: 'Private runtime', type: 'add-body-text' },
      ],
    },
    'left image with three bullets - WebGPU - Private - Fast title "LocalStudio"',
  );
  const explicitBulletDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      language: 'en',
      page: basePage,
      tasks: [
        { id: 'title-existing', placementHint: '', text: 'Existing', type: 'add-title' },
        { id: 'bullets-existing', items: ['One'], placementHint: '', type: 'add-bullets' },
      ],
    },
    'two bullet points',
  );
  const shapedGridDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      language: 'en',
      page: basePage,
      tasks: [
        {
          id: 'shape-grid-1',
          placementHint: 'grid image 1 left',
          shape: 'rect',
          type: 'add-shape',
        },
        {
          id: 'shape-grid-2',
          placementHint: 'grid image 2 right',
          shape: 'rect',
          type: 'add-shape',
        },
        { id: 'caption-a', placementHint: '', text: 'Alpha', type: 'add-body-text' },
        { id: 'caption-b', placementHint: '', text: 'Beta', type: 'add-subtitle' },
      ],
    },
    'two-image grid with matching captions',
  );
  const remoteGridDocument = slideLayoutPresets.normalizeSlideTasksForLayout(
    {
      language: 'en',
      page: basePage,
      tasks: [
        {
          id: 'remote-grid-1',
          description: 'One',
          placementHint: 'grid image 1 left',
          type: 'add-remote-image',
          url: 'https://localstudio.test/one.png',
        },
        {
          id: 'remote-grid-2',
          description: 'Two',
          placementHint: 'grid image 2 center',
          type: 'add-remote-image',
          url: 'https://localstudio.test/two.png',
        },
        {
          id: 'remote-grid-3',
          description: 'Three',
          placementHint: 'grid image 3 right',
          type: 'add-remote-image',
          url: 'https://localstudio.test/three.png',
        },
        { id: 'caption-1', placementHint: 'caption below grid image 1 left', text: 'One', type: 'add-body-text' },
        { id: 'caption-2', placementHint: 'caption below grid image 2 center', text: 'Two', type: 'add-body-text' },
        { id: 'caption-3', placementHint: 'caption below grid image 3 right', text: 'Three', type: 'add-subtitle' },
      ],
    },
    'three-image grid with matching captions',
  );
  const leftHeroDocument = createSlideDocument([
    {
      assetRole: 'placeholder',
      id: 'left-media',
      placementHint: 'left media block',
      type: 'add-placeholder-image',
    },
    { id: 'right-title', placementHint: 'right text block', text: 'Right title', type: 'add-title' },
    { id: 'right-body', placementHint: 'right text block', text: 'Right body', type: 'add-body-text' },
  ]);
  const imageElement: GeneratedSlideElement = {
    assetRole: 'placeholder',
    height: 120,
    id: 'image-element',
    opacity: 1,
    rotation: 0,
    type: 'image' as const,
    width: 120,
    x: 0,
    y: 0,
  };

  const layoutTasks = (tasks: GeneratedSlideTask[]) =>
    tasks.filter((task): task is Exclude<GeneratedSlideTask, { type: 'set-background' }> => task.type !== 'set-background');

  const applyResults = [
    ...layoutTasks(centeredDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(createTextElement(`centered-${task.id}`), {
        allTasks: centeredDocument.tasks,
        page: centeredDocument.page,
        task,
      }),
    ),
    ...layoutTasks(bulletDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(
        task.type === 'add-remote-image' ? imageElement : createTextElement(`bullet-${task.id}`),
        {
          allTasks: bulletDocument.tasks,
          page: bulletDocument.page,
          task,
        },
      ),
    ),
    ...layoutTasks(explicitBulletDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(createTextElement(`explicit-${task.id}`), {
        allTasks: explicitBulletDocument.tasks,
        page: explicitBulletDocument.page,
        task,
      }),
    ),
    ...layoutTasks(shapedGridDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(
        task.type === 'add-placeholder-image' || task.type === 'add-remote-image'
          ? imageElement
          : createTextElement(`grid-${task.id}`),
        {
          allTasks: shapedGridDocument.tasks,
          page: shapedGridDocument.page,
          task,
        },
      ),
    ),
    ...layoutTasks(remoteGridDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(
        task.type === 'add-remote-image' ? ({ ...imageElement, type: 'shape' } as never) : createTextElement(`remote-${task.id}`),
        {
          allTasks: remoteGridDocument.tasks,
          page: remoteGridDocument.page,
          task,
        },
      ),
    ),
    ...layoutTasks(leftHeroDocument.tasks).map((task) =>
      slideLayoutPresets.applySlideElementLayoutPreset(
        task.type === 'add-placeholder-image' ? imageElement : createTextElement(`hero-${task.id}`),
        {
          allTasks: leftHeroDocument.tasks,
          page: leftHeroDocument.page,
          task,
        },
      ),
    ),
  ];

  return {
    applied: applyResults.length,
    bulletTasks: bulletDocument.tasks.length,
    centeredBackground: centeredDocument.page.background,
    explicitBullets: explicitBulletDocument.tasks.find((task) => task.type === 'add-bullets'),
    shapedGridTasks: shapedGridDocument.tasks.length,
    remoteGridTasks: remoteGridDocument.tasks.length,
  };
}

async function runProgressUtilitiesDiagnostic() {
  const mapped = [
    progress.clampProgress(-20),
    progress.clampProgress(124, 10, 90),
    progress.mapProgressToRange(50, 20, 80),
  ];
  const values: Array<{ details?: unknown; value: number }> = [];
  const report = progress.createMonotonicProgressReporter(
    (value, details) => values.push({ details, value }),
    { initial: 20, max: 95, min: 10 },
  );
  report(1);
  report(55, { loadedBytes: 2, totalBytes: 10 });
  report(20);
  const transformersProgress = progress.createTransformersProgressCallback((value, details) => {
    values.push({ details, value });
  }, { initial: 5, max: 90, min: 5 });
  transformersProgress(undefined);
  transformersProgress({ file: 'a.bin', loaded: -1, name: 'model-a', status: 'progress', total: 0 });
  transformersProgress({ file: 'a.bin', loaded: 4, name: 'model-a', status: 'progress', total: 8 });
  transformersProgress({ file: 'b.bin', loaded: 8, name: 'model-a', status: 'progress', total: 8 });
  transformersProgress({ loaded: 4, progress: 50, status: 'progress_total', total: 8 });
  transformersProgress({ progress: 80, status: 'progress' });
  const estimates = [
    progress.estimateRemainingMs({ elapsedMs: 0, loadedBytes: 1, totalBytes: 2 }),
    progress.estimateRemainingMs({ elapsedMs: 1000, loadedBytes: undefined, totalBytes: 2 }),
    progress.estimateRemainingMs({ elapsedMs: 1000, loadedBytes: 0, totalBytes: 2 }),
    progress.estimateRemainingMs({ elapsedMs: 1000, loadedBytes: 1, totalBytes: 3 }),
    progress.estimateRemainingMs({ elapsedMs: Number.NaN, loadedBytes: 1, totalBytes: 3 }),
  ];
  const tickerValues: number[] = [];
  const stopTicker = progress.createEstimatedProgressTicker((value) => tickerValues.push(value), {
    intervalMs: 1,
    max: 3,
    start: 1,
    step: 1,
  });
  await new Promise((resolve) => window.setTimeout(resolve, 5));
  stopTicker();
  return { estimates, mapped, tickerValues, values };
}

async function runPptxParserDiagnostic() {
  const relType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const files = [
    {
      path: '[Content_Types].xml',
      blob: new Blob([
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="xml" ContentType="application/xml"/>
          <Default Extension="png" ContentType="image/png"/>
          <Default Extension="bin" ContentType="application/octet-stream"/>
          <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
          <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
          <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
          <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
          <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
        </Types>`,
      ], { type: 'application/xml' }),
    },
    {
      path: '_rels/.rels',
      blob: new Blob([
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdOffice" Type="${relType}/officeDocument" Target="ppt/presentation.xml"/>
        </Relationships>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/presentation.xml',
      blob: new Blob([
        `<p:presentation xmlns:p="p" xmlns:r="${relType}">
          <p:sldSz cx="0" cy="0"/>
          <p:sldMasterIdLst><p:sldMasterId r:id="rIdMaster"/></p:sldMasterIdLst>
          <p:sldIdLst>
            <p:sldId r:id="rIdSlide1"/>
          </p:sldIdLst>
        </p:presentation>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/_rels/presentation.xml.rels',
      blob: new Blob([
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdSlide1" Type="${relType}/slide" Target="slides/slide1.xml"/>
          <Relationship Id="rIdMaster" Type="${relType}/slideMaster" Target="slideMasters/slideMaster1.xml"/>
        </Relationships>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/theme/theme1.xml',
      blob: new Blob([
        `<a:theme xmlns:a="a">
          <a:themeElements>
            <a:clrScheme name="diagnostic">
              <a:accent1><a:srgbClr val="37FD76"/></a:accent1>
              <a:tx1><a:srgbClr val="FFFFFF"/></a:tx1>
            </a:clrScheme>
            <a:fontScheme name="diagnostic">
              <a:majorFont><a:latin typeface="Orbitron"/></a:majorFont>
              <a:minorFont><a:latin typeface="Inter"/></a:minorFont>
            </a:fontScheme>
          </a:themeElements>
        </a:theme>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slideMasters/slideMaster1.xml',
      blob: new Blob([
        `<p:sldMaster xmlns:p="p" xmlns:a="a">
          <p:cSld><p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="11" name="Master title"/><p:nvPr><p:ph type="title" idx="1"/></p:nvPr></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="500000" cy="120000"/></a:xfrm></p:spPr>
              <p:txBody><a:p><a:r><a:t>Master title</a:t></a:r></a:p></p:txBody>
            </p:sp>
            <p:pic>
              <p:nvPicPr><p:cNvPr id="12" name="Master picture"/><p:nvPr><p:ph type="pic" idx="2"/></p:nvPr></p:nvPicPr>
              <p:spPr><a:xfrm><a:off x="200000" y="250000"/><a:ext cx="300000" cy="220000"/></a:xfrm></p:spPr>
            </p:pic>
          </p:spTree></p:cSld>
        </p:sldMaster>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
      blob: new Blob([
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdTheme" Type="${relType}/theme" Target="../theme/theme1.xml"/>
          <Relationship Id="rIdLayout" Type="${relType}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
        </Relationships>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slideLayouts/slideLayout1.xml',
      blob: new Blob([
        `<p:sldLayout xmlns:p="p" xmlns:a="a" xmlns:r="${relType}">
          <p:cSld name="Diagnostic Layout"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="010203"/></a:solidFill></p:bgPr></p:bg><p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="21" name="Layout picture placeholder"/><p:nvPr><p:ph type="pic" idx="2"/></p:nvPr></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="300000" y="300000"/><a:ext cx="400000" cy="300000"/></a:xfrm></p:spPr>
            </p:sp>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="22" name="Layout body"/><p:nvPr><p:ph type="body" idx="3"/></p:nvPr></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="700000" y="200000"/><a:ext cx="500000" cy="320000"/></a:xfrm></p:spPr>
              <p:txBody><a:p><a:r><a:t>Layout body</a:t></a:r></a:p></p:txBody>
            </p:sp>
          </p:spTree></p:cSld>
        </p:sldLayout>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
      blob: new Blob([
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdMaster" Type="${relType}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
        </Relationships>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slides/slide1.xml',
      blob: new Blob([
        `<p:sld xmlns:p="p" xmlns:a="a" xmlns:r="${relType}">
          <p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="050D10"/></a:solidFill></p:bgPr></p:bg><p:spTree>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="1" name="Title"/><p:nvPr><p:ph type="title" idx="1"/></p:nvPr></p:nvSpPr>
              <p:spPr><a:xfrm rot="60000" flipH="1"><a:off x="120000" y="120000"/><a:ext cx="600000" cy="150000"/></a:xfrm></p:spPr>
              <p:txBody><a:p><a:r><a:t>Diagnostic title</a:t></a:r></a:p></p:txBody>
            </p:sp>
            <p:pic>
              <p:nvPicPr><p:cNvPr id="2" name="Image"/></p:nvPicPr>
              <p:blipFill><a:blip r:embed="rIdImage"/><a:srcRect l="10000" t="5000" r="10000" b="5000"/></p:blipFill>
              <p:spPr><a:xfrm><a:off x="900000" y="120000"/><a:ext cx="300000" cy="220000"/></a:xfrm></p:spPr>
            </p:pic>
            <p:pic>
              <p:nvPicPr><p:cNvPr id="3" name="External"/></p:nvPicPr>
              <p:blipFill><a:blip r:embed="rIdExternal"/></p:blipFill>
              <p:spPr><a:xfrm><a:off x="100000" y="500000"/><a:ext cx="200000" cy="160000"/></a:xfrm></p:spPr>
            </p:pic>
            <p:pic>
              <p:nvPicPr><p:cNvPr id="4" name="Unsupported"/></p:nvPicPr>
              <p:blipFill><a:blip r:embed="rIdUnsupported"/></p:blipFill>
              <p:spPr><a:xfrm><a:off x="330000" y="500000"/><a:ext cx="200000" cy="160000"/></a:xfrm></p:spPr>
            </p:pic>
            <p:sp>
              <p:nvSpPr><p:cNvPr id="5" name="Arrow"/></p:nvSpPr>
              <p:spPr><a:xfrm><a:off x="550000" y="500000"/><a:ext cx="220000" cy="160000"/></a:xfrm><a:prstGeom prst="rightArrow"/><a:solidFill><a:srgbClr val="37FD76"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:headEnd type="triangle"/><a:tailEnd type="diamond"/></a:ln></p:spPr>
            </p:sp>
            <p:grpSp>
              <p:nvGrpSpPr><p:cNvPr id="6" name="Group"/></p:nvGrpSpPr>
              <p:grpSpPr><a:xfrm><a:off x="800000" y="500000"/><a:ext cx="400000" cy="260000"/><a:chOff x="0" y="0"/><a:chExt cx="400000" cy="260000"/></a:xfrm></p:grpSpPr>
              <p:sp>
                <p:nvSpPr><p:cNvPr id="7" name="Grouped shape"/></p:nvSpPr>
                <p:spPr><a:xfrm><a:off x="20000" y="20000"/><a:ext cx="160000" cy="100000"/></a:xfrm><a:prstGeom prst="ellipse"/><a:solidFill><a:srgbClr val="FF00FF"/></a:solidFill></p:spPr>
              </p:sp>
            </p:grpSp>
            <p:graphicFrame>
              <p:nvGraphicFramePr><p:cNvPr id="8" name="Table"/></p:nvGraphicFramePr>
              <p:xfrm><a:off x="100000" y="800000"/><a:ext cx="700000" cy="200000"/></p:xfrm>
              <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>
                <a:tblGrid><a:gridCol w="250000"/><a:gridCol w="450000"/></a:tblGrid>
                <a:tr h="100000"><a:tc><a:tcPr><a:solidFill><a:srgbClr val="111111"/></a:solidFill></a:tcPr><a:txBody><a:p><a:r><a:t>A1</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>B1</a:t></a:r></a:p></a:txBody></a:tc></a:tr>
              </a:tbl></a:graphicData></a:graphic>
            </p:graphicFrame>
            <p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></p:graphicFrame>
            <p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"/></a:graphic></p:graphicFrame>
          </p:spTree></p:cSld>
        </p:sld>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/slides/_rels/slide1.xml.rels',
      blob: new Blob([
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rIdLayout" Type="${relType}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
          <Relationship Id="rIdImage" Type="${relType}/image" Target="../media/image1.png"/>
          <Relationship Id="rIdUnsupported" Type="${relType}/image" Target="../media/blob.bin"/>
          <Relationship Id="rIdExternal" Type="${relType}/image" Target="https://example.test/image.png" TargetMode="External"/>
        </Relationships>`,
      ], { type: 'application/xml' }),
    },
    {
      path: 'ppt/media/image1.png',
      blob: new Blob(['png'], { type: 'image/png' }),
    },
    {
      path: 'ppt/media/blob.bin',
      blob: new Blob(['bin'], { type: 'application/octet-stream' }),
    },
  ];
  const pkg = await pptxPackage.create(files);
  const deck = await pptxParser.parse({ package: pkg, themeCache: new Map() }, 'diagnostic.pptx');
  return {
    height: deck.height,
    layoutCount: deck.layouts.length,
    objectKinds: deck.slides[0]?.objects.map((object) => object.kind),
    slideCount: deck.slides.length,
    warnings: deck.warnings.map((warning) => warning.code),
  };
}

async function runPptxExportDiagnostic() {
  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const exportProject = {
    assets: {
      'asset-bg': {
        id: 'asset-bg',
        mimeType: 'image/png',
        name: 'Background.png',
        objectUrl: tinyPngDataUrl,
        type: 'image',
      },
      'asset-image': {
        id: 'asset-image',
        mimeType: 'image/png',
        name: 'Image.png',
        objectUrl: tinyPngDataUrl,
        type: 'image',
      },
      'asset-gif': {
        id: 'asset-gif',
        mimeType: 'image/gif',
        name: 'Animated.gif',
        objectUrl: tinyPngDataUrl,
        type: 'gif',
      },
      'asset-video': {
        id: 'asset-video',
        mimeType: 'video/mp4',
        name: 'Clip.mp4',
        objectUrl: 'data:video/mp4;base64,AAAA',
        type: 'video',
      },
      'asset-unreadable': {
        id: 'asset-unreadable',
        mimeType: 'image/png',
        name: 'Unreadable.png',
        objectUrl: 'https://invalid.localstudio.test/missing.png',
        type: 'image',
      },
    },
    createdAt: '2026-07-20T00:00:00.000Z',
    elements: {
      'text-1': {
        ...createTextElement('text-1', 'Export diagnostics'),
        fill: '#0f0',
        fontWeight: 700,
        hyperlink: 'https://localstudio.test',
        opacity: 0.85,
        verticalAlign: 'middle',
      },
      'image-1': {
        assetId: 'asset-image',
        crop: { height: 0.8, width: 0.75, x: 0.1, y: 0.05 },
        flipX: true,
        height: 240,
        id: 'image-1',
        locked: false,
        opacity: 0.7,
        rotation: 12,
        type: 'image',
        visible: true,
        width: 320,
        x: 620,
        y: 120,
      },
      'gif-1': {
        assetId: 'asset-gif',
        height: 180,
        id: 'gif-1',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'gif',
        visible: true,
        width: 260,
        x: 980,
        y: 140,
      },
      'video-1': {
        assetId: 'asset-video',
        autoplayInPreview: true,
        controls: true,
        durationSeconds: 30,
        height: 260,
        id: 'video-1',
        locked: false,
        loop: false,
        muted: true,
        opacity: 1,
        playbackPositionSeconds: 4,
        playing: false,
        posterFrameSeconds: 5,
        repeatMode: 'loop-back-and-forth',
        rotation: 15,
        trimEndSeconds: 20,
        trimStartSeconds: 3,
        type: 'video',
        visible: true,
        volume: 0.4,
        width: 360,
        x: 120,
        y: 430,
      },
      'shape-1': {
        endEndpoint: 'open-circle',
        fill: '#37FD76',
        height: 180,
        id: 'shape-1',
        locked: false,
        opacity: 0.6,
        rotation: 8,
        shape: 'line',
        startEndpoint: 'bar',
        stroke: '#123',
        strokeWidth: 3,
        type: 'shape',
        visible: true,
        width: 360,
        x: 540,
        y: 470,
      },
      'shape-2': {
        endEndpoint: 'square',
        fill: undefined,
        height: 160,
        id: 'shape-2',
        locked: false,
        opacity: 1,
        rotation: 0,
        shape: 'hexagon',
        startEndpoint: 'diamond',
        stroke: undefined,
        strokeWidth: 0,
        type: 'shape',
        visible: true,
        width: 220,
        x: 940,
        y: 470,
      },
      'missing-image': {
        assetId: 'asset-missing',
        height: 120,
        id: 'missing-image',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 120,
        x: 1260,
        y: 460,
      },
      'unreadable-image': {
        assetId: 'asset-unreadable',
        height: 120,
        id: 'unreadable-image',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 120,
        x: 1410,
        y: 460,
      },
      'hidden-text': {
        ...createTextElement('hidden-text', 'Hidden'),
        visible: false,
      },
    },
    fonts: {},
    id: 'pptx-export-diagnostic',
    importWarnings: [],
    name: 'PPTX Export Diagnostic',
    pages: [
      {
        animationBuilds: [
          {
            delayMs: 100,
            durationMs: 400,
            effect: 'fade',
            elementId: 'text-1',
            id: 'build-1',
            kind: 'build-in',
            trigger: 'on-click',
          },
          {
            delayMs: 0,
            effect: 'reveal',
            elementId: 'hidden-text',
            id: 'build-hidden',
            trigger: 'after-previous',
          },
        ],
        background: { assetId: 'asset-bg', colorFallback: '#123456', type: 'image' },
        elementIds: [
          'text-1',
          'image-1',
          'gif-1',
          'video-1',
          'shape-1',
          'shape-2',
          'missing-image',
          'unreadable-image',
          'hidden-text',
          'ghost',
        ],
        height: 1080,
        id: 'export-page-1',
        name: 'Export Page 1',
        speakerNotes: 'Diagnostics speaker notes.',
        transition: { delayMs: 500, durationMs: 300, effect: 'fade', trigger: 'after-delay' },
        visible: true,
        width: 1920,
      },
      {
        background: { assetId: 'asset-missing-bg', colorFallback: '#654321', type: 'image' },
        elementIds: [],
        height: 1080,
        id: 'export-page-2',
        name: 'Export Page 2',
        visible: true,
        width: 1920,
      },
      {
        background: { color: '#000000', type: 'color' },
        elementIds: ['text-1'],
        height: 1080,
        id: 'hidden-page',
        name: 'Hidden Page',
        visible: false,
        width: 1920,
      },
    ],
    recordings: {},
    updatedAt: '2026-07-20T00:00:00.000Z',
    version: 1,
  } as unknown as ProjectDocument;

  type DiagnosticWorker = {
    onerror: ((event: ErrorEvent) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: (message: { buffer: ArrayBuffer; id: string }) => void;
    terminate: () => void;
  };

  const createSuccessWorker = () => {
    const worker: DiagnosticWorker = {
      onerror: null,
      onmessage: null,
      postMessage(message: { buffer: ArrayBuffer; id: string }) {
        window.setTimeout(() => {
          worker.onmessage?.({
            data: {
              buffer: message.buffer,
              id: message.id,
              type: 'result',
              warnings: [{ category: 'fidelity', code: 'worker-warning', message: 'Worker warning.' }],
            },
          } as MessageEvent);
        }, 0);
      },
      terminate() {
        // Fake worker has no resources.
      },
    };
    return worker as unknown as Worker;
  };
  const createFailingWorker = () => {
    const worker: DiagnosticWorker = {
      onerror: null,
      onmessage: null,
      postMessage() {
        window.setTimeout(() => {
          worker.onerror?.(new ErrorEvent('error', { message: 'worker failed' }));
        }, 0);
      },
      terminate() {
        // Fake worker has no resources.
      },
    };
    return worker as unknown as Worker;
  };

  const progressEvents: string[] = [];
  const success = await new BrowserPptxExportService({
    createPatchWorker: createSuccessWorker,
  }).exportPowerPoint(exportProject, {
    onProgress: (event) => progressEvents.push(event.stage),
  });
  const fallback = await new BrowserPptxExportService({
    createPatchWorker: createFailingWorker,
  }).exportPowerPoint(
    {
      ...exportProject,
      id: 'pptx-export-fallback',
      pages: [
        {
          background: { color: '#111111', type: 'color' },
          elementIds: ['shape-1'],
          height: 720,
          id: 'fallback-page',
          name: 'Fallback Page',
          visible: true,
          width: 1280,
        },
      ],
    } as ProjectDocument,
    { onProgress: (event) => progressEvents.push(`fallback:${event.stage}`) },
  );

  return {
    fallbackWarnings: fallback.warnings.length,
    progressEvents,
    stats: success.stats,
    successSize: success.blob.size,
    successWarnings: success.warnings.length,
  };
}

async function runImageExportDiagnostic() {
  const project = createCommandDiagnosticProject() as ProjectDocument;
  const animatedProject = {
    ...project,
    pages: project.pages.map((page, index) =>
      index === 0
        ? {
            ...page,
            animationBuilds: [
              {
                delayMs: 0,
                durationMs: 250,
                effect: 'fade',
                elementId: 'text-1',
                id: 'build-in',
                kind: 'build-in' as const,
                trigger: 'after-previous' as const,
              },
              {
                delayMs: 0,
                durationMs: 250,
                effect: 'fade',
                elementId: 'missing-element',
                id: 'missing-build',
                kind: 'build-in' as const,
                trigger: 'after-previous' as const,
              },
              {
                delayMs: 0,
                durationMs: 250,
                effect: 'fade',
                elementId: 'text-1',
                id: 'build-out',
                kind: 'build-out' as const,
                trigger: 'after-previous' as const,
              },
            ],
          }
        : page,
    ),
  } as ProjectDocument;
  const allFrames = editorImageExport.getFrames({
    getPageImageFileName: (_project, pageId, extension) => `${pageId}.${extension}`,
    options: {
      format: 'png',
      includeAnimationFrames: true,
      slideRange: { from: 1, to: 2 },
    },
    project: animatedProject,
  });
  const singleFrames = editorImageExport.getFrames({
    getPageImageFileName: (_project, pageId, extension) => `${pageId}.${extension}`,
    options: {
      format: 'jpeg',
      includeAnimationFrames: false,
      slideRange: 'all',
    },
    project: animatedProject,
  });
  const plainBytes = editorImageExport.dataUrlToBytes('data:text/plain,hello%20world');
  const base64Bytes = editorImageExport.dataUrlToBytes(`data:image/png;base64,${btoa('png')}`);
  const invalidDataUrl = (() => {
    try {
      editorImageExport.dataUrlToBytes('not-a-data-url');
      return 'no-error';
    } catch (error) {
      return error instanceof Error ? error.message : 'unknown';
    }
  })();
  const zipBlob = editorImageExport.createZipBlob({
    'plain.txt': plainBytes,
    'image.png': base64Bytes,
  });
  await editorImageExport.waitForNextPaint();
  return {
    allFrames: allFrames.map((frame) => frame.fileName),
    base64Bytes: base64Bytes.length,
    invalidDataUrl,
    plainBytes: plainBytes.length,
    singleFrames: singleFrames.length,
    zipSize: zipBlob.size,
  };
}

async function runPublicDeckAssetPreloadDiagnostic() {
  const progressEvents: Array<{ loaded: number; total: number }> = [];
  const project = {
    ...createStorageDiagnosticProject(),
    assets: {
      image: {
        id: 'image',
        mimeType: 'image/png',
        name: 'Image',
        objectUrl: `${window.location.origin}/assets/image.png`,
        type: 'image',
      },
      gif: {
        id: 'gif',
        mimeType: 'image/gif',
        name: 'Gif',
        objectUrl: `${window.location.origin}/assets/animated.gif`,
        type: 'gif',
      },
      video: {
        id: 'video',
        mimeType: 'video/mp4',
        name: 'Video',
        objectUrl: `${window.location.origin}/assets/video.mp4`,
        type: 'video',
      },
      audio: {
        id: 'audio',
        mimeType: 'audio/webm',
        name: 'Audio',
        objectUrl: `${window.location.origin}/assets/audio.webm`,
        type: 'audio',
      },
      invalid: {
        id: 'invalid',
        mimeType: 'image/png',
        name: 'Invalid',
        objectUrl: 'data:image/png;base64,aW1hZ2U=',
        type: 'image',
      },
      malformed: {
        id: 'malformed',
        mimeType: 'image/png',
        name: 'Malformed',
        objectUrl: 'http://%',
        type: 'image',
      },
    },
    fonts: {
      remote: {
        family: 'Remote',
        id: 'remote',
        objectUrl: `${window.location.origin}/fonts/remote.woff2`,
        sourceUrl: `${window.location.origin}/fonts/source.woff2`,
      },
    },
  } as unknown as ProjectDocument;
  const fetchCalls: string[] = [];
  const originalVideoLoad = HTMLMediaElement.prototype.load;
  HTMLMediaElement.prototype.load = function loadDiagnosticMedia() {
    window.setTimeout(() => this.dispatchEvent(new Event('error')), 0);
  };
  try {
    await preloadPublicDeckAssets(project, {
      fetchImpl: async (input) => {
        fetchCalls.push(String(input));
        return new Response('ok');
      },
      onProgress: (event) => progressEvents.push(event),
    });
    const abortedController = new AbortController();
    abortedController.abort();
    await preloadPublicDeckAssets(project, {
      fetchImpl: async (input) => {
        fetchCalls.push(`aborted:${String(input)}`);
        return new Response('aborted');
      },
      onProgress: (event) => progressEvents.push(event),
      signal: abortedController.signal,
    });
  } finally {
    HTMLMediaElement.prototype.load = originalVideoLoad;
  }
  await preloadPublicDeckAssets(
    {
      ...project,
      assets: {},
      fonts: {},
    },
    { onProgress: (event) => progressEvents.push(event) },
  );

  return {
    fetchCalls,
    progressEvents,
  };
}

async function runAutomationDiagnostic() {
  let project = createAutomationProject();
  const controller = new editorAutomationController.EditorAutomationController({
    createProject: async ({ name }) => {
      project = { ...project, name: name ?? 'Untitled' };
      return project as never;
    },
    generateImage: async () => {
      project = {
        ...project,
        assets: {
          ...project.assets,
          generated: {
            id: 'generated',
            mimeType: 'image/png',
            name: 'Generated image',
            objectUrl: 'blob:generated',
            type: 'image',
          },
        },
      };
      return project as never;
    },
    generateSlides: async () => {
      project = {
        ...project,
        name: 'Generated deck',
        pages: [
          ...project.pages,
          {
            background: { color: '#101820', type: 'color' },
            elementIds: [],
            height: 1080,
            id: 'page-2',
            name: 'Slide 2',
            visible: true,
            width: 1920,
          },
        ],
      };
      return project as never;
    },
    getState: () => ({
      project: project as never,
      selection: { elementIds: ['text-1'], pageId: 'page-1', target: 'elements' },
    }),
    translateText: async (input) => {
      project = {
        ...project,
        elements: {
          ...project.elements,
          'text-1': {
            ...project.elements['text-1'],
            text: `[${input.targetLanguage}] selection`,
          },
        },
      };
      return { project: project as never, translatedPageIds: ['page-1'] };
    },
  });

  const created = await controller.createProject({ name: ' Automated Deck ' });
  const emptySlides = await controller.generateSlides({ prompt: ' ' });
  const slides = await controller.generateSlides({ prompt: 'Create a compact talk deck' });
  const invalidImage = await controller.generateImage({ height: 1, prompt: 'bad size', width: 1 });
  const image = await controller.generateImage({ height: 1024, prompt: 'Neon browser UI', width: 1024 });
  const invalidTranslation = await controller.translateText({ scope: 'bad', targetLanguage: 'pt' });
  const translated = await controller.translateText({ scope: 'selection', targetLanguage: 'pt' });
  const snapshot = controller.getProjectSnapshot();

  return {
    created: created.ok ? created.data.name : '',
    emptySlides: emptySlides.ok ? '' : emptySlides.errorCode,
    image: image.ok,
    invalidImage: invalidImage.ok ? '' : invalidImage.errorCode,
    invalidTranslation: invalidTranslation.ok ? '' : invalidTranslation.errorCode,
    pages: slides.ok ? slides.data.snapshot.pages.length : 0,
    snapshot: snapshot.ok ? snapshot.data.snapshot.pages.length : 0,
    translated: translated.ok ? translated.data.translatedPageIds : [],
  };
}

async function runPresenterSessionDiagnostic(payload: unknown) {
  const commands: string[] = [];
  const popupMessages: unknown[] = [];
  const fakePopup = {
    closed: false,
    close() {
      this.closed = true;
    },
    location: { href: '' },
    postMessage(message: unknown) {
      popupMessages.push(message);
    },
  };
  const publishedStates: unknown[] = [];
  const previewBatches: unknown[] = [];
  let remoteCommandHandler: ((command: never) => void) | undefined;
  const remoteCommands = [
    { command: 'update-notes', notes: 'Speaker note', pageId: 'slide-1' },
    { command: 'go-to-page', pageId: 'slide-2' },
    { command: 'request-previews', pageIds: ['slide-1', 'slide-2'], requestId: 'request-1' },
    { command: 'pause-timer' },
    { command: 'next' },
  ];
  const service = new BrowserPresenterSessionService({
    href: `${window.location.origin}/editor/`,
    openWindow: () => fakePopup as never,
    presenterDeviceId: 'device-1',
    randomId: () => 'session-1',
    remotePeerControlHostFactory: (options) => {
      remoteCommandHandler = options.onCommand as (command: never) => void;
      return {
        close() {
          commands.push('remote-close');
        },
        async open() {
          return {
            code: 'peer-code',
            connectedControllerCount: 1,
            controlPeerId: 'peer-control-1',
            expiresAt: '2026-07-20T00:10:00.000Z',
            presenterDeviceId: options.presenterDeviceId ?? 'device-1',
            presenterLabel: options.presenterLabel,
            sessionId: 'peer-session',
            transport: 'peerjs',
          };
        },
        publishPreviewBatch(batch) {
          previewBatches.push(batch);
        },
        publishState(state) {
          publishedStates.push(state);
        },
      };
    },
    resolveRemoteControlOrigin: async () => 'https://remote.localstudio.test',
    targetWindow: window,
  });

  const unsubscribe = service.subscribeToCommands((command) => commands.push(command.command));
  const opened = service.openPresenterWindow();
  service.publishState(payload as never);
  window.postMessage(
    {
      command: 'request-state',
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      command: 'go-to-page',
      pageId: 'slide-2',
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      command: 'update-timer',
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      timer: { elapsedMs: 1_250, paused: false, updatedAtEpochMs: Date.now() },
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      audioBlob: new Blob(['recording'], { type: 'audio/webm' }),
      command: 'save-recording',
      recording: { id: 'window-recording', segments: [] },
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      command: 'update-notes',
      notes: 'Window note',
      pageId: 'slide-1',
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      command: 'update-stream-peer',
      peerId: 'stream-peer',
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  window.postMessage(
    {
      command: 'save-recording',
      recording: undefined,
      sessionId: opened.sessionId,
      source: 'localstudio-presenter-window',
      type: 'command',
    },
    window.location.origin,
  );
  const remote = await service.openRemoteControlSession({
    presenterDeviceId: 'device-1',
    presenterLabel: 'Coverage presenter',
    ttlMs: 60_000,
  });
  const remoteAgain = await service.openRemoteControlSession({
    presenterDeviceId: 'device-1',
    presenterLabel: 'Coverage presenter',
    ttlMs: 60_000,
  });
  service.publishState(payload as never);
  for (const command of remoteCommands) {
    remoteCommandHandler?.(command as never);
  }
  await new Promise((resolve) => window.setTimeout(resolve, 20));
  unsubscribe();
  service.closePresenterWindow();

  const legacyCommands: string[] = [];
  const legacyStates: unknown[] = [];
  const legacyClosed: string[] = [];
  let legacyTakeCount = 0;
  const legacyService = new BrowserPresenterSessionService({
    href: `${window.location.origin}/editor/`,
    presenterDeviceId: 'legacy-device',
    randomId: () => 'legacy-session-1',
    remoteSignalingService: {
      closeSession: async (code) => {
        legacyClosed.push(code);
        return true;
      },
      publishState: async (_code, state) => {
        legacyStates.push(state);
        return true;
      },
      registerSession: async (input) => ({
        code: 'legacy-code',
        connectedControllerCount: 2,
        expiresAt: '2026-07-20T00:10:00.000Z',
        presenterDeviceId: input.presenterDeviceId ?? 'legacy-device',
        presenterLabel: input.presenterLabel,
        sessionId: 'legacy-remote-session',
        startedAt: Date.now(),
      }),
      takeCommands: async () => {
        legacyTakeCount += 1;
        if (legacyTakeCount > 1) return [];
        return [
          { command: 'reset-timer' },
          { command: 'resume-timer' },
          { command: 'go-to-page', pageId: 'slide-1' },
        ] as never;
      },
    },
    resolveRemoteControlOrigin: async () => undefined,
    targetWindow: window,
  });
  const unsubscribeLegacy = legacyService.subscribeToCommands((command) =>
    legacyCommands.push(command.command),
  );
  const legacyRemote = await legacyService.openRemoteControlSession({
    presenterDeviceId: 'legacy-device',
    presenterLabel: 'Legacy coverage presenter',
    ttlMs: 60_000,
  });
  legacyService.publishState(payload as never);
  await new Promise((resolve) => window.setTimeout(resolve, 310));
  unsubscribeLegacy();
  legacyService.closePresenterWindow();

  return {
    commands,
    legacy: {
      closed: legacyClosed,
      commands: legacyCommands,
      qrUrl: legacyRemote.qrUrl,
      states: legacyStates.length,
    },
    opened: opened.status,
    popupMessages: popupMessages.length,
    previewBatches: previewBatches.length,
    publishedStates: publishedStates.length,
    remote: remote.transport,
    sameRemoteSession: remote === remoteAgain,
  };
}

function createAutomationProject() {
  return {
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
      'video-1': {
        assetId: 'asset-video',
        autoplayInPreview: true,
        controls: true,
        durationSeconds: 30,
        height: 360,
        id: 'video-1',
        locked: false,
        loop: true,
        muted: false,
        opacity: 1,
        playAcrossSlides: true,
        playbackPositionSeconds: 5,
        playing: true,
        posterFrameSeconds: 2,
        repeatMode: 'loop',
        rotation: 0,
        startOnClick: false,
        trimEndSeconds: 25,
        trimStartSeconds: 1,
        type: 'video',
        visible: true,
        volume: 0.7,
        width: 640,
        x: 120,
        y: 160,
      },
    },
    fonts: {},
    id: 'project-automation',
    name: 'Automation Contract',
    pages: [
      {
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['text-1', 'video-1'],
        height: 1080,
        id: 'page-1',
        name: 'Slide 1',
        visible: true,
        width: 1920,
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

async function runStorageDiagnostic() {
  const project = createStorageDiagnosticProject();
  const fileRoot = new E2EFakeDirectoryHandle('file-root');
  const savedHandles: string[] = [];
  const fileRepository = new BrowserFileSystemProjectRepository({
    pickDirectory: async () => fileRoot as never,
    recentProjectStore: {
      load: async () => fileRoot as never,
      save: async (handle, projectName) => {
        savedHandles.push(`${handle.name}:${projectName ?? ''}`);
      },
    },
  });
  await fileRepository.saveProject(project as never, { projectDirectoryName: 'Storage Diagnostic' });
  const loadedFileProject = await fileRepository.loadProject();
  const importedFileProject = await fileRepository.importProject();
  const version = await fileRepository.saveVersion(
    { ...project, name: 'Storage Diagnostic v2' } as never,
    { previousProject: project as never },
  );
  const loadedVersion = await fileRepository.loadVersion(version.id);
  const history = await fileRepository.getVersionHistory();
  const mirrorParentRoot = new E2EFakeDirectoryHandle('mirror-parent');
  const mirrorRepository = new BrowserFileSystemProjectRepository({
    pickDirectory: async () => mirrorParentRoot as never,
    recentProjectStore: {
      load: async () => null,
      save: async (handle, projectName) => {
        savedHandles.push(`mirror:${handle.name}:${projectName ?? ''}`);
      },
    },
  });
  const missingBackedProject = {
    ...project,
    assets: {
      ...project.assets,
      missing: {
        fileName: 'missing.png',
        id: 'missing',
        mimeType: 'image/png',
        name: 'Missing image',
        storage: 'file',
        type: 'image',
      },
    },
    fonts: {
      ...project.fonts,
      missingFont: {
        family: 'Missing',
        fileName: 'missing.woff2',
        id: 'missingFont',
        storage: 'file',
      },
    },
    recordings: {
      ...project.recordings,
      missingRecording: {
        ...project.recordings['recording-1'],
        id: 'missingRecording',
        audio: {
          fileName: 'missing.webm',
          mimeType: 'audio/webm',
          storage: 'file',
        },
      },
    },
    name: 'Imported Mirror Diagnostic',
  };
  const importedMirrorProject = await mirrorRepository.importMirrorFiles([
    {
      blob: new Blob([JSON.stringify(missingBackedProject)], { type: 'application/json' }),
      path: 'project.json',
    },
    { blob: new Blob(['nested-config'], { type: 'application/json' }), path: 'config/localstudio.json' },
  ]);
  const remoteRepository = new BrowserFileSystemProjectRepository({
    fetch: async () => new Response(new Blob(['remote-image'], { type: 'image/png' })),
    pickDirectory: async () => fileRoot as never,
    recentProjectStore: {
      load: async () => fileRoot as never,
      save: async () => undefined,
    },
  });
  await remoteRepository.saveProject(
    {
      ...project,
      assets: {
        remote: {
          id: 'remote',
          mimeType: 'image/png',
          name: 'Remote image',
          objectUrl: 'https://cdn.localstudio.test/remote.png',
          storage: 'remote',
          type: 'image',
        },
      },
      fonts: {},
      recordings: {},
    } as never,
    { projectDirectoryName: 'Remote Diagnostic' },
  );
  const remoteLoaded = await remoteRepository.loadProject();
  const deniedRepository = new BrowserFileSystemProjectRepository({
    pickDirectory: async () => new E2EDeniedDirectoryHandle('denied-root') as never,
    recentProjectStore: {
      load: async () => null,
      save: async () => undefined,
    },
  });
  const deniedMessage = await deniedRepository
    .saveProject(project as never)
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));
  const disabledRepository = new DisabledProjectRepository();
  await disabledRepository.saveProject(project as never);

  const opfsRoot = new E2EFakeDirectoryHandle('opfs-root');
  const memoryStorage = new Map<string, string>();
  const opfsRepository = new OpfsProjectRepository({
    getRootDirectory: async () => opfsRoot as never,
    storage: {
      getItem: (key) => memoryStorage.get(key) ?? null,
      removeItem: (key) => {
        memoryStorage.delete(key);
      },
      setItem: (key, value) => {
        memoryStorage.set(key, value);
      },
    },
  });
  await opfsRepository.saveProject(project as never);
  const loadedOpfsProject = await opfsRepository.loadProject();
  const opfsVersion = await opfsRepository.saveVersion(
    { ...project, name: 'Storage Diagnostic OPFS v2' } as never,
    { previousProject: project as never },
  );
  const loadedOpfsVersion = await opfsRepository.loadVersion(opfsVersion.id);
  const imported = await opfsRepository.importMirrorFiles([
    { blob: new Blob([JSON.stringify(project)], { type: 'application/json' }), path: 'project.json' },
    { blob: new Blob(['image-bytes'], { type: 'image/png' }), path: 'assets/asset-kept.png' },
    { blob: new Blob(['audio-bytes'], { type: 'audio/webm' }), path: 'recordings/recording-1.webm' },
  ]);

  return {
    disabled: await disabledRepository.loadProject(),
    deniedMessage,
    fileHistory: history.length,
    fileImported: importedFileProject?.name,
    fileLoaded: loadedFileProject?.name,
    fileVersion: loadedVersion?.name,
    imported: imported.name,
    importedMirror: importedMirrorProject.name,
    opfsLoaded: loadedOpfsProject?.name,
    opfsVersion: loadedOpfsVersion?.name,
    remoteLoaded: remoteLoaded?.assets.remote?.objectUrl?.startsWith('blob:') ?? false,
    savedHandles,
  };
}

function createStorageDiagnosticProject() {
  return {
    assets: {
      'asset-kept': {
        id: 'asset-kept',
        mimeType: 'image/png',
        name: 'Kept image',
        objectUrl: 'data:image/png;base64,aW1hZ2UtYnl0ZXM=',
        type: 'image',
      },
    },
    createdAt: '2026-07-20T00:00:00.000Z',
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
        objectUrl: 'data:font/woff2;base64,Zm9udC1ieXRlcw==',
        storage: 'browser',
      },
    },
    id: 'project-storage-diagnostic',
    name: 'Storage Diagnostic',
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
    recordings: {
      'recording-1': {
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'data:audio/webm;base64,YXVkaW8tYnl0ZXM=',
          storage: 'inline',
        },
        createdAt: '2026-07-20T00:00:00.000Z',
        durationMs: 2_000,
        id: 'recording-1',
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        name: 'Recording 1',
        segments: [
          {
            endMs: 2_000,
            final: true,
            id: 'segment-1',
            pageId: 'page-1',
            pageIndex: 0,
            pageName: 'Slide 1',
            startMs: 0,
            text: 'Storage diagnostic transcript.',
          },
        ],
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
    },
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

function createCommandDiagnosticProject() {
  return {
    assets: {
      'asset-image': {
        id: 'asset-image',
        mimeType: 'image/png',
        name: 'Image',
        objectUrl: 'blob:image',
        type: 'image',
      },
      'asset-video': {
        id: 'asset-video',
        mimeType: 'video/mp4',
        name: 'Video',
        objectUrl: 'blob:video',
        type: 'video',
      },
    },
    createdAt: '2026-07-20T00:00:00.000Z',
    elements: {
      'image-1': {
        assetId: 'asset-image',
        height: 240,
        id: 'image-1',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 320,
        x: 120,
        y: 160,
      },
      'text-1': {
        ...createTextElement('text-1', 'Command title'),
        fontSize: 56,
        locked: false,
        visible: true,
      },
      'video-1': {
        assetId: 'asset-video',
        autoplayInPreview: true,
        controls: true,
        durationSeconds: 30,
        height: 360,
        id: 'video-1',
        locked: false,
        loop: false,
        muted: false,
        opacity: 1,
        playAcrossSlides: false,
        playbackPositionSeconds: 0,
        playing: false,
        posterFrameSeconds: 2,
        repeatMode: 'none',
        rotation: 0,
        startOnClick: true,
        trimEndSeconds: 25,
        trimStartSeconds: 3,
        type: 'video',
        visible: true,
        volume: 0.8,
        width: 640,
        x: 560,
        y: 300,
      },
    },
    fonts: {},
    id: 'project-command-diagnostic',
    name: 'Command Diagnostic',
    pages: [
      {
        animationBuilds: [
          {
            delayMs: 0,
            durationMs: 300,
            effect: 'reveal',
            elementId: 'video-1',
            id: 'movie-build-1',
            mediaAction: 'play',
            trigger: 'on-click',
          },
        ],
        background: { color: '#ffffff', type: 'color' },
        elementIds: ['text-1', 'image-1', 'video-1'],
        height: 1080,
        id: 'page-1',
        name: 'Slide 1',
        visible: true,
        width: 1920,
      },
    ],
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

function createPublicDeckDiagnosticProject() {
  const project = createCommandDiagnosticProject();
  return {
    ...project,
    id: 'public-diagnostic-project',
    name: 'Public Diagnostic',
    pages: [
      ...project.pages,
      {
        background: { color: '#111827', type: 'color' },
        elementIds: ['public-text-2'],
        height: 1080,
        id: 'page-2',
        name: 'Public Slide 2',
        visible: true,
        width: 1920,
      },
      {
        background: { color: '#0f172a', type: 'color' },
        elementIds: ['public-text-3'],
        height: 1080,
        id: 'page-3',
        name: 'Public Slide 3',
        visible: true,
        width: 1920,
      },
    ],
    elements: {
      ...project.elements,
      'public-text-2': {
        ...createTextElement('public-text-2', 'Second public diagnostic slide'),
        fill: '#ffffff',
        locked: false,
        visible: true,
        x: 240,
        y: 300,
      },
      'public-text-3': {
        ...createTextElement('public-text-3', 'Third public diagnostic slide'),
        fill: '#37FD76',
        locked: false,
        visible: true,
        x: 240,
        y: 300,
      },
    },
    recordings: {
      'public-recording': {
        audio: {
          mimeType: 'audio/webm;codecs=opus',
          objectUrl: 'data:audio/webm;base64,YXVkaW8tYnl0ZXM=',
          storage: 'inline' as const,
        },
        createdAt: '2026-07-20T00:00:00.000Z',
        durationMs: 8_000,
        id: 'public-recording',
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        name: 'Public diagnostic recording',
        segments: [
          {
            endMs: 3_000,
            final: true,
            id: 'public-segment-1',
            pageId: 'page-1',
            pageIndex: 0,
            pageName: 'Slide 1',
            startMs: 0,
            text: '[Slide 1] Public diagnostics opening.',
          },
          {
            endMs: 8_000,
            final: true,
            id: 'public-segment-2',
            pageId: 'page-2',
            pageIndex: 1,
            pageName: 'Public Slide 2',
            startMs: 3_000,
            text: '[Slide 2] Public diagnostics continuation.',
          },
        ],
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
    },
  };
}

class E2EFakeFileHandle {
  kind = 'file' as const;
  private blob = new Blob([]);

  constructor(
    readonly name: string,
    initialBlob?: Blob,
  ) {
    if (initialBlob) this.blob = initialBlob;
  }

  async createWritable() {
    return {
      close: async () => undefined,
      write: async (value: Blob | string) => {
        this.blob = value instanceof Blob ? value : new Blob([value], { type: 'text/plain' });
      },
    };
  }

  async getFile() {
    return new File([this.blob], this.name, { type: this.blob.type });
  }
}

class E2EFakeDirectoryHandle {
  kind = 'directory' as const;
  private readonly directories = new Map<string, E2EFakeDirectoryHandle>();
  private readonly files = new Map<string, E2EFakeFileHandle>();

  constructor(readonly name: string) {}

  async getDirectoryHandle(name: string, options: { create?: boolean } = {}) {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options.create) throw new DOMException('Directory not found.', 'NotFoundError');
    const directory = new E2EFakeDirectoryHandle(name);
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(name: string, options: { create?: boolean } = {}) {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options.create) throw new DOMException('File not found.', 'NotFoundError');
    const file = new E2EFakeFileHandle(name);
    this.files.set(name, file);
    return file;
  }

  addFile(name: string, blob: Blob) {
    this.files.set(name, new E2EFakeFileHandle(name, blob));
  }

  async queryPermission() {
    return 'granted' as PermissionState;
  }

  async requestPermission() {
    return 'granted' as PermissionState;
  }

  async removeEntry(name: string) {
    this.files.delete(name);
    this.directories.delete(name);
  }

  async *entries(): AsyncIterable<[string, E2EFakeDirectoryHandle | E2EFakeFileHandle]> {
    for (const entry of this.directories) yield entry;
    for (const entry of this.files) yield entry;
  }
}

class E2EDeniedDirectoryHandle extends E2EFakeDirectoryHandle {
  override async queryPermission() {
    return 'denied' as PermissionState;
  }

  override async requestPermission() {
    return 'denied' as PermissionState;
  }
}

function createRemoteProject() {
  const largeImageDataUrl = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#37FD76"/><text x="80" y="120" font-size="48">Remote preview</text><!--${'x'.repeat(12_000)}--></svg>`,
  )}`;
  return {
    assets: {
      image: {
        id: 'image',
        mimeType: 'image/png',
        name: 'Image',
        objectUrl: largeImageDataUrl,
        type: 'image',
      },
      video: {
        id: 'video',
        mimeType: 'video/mp4',
        name: 'Video',
        objectUrl: 'data:video/mp4;base64,dmlkZW8=',
        type: 'video',
      },
    },
    createdAt: '2026-07-20T00:00:00.000Z',
    elements: {
      hidden: { ...createTextElement('hidden', 'Hidden'), visible: false },
      image: {
        assetId: 'image',
        height: 240,
        id: 'image',
        locked: false,
        opacity: 1,
        rotation: 0,
        type: 'image',
        visible: true,
        width: 360,
        x: 120,
        y: 160,
      },
      shape: {
        fill: '#37FD76',
        height: 200,
        id: 'shape',
        locked: false,
        opacity: 1,
        rotation: 0,
        shape: 'ellipse',
        stroke: '#111827',
        strokeWidth: 2,
        type: 'shape',
        visible: true,
        width: 200,
        x: 620,
        y: 300,
      },
      video: {
        assetId: 'video',
        autoplayInPreview: true,
        controls: true,
        durationSeconds: 12,
        height: 220,
        id: 'video',
        locked: false,
        loop: true,
        muted: true,
        opacity: 1,
        playbackPositionSeconds: 0,
        playing: true,
        posterFrameSeconds: 3,
        repeatMode: 'loop',
        rotation: 0,
        trimStartSeconds: 1,
        type: 'video',
        visible: true,
        width: 360,
        x: 860,
        y: 520,
      },
      title: {
        ...createTextElement('title', 'Remote preview'),
        fontFamily: 'Inter',
        fontWeight: 700,
        lineHeight: 1.1,
        locked: false,
        verticalAlign: 'middle',
        visible: true,
      },
    },
    id: 'remote-state-project',
    name: 'Remote State Project',
    pages: [
      {
        animationBuilds: [
          { delayMs: 0, durationMs: 300, effect: 'fade', elementId: 'title', id: 'build-1', kind: 'build-in', trigger: 'on-click' },
          { delayMs: 0, durationMs: 300, effect: 'wipe', elementId: 'shape', id: 'build-2', kind: 'build-out', trigger: 'after-previous' },
        ],
        background: { color: '#020617', type: 'color' },
        elementIds: ['title', 'image', 'shape', 'video', 'hidden'],
        height: 1080,
        id: 'slide-1',
        name: 'Opening',
        speakerNotes: 'Talk track',
        width: 1920,
      },
      {
        background: { assetId: 'image', colorFallback: '#111827', type: 'asset' },
        elementIds: ['shape'],
        height: 1080,
        id: 'slide-2',
        name: 'Next',
        speakerNotes: '',
        width: 1920,
      },
    ],
    updatedAt: '2026-07-20T00:00:00.000Z',
  };
}

function installRemotePreviewMediaDiagnostics() {
  const originalImage = window.Image;
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = ((tagName: string, options?: ElementCreationOptions) => {
    const normalizedTagName = tagName.toLowerCase();
    if (normalizedTagName === 'video') {
      let currentTime = 0;
      const video = originalCreateElement(tagName, options) as HTMLVideoElement;
      Object.defineProperties(video, {
        currentTime: {
          configurable: true,
          get: () => currentTime,
          set: (value: number) => {
            currentTime = value;
            window.setTimeout(() => video.onseeked?.(new Event('seeked')), 0);
          },
        },
        duration: { configurable: true, value: 12 },
        readyState: { configurable: true, value: HTMLMediaElement.HAVE_CURRENT_DATA },
        videoHeight: { configurable: true, value: 720 },
        videoWidth: { configurable: true, value: 1280 },
      });
      video.load = () => {
          window.setTimeout(() => video.onloadedmetadata?.(new Event('loadedmetadata')), 0);
      };
      video.play = () => Promise.resolve();
      video.pause = () => undefined;
      return video;
    }
    return originalCreateElement(tagName, options);
  }) as typeof document.createElement;
  return () => {
    window.Image = originalImage;
    document.createElement = originalCreateElement as typeof document.createElement;
  };
}

async function runRecorderDiagnostic() {
  const chunks: Array<{ durationMs: number; size: number }> = [];
  const stoppedTracks: string[] = [];
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const revokedUrls: string[] = [];
  URL.createObjectURL = () => 'blob:diagnostic-recording';
  URL.revokeObjectURL = (url) => revokedUrls.push(url);
  const recorder = new PresenterAudioRecorder({
    getUserMedia: async () =>
      ({
        getTracks: () => [
          {
            stop: () => stoppedTracks.push('stopped'),
          },
        ],
      }) as unknown as MediaStream,
    mediaRecorderFactory: (_stream, options) => {
      const eventTarget = new EventTarget();
      return Object.assign(eventTarget, {
        mimeType: options.mimeType ?? 'audio/webm',
        pause() {
          this.state = 'paused';
        },
        requestData() {
          eventTarget.dispatchEvent(
            new BlobEvent('dataavailable', { data: new Blob(['chunk'], { type: this.mimeType }) }),
          );
        },
        resume() {
          this.state = 'recording';
        },
        start() {
          this.state = 'recording';
          this.requestData();
        },
        state: 'inactive',
        stop() {
          this.state = 'inactive';
          eventTarget.dispatchEvent(
            new BlobEvent('dataavailable', { data: new Blob(['final'], { type: this.mimeType }) }),
          );
          eventTarget.dispatchEvent(new Event('stop'));
        },
      }) as MediaRecorder;
    },
    onChunk: (chunk) => chunks.push({ durationMs: chunk.durationMs, size: chunk.blob.size }),
    timesliceMs: 5,
  });
  await recorder.start();
  const recording = recorder.isRecording();
  recorder.pause();
  recorder.resume();
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  const result = await recorder.stop();
  const objectUrl = recorder.getObjectUrl();
  recorder.revokeObjectUrl();
  const stopBeforeStart = await new PresenterAudioRecorder()
    .stop()
    .then(() => '', (error: unknown) => (error instanceof Error ? error.message : String(error)));
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
  return {
    chunks: chunks.length,
    duration: result.durationMs > 0,
    mimeType: result.mimeType,
    objectUrl,
    recording,
    revokedUrls,
    stopBeforeStart,
    stoppedTracks: stoppedTracks.length,
  };
}

async function runSpeechDiagnostic() {
  const updates: string[] = [];
  const errors: string[] = [];
  let activeRecognition: FakeRecognition | undefined;
  class FakeRecognition {
    continuous = false;
    interimResults = false;
    lang = '';
    maxAlternatives = 0;
    onend: (() => void) | null = null;
    onerror: ((event: { error?: string; message?: string }) => void) | null = null;
    onresult:
      | ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void)
      | null = null;
    abort() {
      this.onend?.();
    }
    emit(results: Array<{ final: boolean; text: string }>, resultIndex = 0) {
      this.onresult?.({
        resultIndex,
        results: results.map((result) => ({
          0: { transcript: result.text },
          isFinal: result.final,
        })),
      });
    }
    start() {
      activeRecognition = this;
      this.emit([{ final: false, text: 'partial text' }]);
    }
    stop() {
      this.onend?.();
    }
  }
  const transcriber = new PresenterSpeechTranscriber({
    onError: (message) => errors.push(message),
    onTranscript: (update) => updates.push(`${update.final}:${update.text}`),
    recognitionConstructor: FakeRecognition as never,
  });
  transcriber.start('pt-BR');
  activeRecognition?.emit([{ final: true, text: 'final text' }]);
  activeRecognition?.emit([{ final: true, text: 'final text' }]);
  activeRecognition?.emit([{ final: false, text: '' }]);
  activeRecognition?.onerror?.({ error: 'no-speech' });
  activeRecognition?.onerror?.({ error: 'not-allowed' });
  activeRecognition?.onerror?.({ error: 'network', message: 'Network down' });
  await transcriber.setLanguage('pt-BR');
  await transcriber.setLanguage('en-US');
  const language = activeRecognition?.lang;
  await transcriber.stop();
  return { errors, language, text: transcriber.getText(), updates };
}

function createShareProject() {
  return {
    id: 'share-recording-contract-project',
    name: 'Share recording contract',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    assets: {},
    elements: {},
    pages: [],
    recordings: {
      first: {
        id: 'first',
        name: 'First take',
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z',
        durationMs: 1_000,
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        audio: { mimeType: 'audio/webm;codecs=opus', objectUrl: 'blob:first', storage: 'inline' },
        segments: [],
      },
      second: {
        id: 'second',
        name: 'Second take',
        createdAt: '2026-07-20T00:01:00.000Z',
        updatedAt: '2026-07-20T00:01:00.000Z',
        durationMs: 2_000,
        language: 'en-US',
        modelPresetId: 'web-speech-api',
        audio: { mimeType: 'audio/webm;codecs=opus', objectUrl: 'blob:second', storage: 'inline' },
        segments: [],
      },
    },
  };
}
