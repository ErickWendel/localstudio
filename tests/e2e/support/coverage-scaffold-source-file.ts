const scaffoldSourceFiles = new Set([
  'apps/editor/src/app/composition.ts',
  'apps/editor/src/app/routing/publicBasePath.ts',
  'apps/editor/src/domain/projects/sampleProject.ts',
  'apps/editor/src/services/fonts/googleFontsCatalog.ts',
  'apps/editor/src/services/model-setup/aiModelCatalog.ts',
  'apps/editor/src/ui/editor/animation/animationEffectCatalog.ts',
  'apps/editor/src/ui/editor/media/imagePromptOptions.ts',
  'apps/editor/src/ui/editor/media/localMediaImportConfig.ts',
  'apps/editor/src/ui/editor/text/textStyleOptions.ts',
  'packages/presenter-remote/src/peer-options.ts',
]);

export function isCoverageScaffoldSourceFile(normalized: string) {
  return scaffoldSourceFiles.has(normalized);
}
