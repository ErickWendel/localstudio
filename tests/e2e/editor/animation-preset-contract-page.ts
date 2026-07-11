import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import {
  evaluateAnimationPresetContract,
  type AnimationPresetContractResult,
} from './animation-preset-contract-browser';
import { animationPresetContractFixtures } from './animation-preset-contract-fixtures';

export const animationPresetContractPage = {
  async run(page: Page, baseURL: string): Promise<AnimationPresetContractResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(
      evaluateAnimationPresetContract,
      {
        bounds: animationPresetContractFixtures.createBounds(),
        directions: animationPresetContractFixtures.createDirections(),
        effects: animationPresetContractFixtures.createEffects(),
      },
    );
  },
};
