import { modelSetupService } from '../../../services/model-setup/modelSetupService';
import { LeftToolPanel } from '../panels/LeftToolPanel';
import type { useEditorViewModel } from '../state/useEditorViewModel';

type EditorViewModel = ReturnType<typeof useEditorViewModel>;

interface EditorLeftPanelSurfaceProps {
  designFontFocusKey: number;
  isHistoryReadOnly: boolean;
  leftPanelOpen: boolean;
  vm: EditorViewModel;
  onImportMedia: (file: File) => void;
  onOpenChange: (open: boolean) => void;
  onSelectElement: (elementId: string, options?: { additive?: boolean }) => void;
}

export function EditorLeftPanelSurface({
  designFontFocusKey,
  isHistoryReadOnly,
  leftPanelOpen,
  vm,
  onImportMedia,
  onOpenChange,
  onSelectElement,
}: EditorLeftPanelSurfaceProps) {
  return (
    <LeftToolPanel
      activeTab={vm.activeTab}
      animationPreview={vm.animationPreview}
      activeSlideLanguage={vm.activeSlideLanguage}
      focusFontControlKey={designFontFocusKey}
      onTabChange={vm.setActiveTab}
      open={leftPanelOpen}
      onOpenChange={onOpenChange}
      project={vm.project}
      activePageId={vm.activePageId}
      selection={vm.selection}
      availableFonts={vm.availableFonts}
      localFonts={vm.localFontOptions}
      onDownloadFont={isHistoryReadOnly ? undefined : vm.downloadFontForSelection}
      onImportLocalFont={isHistoryReadOnly ? undefined : vm.importLocalFontForSelection}
      onSelectElement={isHistoryReadOnly ? undefined : onSelectElement}
      onSetElementVisibility={isHistoryReadOnly ? undefined : vm.setElementVisibility}
      onSetElementLock={isHistoryReadOnly ? undefined : vm.setElementLock}
      onDeleteElement={isHistoryReadOnly ? undefined : vm.deleteElement}
      onReorderElement={isHistoryReadOnly ? undefined : vm.reorderElement}
      onAlignSelectedElement={isHistoryReadOnly ? undefined : vm.alignSelectedElement}
      onEditSelectionGrid={isHistoryReadOnly ? undefined : () => vm.setActiveTab('layout')}
      onSetSelectedElementZOrder={isHistoryReadOnly ? undefined : vm.setSelectedElementZOrder}
      onUpdateElementFrame={isHistoryReadOnly ? undefined : vm.updateElementFrame}
      onUpdateElementStyle={isHistoryReadOnly ? undefined : vm.updateElementStyle}
      onUpdateTextContent={isHistoryReadOnly ? undefined : vm.updateTextContent}
      onUpdateMediaPlayback={isHistoryReadOnly ? undefined : vm.updateMediaPlayback}
      onUpdatePageBackground={isHistoryReadOnly ? undefined : vm.updatePageBackground}
      onApplyTheme={isHistoryReadOnly ? undefined : vm.applyTheme}
      onEditTheme={isHistoryReadOnly ? undefined : vm.editTheme}
      onChangeTheme={isHistoryReadOnly ? undefined : vm.changeTheme}
      onApplySlideLayout={isHistoryReadOnly ? undefined : vm.applySlideLayout}
      onEditSlideLayout={isHistoryReadOnly ? undefined : vm.editSlideLayout}
      onToggleSlideLayoutPlaceholder={
        isHistoryReadOnly ? undefined : vm.toggleSlideLayoutPlaceholder
      }
      onReplaceVideoAsset={
        isHistoryReadOnly
          ? undefined
          : (elementId, file) => {
              void vm.replaceVideoAsset(elementId, file);
            }
      }
      onClearPageTransition={isHistoryReadOnly ? undefined : vm.clearPageTransition}
      onSetPageTransition={isHistoryReadOnly ? undefined : vm.setPageTransition}
      onSetElementAnimationBuilds={isHistoryReadOnly ? undefined : vm.setElementAnimationBuilds}
      onClearElementAnimationBuild={isHistoryReadOnly ? undefined : vm.clearElementAnimationBuild}
      onReorderElementAnimationBuild={
        isHistoryReadOnly ? undefined : vm.reorderElementAnimationBuild
      }
      onPlayAnimationPreview={vm.playAnimationPreview}
      onImportImage={
        isHistoryReadOnly
          ? undefined
          : (file) => {
              void vm.importImageFile(file);
            }
      }
      stockGifResults={vm.stockGifResults}
      stockImageResults={vm.stockImageResults}
      stockMediaError={vm.stockMediaError}
      stockMediaProviderState={vm.stockMediaProviderState}
      stockMediaRecentItems={vm.stockMediaRecentItems}
      stockMediaSearchingGifs={vm.stockMediaSearching.gifs}
      stockMediaSearchingImages={vm.stockMediaSearching.images}
      onConfigureStockMedia={vm.openMediaSettings}
      onRemoveAsset={isHistoryReadOnly ? undefined : vm.removeAsset}
      onImportMedia={isHistoryReadOnly ? undefined : onImportMedia}
      onInsertStockMedia={isHistoryReadOnly ? undefined : vm.insertStockMedia}
      onInsertText={isHistoryReadOnly ? undefined : vm.insertTextElement}
      onInsertShape={isHistoryReadOnly ? undefined : vm.insertShapeElement}
      onInsertImageGrid={isHistoryReadOnly ? undefined : vm.insertImageGridPlaceholders}
      onApplyGridToSelection={isHistoryReadOnly ? undefined : vm.applyGridToSelectedElements}
      onSearchStockGifs={(query) => {
        void vm.searchStockGifs(query);
      }}
      onSearchStockImages={(query) => {
        void vm.searchStockImages(query);
      }}
      modelStates={vm.modelStates}
      attentionModelId={
        vm.aiToolsAttentionModelId ??
        (vm.backgroundSelectionNotice ? modelSetupService.IMAGE_EDITING_MODEL_ID : undefined)
      }
      createImageOptions={vm.createImageOptions}
      translationLanguageOptions={vm.translationLanguageOptions}
      promptProviderStates={vm.promptProviderStates}
      translationProviderStates={vm.translationProviderStates}
      languageDetectionProviderStates={vm.languageDetectionProviderStates}
      languageDetectionPreparation={vm.languageDetectionPreparation}
      translationPreparation={vm.translationPreparation}
      translationTargetAttention={vm.translationTargetAttention}
      translationTargetLanguage={vm.translationTargetLanguage}
      promptApiAttention={vm.promptApiAttention}
      promptApiNotice={vm.promptApiNotice}
      promptPreparation={vm.promptPreparation}
      onDownloadModel={vm.downloadModel}
      onRemoveModel={vm.removeModel}
      onCreateImageOptionsChange={vm.setCreateImageOptions}
      onPreparePromptApi={vm.preparePromptApi}
      onPrepareLanguageDetectionProvider={vm.prepareSelectedLanguageDetectionProvider}
      onPrepareTranslationProvider={vm.prepareSelectedTranslationProvider}
      onPromptProviderChange={(providerId) => {
        void vm.setPromptProvider(providerId);
      }}
      onLanguageDetectionProviderChange={(providerId) => {
        void vm.setLanguageDetectionProvider(providerId);
      }}
      onTranslationTargetLanguageChange={(languageCode) => {
        void vm.setTranslationTargetLanguage(languageCode);
      }}
      onTranslationProviderChange={(providerId) => {
        void vm.setTranslationProvider(providerId);
      }}
    />
  );
}
