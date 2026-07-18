import { basicCommands } from '../../../domain/commands/elements/basicCommands';
import type { ElementFramePatch, ElementStylePatch } from '../../../domain/commands/elements/basicCommands';
import type { DesignElement, ProjectDocument, ProjectFont } from '../../../domain/documents/model';
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

function fitTextElementHeightToContent(project: ProjectDocument, elementId: string) {
  const element = project.elements[elementId];
  if (!element || element.type !== 'text') return project;
  const contentHeight = textTranslationLayout.getMinimumTextFrameHeight(element);
  if (element.height === contentHeight) return project;
  return new basicCommands.UpdateElementFrameCommand(elementId, {
    height: contentHeight,
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
  const nextProject = new basicCommands.UpdateElementStyleCommand(elementId, patch).execute(project);
  if (patch.fontFamily !== undefined) return fitTextElementHeightToContent(nextProject, elementId);
  if (patch.fontSize === undefined) return nextProject;
  return ensureTextElementMinimumHeight(nextProject, elementId);
}

function hasPatchValue(patch: ElementStylePatch) {
  return Object.keys(patch).length > 0;
}

function getSupportedStylePatch(input: {
  element: DesignElement | undefined;
  patch: ElementStylePatch;
  textSelection?: { start: number; end: number } | undefined;
}) {
  if (!input.element || input.element.locked) return undefined;
  const sharedPatch: ElementStylePatch = {
    ...(input.patch.opacity !== undefined ? { opacity: input.patch.opacity } : {}),
  };

  if (input.element.type === 'text') {
    const textSelection =
      input.textSelection && input.textSelection.start < input.textSelection.end
        ? input.textSelection
        : undefined;
    const textPatch: ElementStylePatch = {
      ...sharedPatch,
      ...(input.patch.align !== undefined ? { align: input.patch.align } : {}),
      ...(input.patch.fill !== undefined ? { fill: input.patch.fill } : {}),
      ...(input.patch.fontFamily !== undefined ? { fontFamily: input.patch.fontFamily } : {}),
      ...(input.patch.fontSize !== undefined ? { fontSize: input.patch.fontSize } : {}),
      ...(input.patch.fontWeight !== undefined ? { fontWeight: input.patch.fontWeight } : {}),
      ...(input.patch.hyperlink !== undefined ? { hyperlink: input.patch.hyperlink } : {}),
      ...(input.patch.verticalAlign !== undefined
        ? { verticalAlign: input.patch.verticalAlign }
        : {}),
      ...(textSelection && typeof input.patch.fill === 'string'
        ? { textColorRange: textSelection }
        : {}),
    };
    return hasPatchValue(textPatch) ? textPatch : undefined;
  }

  if (input.element.type === 'shape') {
    const shapePatch: ElementStylePatch = {
      ...sharedPatch,
      ...(input.patch.fill !== undefined ? { fill: input.patch.fill } : {}),
      ...(input.patch.stroke !== undefined ? { stroke: input.patch.stroke } : {}),
      ...(input.patch.strokeWidth !== undefined ? { strokeWidth: input.patch.strokeWidth } : {}),
      ...(input.patch.startEndpoint !== undefined
        ? { startEndpoint: input.patch.startEndpoint }
        : {}),
      ...(input.patch.endEndpoint !== undefined ? { endEndpoint: input.patch.endEndpoint } : {}),
    };
    return hasPatchValue(shapePatch) ? shapePatch : undefined;
  }

  return hasPatchValue(sharedPatch) ? sharedPatch : undefined;
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
  getSupportedStylePatch,
  getFramePatchWithTextMinimum,
  updateElementStyle,
  updateTextContent,
};
