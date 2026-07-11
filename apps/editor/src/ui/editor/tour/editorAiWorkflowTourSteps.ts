import { editorAiWorkflowTourDom } from './editorAiWorkflowTourDom';
import { editorAiWorkflowTourSelectors } from './editorAiWorkflowTourSelectors';
import type {
  EditorAiWorkflowTourCallbacks,
  EditorAiWorkflowTourStep,
} from './editorAiWorkflowTourTypes';

export function createEditorAiWorkflowTourSteps({
  onCloseTourSurfaces,
  onOpenAiTools,
  onOpenSettings,
  onOpenMirrorSettings,
}: EditorAiWorkflowTourCallbacks): EditorAiWorkflowTourStep[] {
  const selectors = editorAiWorkflowTourSelectors;
  return [
    {
      id: 'open-ai-tools',
      element: editorAiWorkflowTourDom.tourSelector(selectors.aiToolsTab),
      prepare: async () => {
        onCloseTourSurfaces();
        editorAiWorkflowTourDom.collapseDocumentMenus();
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Open AI Tools',
        description:
          'Start from the collapsed tools rail. The setup lives in AI Tools because every advanced workflow depends on these local features.',
        side: 'right',
        align: 'center',
      },
    },
    {
      id: 'prepare-ai-features',
      element: editorAiWorkflowTourDom.firstTourElement(
        selectors.aiFeatureSetup,
        selectors.aiToolsPanel,
      ),
      prepare: async () => {
        await editorAiWorkflowTourDom.openAiToolsForTour({
          fallbackOpenerId: selectors.aiToolsTab,
          onOpenAiTools,
          panelId: selectors.aiToolsPanel,
        });
      },
      popover: {
        title: 'Prepare the AI runtime',
        description:
          'Start here before generating slides or images. Download all required browser models once, then leave this tab while the downloads finish.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'create-image-workflow',
      element: editorAiWorkflowTourDom.tourSelector(selectors.promptWorkflow),
      popover: {
        title: 'Create images from the prompt bar',
        description:
          'With Create image active, the prompt bar turns text into generated media for the current deck.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'create-image-examples',
      element: editorAiWorkflowTourDom.tourSelector(selectors.promptExamples),
      popover: {
        title: 'Use the prompt recipes',
        description:
          'These chips give users safe starting points while they learn what the local image model responds to.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'prompt-to-slide-mode',
      element: editorAiWorkflowTourDom.tourSelector(selectors.promptCreateImageToken),
      popover: {
        title: 'Switch back to slide prompts',
        description:
          'Remove the Create image token to turn this same composer into prompt-to-slide mode.',
        side: 'top',
        align: 'center',
      },
    },
    {
      id: 'prompt-submit',
      element: editorAiWorkflowTourDom.tourSelector(selectors.promptSubmitActions),
      popover: {
        title: 'Generate or stop from here',
        description:
          'Submit starts the selected AI workflow. The same control area becomes Stop while generation is running.',
        side: 'top',
        align: 'end',
      },
    },
    {
      id: 'import-powerpoint',
      element: editorAiWorkflowTourDom.tourSelector(selectors.fileMenuButton),
      prepare: async () => {
        onCloseTourSurfaces();
        editorAiWorkflowTourDom.collapseDocumentMenus();
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Open the File menu',
        description:
          'PowerPoint import starts from File. This keeps import, export, storage, and sharing actions in one predictable place.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      id: 'open-import-menu',
      element: editorAiWorkflowTourDom.tourSelector(selectors.fileImportMenuItem),
      prepare: async () => {
        await editorAiWorkflowTourDom.ensureTargetAvailable(
          selectors.fileImportMenuItem,
          selectors.fileMenuButton,
        );
      },
      popover: {
        title: 'Choose Import',
        description: 'Import groups the ways to bring existing work into LocalStudio.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'choose-powerpoint',
      element: editorAiWorkflowTourDom.tourSelector(selectors.fileImportPptxItem),
      prepare: async () => {
        await editorAiWorkflowTourDom.ensureTargetAvailable(
          selectors.fileImportMenuItem,
          selectors.fileMenuButton,
        );
        await editorAiWorkflowTourDom.ensureTargetAvailable(
          selectors.fileImportPptxItem,
          selectors.fileImportMenuItem,
        );
      },
      popover: {
        title: 'Bring in an existing deck',
        description:
          'Import PowerPoint when users already have real content. It is the fastest path to refining a deck with AI.',
        side: 'right',
        align: 'start',
      },
    },
    {
      id: 'enable-storage',
      element: editorAiWorkflowTourDom.tourSelector(selectors.storageToggle),
      prepare: async () => {
        editorAiWorkflowTourDom.collapseDocumentMenus();
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Enable local storage',
        description:
          'Storage keeps project files available for version history, mirroring, and safer long-running AI workflows.',
        side: 'bottom',
        align: 'end',
      },
    },
    {
      id: 'mirror-settings',
      element: editorAiWorkflowTourDom.tourSelector(selectors.mirrorSettingsFields),
      prepare: async () => {
        onOpenMirrorSettings();
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Configure S3-compatible mirroring',
        description:
          'Add the S3-compatible endpoint, bucket, and keys here, then test the connection before sharing from remote storage.',
        side: 'left',
        align: 'start',
      },
    },
    {
      id: 'mirror-actions',
      element: editorAiWorkflowTourDom.tourSelector(selectors.mirrorSettingsActions),
      popover: {
        title: 'Test, enable, and save',
        description:
          'These actions make mirroring explicit: verify the connection, enable sync, then save the settings.',
        side: 'left',
        align: 'end',
      },
    },
    {
      id: 'open-settings',
      element: editorAiWorkflowTourDom.tourSelector(selectors.settingsMediaRow),
      prepare: async () => {
        onCloseTourSurfaces();
        onOpenSettings();
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Open media integrations',
        description:
          'Settings is where external provider keys live. Choose Media integrations to connect stock image and GIF search.',
        side: 'left',
        align: 'center',
      },
    },
    {
      id: 'media-integrations',
      element: editorAiWorkflowTourDom.tourSelector(selectors.mediaIntegrationsPanel),
      prepare: async () => {
        await editorAiWorkflowTourDom.ensureTargetAvailable(
          selectors.settingsMediaRow,
          selectors.footerSettings,
        );
        await editorAiWorkflowTourDom.clickWhenAvailable(selectors.settingsMediaRow);
        await editorAiWorkflowTourDom.waitForTourPaint();
      },
      popover: {
        title: 'Connect stock media',
        description:
          'Unsplash and GIPHY keys unlock the stock image and GIF searches in the Elements workflow.',
        side: 'left',
        align: 'start',
      },
    },
    {
      id: 'unsplash-and-giphy',
      element: editorAiWorkflowTourDom.tourSelector(selectors.unsplashConfig),
      popover: {
        title: 'Paste provider keys',
        description:
          'Unsplash powers still images. GIPHY sits just below for animated GIFs and video-backed GIF imports.',
        side: 'left',
        align: 'center',
      },
    },
    {
      id: 'save-media-integrations',
      element: editorAiWorkflowTourDom.tourSelector(selectors.mediaIntegrationsActions),
      popover: {
        title: 'Save the media setup',
        description:
          'Provider keys stay in this browser profile, keeping demos and local work self-contained.',
        side: 'left',
        align: 'end',
      },
    },
  ];
}
