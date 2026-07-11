import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import {
  evaluateMovieControlsContract,
  type MovieControlsContractResult,
} from './movie-controls-contract-browser';
import { movieControlsContractProject } from './movie-controls-contract-project';

export const movieControlsContractPage = {
  async run(page: Page, baseURL: string): Promise<MovieControlsContractResult> {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(evaluateMovieControlsContract, movieControlsContractProject.createProject());
  },
};
