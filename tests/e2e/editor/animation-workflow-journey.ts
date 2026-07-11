import { type Page } from '@playwright/test';

import { animationClickBuildPreview } from './animation-click-build-preview';
import { animationMixedSequence } from './animation-mixed-sequence';
import { animationObjectLifecycle } from './animation-object-lifecycle';

export const animationWorkflowJourney = {
  async runClickTriggeredBuildPreview(page: Page, baseURL: string): Promise<void> {
    await animationClickBuildPreview.run(page, baseURL);
  },

  async runMixedTextAndShapeSequence(page: Page, baseURL: string): Promise<void> {
    await animationMixedSequence.run(page, baseURL);
  },

  async runObjectAnimationEditLifecycle(page: Page, baseURL: string): Promise<void> {
    await animationObjectLifecycle.run(page, baseURL);
  },
};
