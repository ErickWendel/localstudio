/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { type Page } from '@playwright/test';

type CommandPageLayoutContractResult = {
  layoutId: string | undefined;
  pageCount: number;
  themeId: string | undefined;
};

export const commandPageLayoutContractPage = {
  async run(page: Page, baseURL: string): Promise<CommandPageLayoutContractResult> {
    await page.goto(new URL('/editor/?newProject=1', baseURL).toString());

    return page.evaluate(async () => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

      let project = {
        assets: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        elements: {
          'text-1': {
            align: 'left',
            fill: '#111111',
            fontFamily: 'Inter',
            fontSize: 40,
            fontWeight: 400,
            height: 120,
            id: 'text-1',
            lineHeight: 1.1,
            locked: false,
            opacity: 1,
            rotation: 0,
            text: 'Original',
            type: 'text',
            visible: true,
            width: 500,
            x: 10,
            y: 20,
          },
        },
        fonts: {},
        id: 'project-1',
        name: 'Command Contract',
        pages: [
          {
            background: { color: '#ffffff', type: 'color' },
            elementIds: ['text-1'],
            height: 1080,
            id: 'page-1',
            name: 'Slide 1',
            visible: true,
            width: 1920,
          },
        ],
        themeGallery: [],
        themes: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const run = (command: { execute(project: typeof project): typeof project }) => {
        project = command.execute(project);
      };

      run(new basicCommands.DuplicatePageCommand('page-1', 'page-2', (id: string) => id + '-copy'));
      run(new basicCommands.RenamePageCommand('page-2', 'Appendix'));
      run(new basicCommands.SetPageVisibilityCommand('page-2', false));
      run(new basicCommands.ReorderPageCommand('page-2', 0));
      run(new basicCommands.DeletePageCommand('page-2'));

      const theme = {
        id: 'theme-contrast',
        name: 'Contrast',
        palette: ['#000000', '#ffffff'],
        typography: { bodyFontFamily: 'Inter', headingFontFamily: 'Inter' },
      };
      run(new basicCommands.SaveThemeCommand(theme));
      run(new basicCommands.ApplyThemeCommand('theme-contrast'));
      run(new basicCommands.EditThemeCommand({ ...theme, name: 'Contrast edited' }));

      const layout = {
        elementIds: ['title-placeholder'],
        elements: {
          'title-placeholder': {
            align: 'left',
            fill: '#111111',
            fontFamily: 'Inter',
            fontSize: 64,
            fontWeight: 700,
            height: 120,
            id: 'title-placeholder',
            lineHeight: 1.1,
            locked: true,
            opacity: 1,
            placeholderRole: 'title',
            rotation: 0,
            templateSource: 'layout',
            text: 'Title',
            type: 'text',
            verticalAlign: 'top',
            visible: true,
            width: 900,
            x: 80,
            y: 80,
          },
        },
        id: 'layout-title',
        name: 'Title layout',
        placeholderVisibility: { body: true, media: true, title: true },
      };
      run(new basicCommands.SaveSlideLayoutCommand(layout));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', false));
      run(new basicCommands.ToggleSlideLayoutPlaceholderVisibilityCommand('layout-title', 'title', true));
      run(new basicCommands.ApplySlideLayoutCommand('page-1', 'layout-title'));
      run(new basicCommands.EditSlideLayoutCommand({ ...layout, name: 'Edited title layout' }));

      assert(project.pages.length === 1, 'delete page should keep one page');
      assert(project.pages[0]?.layoutId === 'layout-title', 'layout should be applied');
      assert(project.themeId === 'theme-contrast', 'theme should be applied');
      assert(project.themes['theme-contrast']?.name === 'Contrast edited', 'theme should be edited');
      assert(project.slideLayouts?.['layout-title']?.name === 'Edited title layout', 'layout should be edited');

      return {
        layoutId: project.pages[0]?.layoutId,
        pageCount: project.pages.length,
        themeId: project.themeId,
      };
    });
  },
};
