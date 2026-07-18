/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { type ProjectDocument } from '../../../apps/editor/src/domain/documents/model';

export type CommandContractTextStyleResult = {
  bottomY: number | undefined;
  elementCount: number;
  rightX: number | undefined;
  shapeStroke: string | undefined;
  text: string | undefined;
  textColorRanges:
    | Array<{
        end: number;
        fill: string;
        start: number;
      }>
    | undefined;
  textFontSize: number | undefined;
  textVerticalAlign: string | undefined;
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
      verticalAlign: 'middle',
    }),
  );
  run(
    new basicCommands.UpdateElementStyleCommand('text-1', {
      fill: '#ff0000',
      textColorRange: { start: 0, end: 4 },
    }),
  );
  run(
    new basicCommands.UpdateElementStyleCommand('text-1', {
      fill: '#00ff00',
      textColorRange: { start: 2, end: 7 },
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
  run(new basicCommands.AlignElementCommand('page-1', 'shape-1', 'horizontal-right'));
  run(new basicCommands.AlignElementCommand('page-1', 'image-1', 'vertical-bottom'));
  run(new basicCommands.TranslateTextElementsCommand({ 'text-1': { fontSize: 46, text: 'Traduzido' } }));

  if (project.elements['text-1']?.text !== 'Traduzido') throw new Error('text should be translated');
  if (project.elements['shape-1']?.stroke !== '#ff00aa') {
    throw new Error('shape style should be updated');
  }

  return {
    bottomY: project.elements['image-1']?.y,
    elementCount: Object.keys(project.elements).length,
    rightX: project.elements['shape-1']?.x,
    shapeStroke: project.elements['shape-1']?.stroke,
    text: project.elements['text-1']?.text,
    textColorRanges:
      project.elements['text-1']?.type === 'text'
        ? project.elements['text-1'].colorRanges
        : undefined,
    textFontSize: project.elements['text-1']?.fontSize,
    textVerticalAlign:
      project.elements['text-1']?.type === 'text'
        ? project.elements['text-1'].verticalAlign
        : undefined,
  };
}
