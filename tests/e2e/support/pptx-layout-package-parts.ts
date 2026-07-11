import { pptxLayoutLayoutParts } from './pptx-layout-layout-parts';
import { pptxLayoutMasterParts } from './pptx-layout-master-parts';
import { pptxLayoutMediaParts } from './pptx-layout-media-parts';
import { pptxLayoutPresentationParts } from './pptx-layout-presentation-parts';
import { pptxLayoutSlideParts } from './pptx-layout-slide-parts';

export const pptxLayoutPackageParts = [
  ...pptxLayoutPresentationParts,
  ...pptxLayoutSlideParts,
  ...pptxLayoutLayoutParts,
  ...pptxLayoutMasterParts,
  ...pptxLayoutMediaParts,
] as const;
