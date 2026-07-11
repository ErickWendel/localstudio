import { type Page } from '@playwright/test';

import { reorderAnimationBuilds } from './drag-reorder-animation-build-journey';
import { reorderCanvasLayers } from './drag-reorder-layer-journey';
import { createLayerReorderProject } from './drag-reorder-project-setup';
import { reorderSlides } from './drag-reorder-slide-journey';

export const dragReorderJourneyPage = {
  async reorderLayersSlidesAndAnimationBuilds(page: Page, baseURL: string) {
    const editor = await createLayerReorderProject(page, baseURL);
    await reorderCanvasLayers(editor, page);
    await reorderSlides(editor, page);
    await reorderAnimationBuilds(editor, page);
  },
};
