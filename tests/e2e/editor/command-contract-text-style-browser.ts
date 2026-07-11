/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandContractTextStyleResult = {
  elementCount: number;
  shapeStroke: string | undefined;
  text: string | undefined;
  textFontSize: number | undefined;
};

export async function evaluateCommandContractTextStyle(
  initialProject: ProjectDocument,
): Promise<CommandContractTextStyleResult> {
  const { basicCommands } = (await import(
    '/editor/src/domain/commands/elements/basicCommands.ts'
  )) as typeof import('../../../apps/editor/src/domain/commands/elements/basicCommands');

  let project = initialProject;
  const run = (command: { execute(project: typeof project): typeof project }) => {
    project = command.execute(project);
  };

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

  if (project.elements['text-1']?.text !== 'Traduzido') throw new Error('text should be translated');
  if (project.elements['shape-1']?.stroke !== '#ff00aa') {
    throw new Error('shape style should be updated');
  }

  return {
    elementCount: Object.keys(project.elements).length,
    shapeStroke: project.elements['shape-1']?.stroke,
    text: project.elements['text-1']?.text,
    textFontSize: project.elements['text-1']?.fontSize,
  };
}
