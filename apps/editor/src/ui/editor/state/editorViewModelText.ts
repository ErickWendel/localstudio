import { basicCommands } from '../../../domain/commands/elements/basicCommands';
import type { ElementFramePatch, ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import type { ProjectDocument, ProjectFont } from '../../../domain/documents/model';
import { textTranslationLayout } from './text-translation-layout';

function getFramePatchWithTextMinimum(
  project: ProjectDocument,
  elementId: string,
  patch: ElementFramePatch,
) {
  if (patch.height === undefined) return patch;
  const element = project.elements[elementId];
  if (!element || element.type !== 'text') return patch;
  const nextElement = { ...element, ...patch };
  return {
    ...patch,
    height: Math.max(
      patch.height,
      textTranslationLayout.getMinimumTextFrameHeight(nextElement),
    ),
  };
}

function ensureTextElementMinimumHeight(project: ProjectDocument, elementId: string) {
  const element = project.elements[elementId];
  if (!element || element.type !== 'text') return project;
  const minimumHeight = textTranslationLayout.getMinimumTextFrameHeight(element);
  if (element.height >= minimumHeight) return project;
  return new basicCommands.UpdateElementFrameCommand(elementId, {
    height: minimumHeight,
  }).execute(project);
}

function updateTextContent(project: ProjectDocument, elementId: string, text: string) {
  return ensureTextElementMinimumHeight(
    new basicCommands.UpdateTextContentCommand(elementId, text).execute(project),
    elementId,
  );
}

function updateElementStyle(
  project: ProjectDocument,
  elementId: string,
  patch: ElementStylePatch,
) {
  return ensureTextElementMinimumHeight(
    new basicCommands.UpdateElementStyleCommand(elementId, patch).execute(project),
    elementId,
  );
}

function applyFontFamilyWithFonts(input: {
  elementId: string;
  font: ProjectFont;
  fonts: ProjectDocument['fonts'];
  project: ProjectDocument;
}) {
  return updateElementStyle(
    {
      ...input.project,
      fonts: {
        ...(input.project.fonts ?? {}),
        ...(input.fonts ?? {}),
      },
    },
    input.elementId,
    { fontFamily: input.font.family },
  );
}

export const editorViewModelText = {
  applyFontFamilyWithFonts,
  ensureTextElementMinimumHeight,
  getFramePatchWithTextMinimum,
  updateElementStyle,
  updateTextContent,
};
