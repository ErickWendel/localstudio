/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { type Page } from '@playwright/test';

import { EditorAppPage } from '../pages/editor-app.page';
import { createCommandContractProject } from './command-contract-project';

export const commandContractRuntimePage = {
  async run(page: Page, baseURL: string) {
    const editor = new EditorAppPage(page, baseURL);
    await editor.gotoNewProject();

    return page.evaluate(async (initialProject) => {
      const { basicCommands } = (await import(
        '/editor/src/domain/commands/elements/basicCommands.ts'
      )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

      function assert(condition: unknown, message: string) {
        if (!condition) throw new Error(message);
      }

      let project = initialProject;
      const run = (command: { execute(project: typeof project): typeof project }) => {
        project = command.execute(project);
      };

      run(new basicCommands.AlignElementCommand('page-1', 'shape-1', 'page-center'));
      run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'front'));
      run(new basicCommands.SetZOrderCommand('page-1', 'shape-1', 'backward'));
      run(new basicCommands.DuplicateElementCommand('page-1', 'text-1', 'text-copy'));
      run(new basicCommands.ReorderElementCommand('page-1', 'text-copy', 0));
      run(new basicCommands.SetElementVisibilityCommand('text-copy', false));
      run(new basicCommands.SetElementLockCommand('text-copy', true));
      run(
        new basicCommands.AddElementsCommand('page-1', [
          {
            fill: '#123456',
            height: 80,
            id: 'shape-2',
            locked: false,
            opacity: 1,
            rotation: 0,
            shape: 'ellipse',
            type: 'shape',
            visible: true,
            width: 80,
            x: 40,
            y: 40,
          },
        ]),
      );
      run(new basicCommands.UpdateElementFrameCommand('shape-2', { height: 96, width: 120, x: 44 }));
      run(new basicCommands.UpdateElementFramesCommand({ 'shape-1': { x: 100 }, 'image-1': { y: 320 } }));
      run(new basicCommands.UpdateTextContentCommand('text-1', 'Updated'));
      run(
        new basicCommands.UpdateElementStyleCommand('text-1', {
          align: 'center',
          fill: '#00779a',
          fontSize: 52,
          fontWeight: 700,
          opacity: 0.75,
        }),
      );
      run(
        new basicCommands.UpdateElementStyleCommand('shape-1', {
          endEndpoint: 'arrow',
          fill: null,
          startEndpoint: 'circle',
          stroke: '#ff00aa',
          strokeWidth: 6,
        }),
      );
      run(new basicCommands.TranslateTextElementsCommand({ 'text-1': { fontSize: 46, text: 'Traduzido' } }));
      run(new basicCommands.DeleteElementCommand('page-1', 'shape-2'));

      assert(project.elements['text-1']?.text === 'Traduzido', 'text should be translated');
      assert(project.elements['text-copy']?.locked === true, 'copy should be locked');
      assert(project.elements['text-copy']?.visible === false, 'copy should be hidden');
      assert(!project.elements['shape-2'], 'added shape should be deleted');
      assert(project.elements['shape-1']?.stroke === '#ff00aa', 'shape style should be updated');

      return {
        elementCount: Object.keys(project.elements).length,
        pageElementIds: project.pages[0]?.elementIds,
        textFontSize: project.elements['text-1']?.fontSize,
      };
    }, createCommandContractProject());
  },
};
