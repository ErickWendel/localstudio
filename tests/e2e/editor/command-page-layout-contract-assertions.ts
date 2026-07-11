import { type Page } from '@playwright/test';

import { type CommandPageLayoutContractProject } from './command-page-layout-contract-project';

type CommandPageLayoutAssertableProject = CommandPageLayoutContractProject & {
  pages: Array<CommandPageLayoutContractProject['pages'][number] & { layoutId?: string }>;
  slideLayouts?: Record<string, { name?: string }>;
  themeId?: string;
  themes: Record<string, { name?: string }>;
};

export type CommandPageLayoutContractResult = {
  layoutId: string | undefined;
  pageCount: number;
  themeId: string | undefined;
};

export const commandPageLayoutContractAssertions = {
  async verify(
    page: Page,
    project: CommandPageLayoutContractProject,
  ): Promise<CommandPageLayoutContractResult> {
    return page.evaluate((project) => {
      const contractedProject = project as CommandPageLayoutAssertableProject;

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

      assert(contractedProject.pages.length === 1, 'delete page should keep one page');
      assert(contractedProject.pages[0]?.layoutId === 'layout-title', 'layout should be applied');
      assert(contractedProject.themeId === 'theme-contrast', 'theme should be applied');
      assert(contractedProject.themes['theme-contrast']?.name === 'Contrast edited', 'theme should be edited');
      assert(
        contractedProject.slideLayouts?.['layout-title']?.name === 'Edited title layout',
        'layout should be edited',
      );

      return {
        layoutId: contractedProject.pages[0]?.layoutId,
        pageCount: contractedProject.pages.length,
        themeId: contractedProject.themeId,
      };
    }, project);
  },
};
