import { type Page } from '@playwright/test';

import { canvasElementDragFlow } from './canvas-element-drag-flow';
import { canvasMarqueeSelectionFlow } from './canvas-marquee-selection-flow';

export const canvasDirectManipulationJourney = {
  async runElementDrag(page: Page, baseURL: string): Promise<void> {
    await canvasElementDragFlow.run(page, baseURL);
  },

  async runMarqueeSelection(page: Page, baseURL: string): Promise<void> {
    await canvasMarqueeSelectionFlow.run(page, baseURL);
  },
};
