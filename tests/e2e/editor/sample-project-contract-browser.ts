export type SampleProjectContractResult = {
  blankBackground: unknown;
  blankElementCount: number;
  blankName: string;
  sampleAssetUrl: string | undefined;
  sampleElementIds: string[] | undefined;
  sampleTitle: string | undefined;
};

type TextElementLike = {
  text?: string;
};

export async function evaluateSampleProjectContract(): Promise<SampleProjectContractResult> {
  const { sampleProject } = (await import(
    '/editor/src/domain/projects/sampleProject.ts'
  )) as typeof import('../../../apps/editor/src/domain/projects/sampleProject');

  const blank = sampleProject.createBlankProject();
  const sample = sampleProject.createSampleProject();
  const titleElement = sample.elements['text-title'] as TextElementLike | undefined;

  return {
    blankBackground: blank.pages[0]?.background,
    blankElementCount: Object.keys(blank.elements).length,
    blankName: blank.name,
    sampleAssetUrl: sample.assets['asset-hero']?.objectUrl,
    sampleElementIds: sample.pages[0]?.elementIds,
    sampleTitle: titleElement?.text,
  };
}
