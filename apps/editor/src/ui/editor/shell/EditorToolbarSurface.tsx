import type { AppServices } from '../../../app/composition';
import { LocalProjectSetupPanel } from '../panels/LocalProjectSetupPanel';
import type { OperationNoticeState, useEditorViewModel } from '../state/useEditorViewModel';
import { TopToolbar } from '../toolbars/TopToolbar';

type EditorViewModel = ReturnType<typeof useEditorViewModel>;

interface EditorToolbarSurfaceProps {
  deckTranslationStatus: string | undefined;
  hasDirectoryPersistence: boolean;
  hasSelection: boolean;
  imageExportNotice: OperationNoticeState | undefined;
  isExportingImages: boolean;
  isHistoryReadOnly: boolean;
  services: AppServices;
  vm: EditorViewModel;
  onExportImages: () => void;
  onNewProject: () => void;
  onOpenKeyboardShortcuts: () => void;
  onOpenPresenterView: () => void;
  onLocalProjectSetupCancel?: () => void;
  onLocalProjectSetupConfirm?: () => void;
  onShare: () => void;
  onStartAiSetupTour: () => void;
  onStartPresenterMode: (options?: { fromBeginning?: boolean }) => void;
}

export function EditorToolbarSurface({
  deckTranslationStatus,
  hasDirectoryPersistence,
  hasSelection,
  imageExportNotice,
  isExportingImages,
  isHistoryReadOnly,
  services,
  vm,
  onExportImages,
  onNewProject,
  onOpenKeyboardShortcuts,
  onOpenPresenterView,
  onLocalProjectSetupCancel,
  onLocalProjectSetupConfirm,
  onShare,
  onStartAiSetupTour,
  onStartPresenterMode,
}: EditorToolbarSurfaceProps) {
  return (
    <TopToolbar
      project={vm.project}
      language={vm.activeSlideLanguage.displayCode}
      languageFlag={vm.activeSlideLanguage.flag}
      languageLabel={vm.activeSlideLanguage.label}
      canRedo={!isHistoryReadOnly && vm.canRedo}
      canUndo={!isHistoryReadOnly && vm.canUndo}
      hasSelection={!isHistoryReadOnly && hasSelection}
      persistenceEnabled={vm.persistenceEnabled}
      mirrorState={vm.mirrorState}
      mirrorDisabledBySettings={vm.mirrorDisabledBySettings}
      persistenceAttention={vm.persistenceAttention}
      operationNotice={imageExportNotice ?? vm.operationNotice}
      localProjectSetupPanel={
        vm.localProjectSetupOpen ? (
          <LocalProjectSetupPanel
            initialName={vm.project.name}
            onCancel={() => {
              vm.closeLocalProjectSetup();
              onLocalProjectSetupCancel?.();
            }}
            onConfirm={(projectName) => {
              void vm.confirmLocalProjectSetup(projectName).then((saved) => {
                if (saved) onLocalProjectSetupConfirm?.();
              });
            }}
          />
        ) : null
      }
      lastEditedAt={vm.lastEditedAt}
      saveAnimationKey={vm.saveAnimationKey}
      canTranslateDeck={vm.canTranslateDeck}
      deckTranslationStatus={deckTranslationStatus}
      isTranslatingDeck={Boolean(vm.deckTranslationProgress)}
      isExportingImages={isExportingImages}
      isExportingPowerPoint={vm.isExportingPowerPoint}
      translationLanguageOptions={vm.translationLanguageOptions}
      translationSourceLanguage={vm.activeSlideLanguage.code}
      translationTargetLanguage={vm.translationTargetLanguage}
      persistenceAvailable={services.persistenceAvailable}
      persistenceMode={services.persistenceMode}
      onDelete={isHistoryReadOnly ? undefined : vm.deleteSelectedElement}
      onDuplicate={isHistoryReadOnly ? undefined : vm.duplicateSelectedElement}
      onImportRemoteMirror={() => {
        void vm.importRemoteMirror();
      }}
      onImportProject={
        hasDirectoryPersistence
          ? () => {
              void vm.importProject();
            }
          : undefined
      }
      onImportPowerPoint={() => {
        void vm.importPowerPoint();
      }}
      onExportPowerPoint={() => {
        void vm.exportPowerPoint();
      }}
      onExportImages={onExportImages}
      onMirrorNow={() => {
        vm.requestMirrorNow();
      }}
      onMirrorToggle={vm.setMirrorEnabled}
      onNewProject={onNewProject}
      onOpenMirrorSettings={vm.openMirrorSettings}
      onOpenKeyboardShortcuts={onOpenKeyboardShortcuts}
      onStartAiSetupTour={onStartAiSetupTour}
      onOpenVersionHistory={() => {
        void vm.openVersionHistory();
      }}
      onPersistenceToggle={(enabled) => {
        void vm.setPersistence(enabled);
      }}
      onProjectNameChange={isHistoryReadOnly ? undefined : vm.setProjectName}
      onRedo={isHistoryReadOnly ? undefined : vm.redo}
      onResetZoom={vm.resetZoom}
      onShare={onShare}
      onOpenPresenterView={onOpenPresenterView}
      onStartPresenterMode={onStartPresenterMode}
      onSaveLocal={() => {
        void vm.saveLocalNow();
      }}
      onSaveLocalAs={
        hasDirectoryPersistence
          ? () => {
              void vm.saveLocalAs();
            }
          : undefined
      }
      onTranslationSourceLanguageChange={vm.setActiveSlideLanguage}
      onTranslationTargetLanguageChange={(languageCode) => {
        void vm.setTranslationTargetLanguageForSource(languageCode, {
          sourceLanguage: vm.activeSlideLanguage.code,
        });
      }}
      onTranslateDeck={
        isHistoryReadOnly
          ? undefined
          : () => {
              void vm.translateDeck();
            }
      }
      onUndo={isHistoryReadOnly ? undefined : vm.undo}
      onZoomIn={vm.zoomIn}
      onZoomOut={vm.zoomOut}
    />
  );
}
