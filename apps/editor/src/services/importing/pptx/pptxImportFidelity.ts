import type { DesignElement, ProjectDocument } from '../../../domain/documents/model';
import type { PptxPackage } from './pptxPackage';
import { pptxCustomGeometry } from './pptxCustomGeometry';
import { pptxXml } from './pptxXml';

export interface PptxImportFidelityGap {
  code:
    | 'missing-media'
    | 'missing-poster'
    | 'dropped-custom-geometry'
    | 'unviewable-tiff'
    | 'missing-text';
  detail: string;
  pageId?: string;
}

export interface PptxImportFidelityReport {
  gaps: PptxImportFidelityGap[];
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function fileName(path: string) {
  return path.split('/').at(-1) ?? path;
}

function relationshipTarget(packageDocument: PptxPackage, sourcePath: string, id: string | null | undefined) {
  if (!id) return undefined;
  const relationship = packageDocument.getRelationships(sourcePath).get(id);
  return relationship?.targetMode === 'Internal' ? relationship.target : undefined;
}

function slidePaths(packageDocument: PptxPackage) {
  const presentationPath =
    packageDocument.getRelationships('').values().next().value?.target ?? 'ppt/presentation.xml';
  const declared = [...packageDocument.getRelationships('')].find(([, relationship]) =>
    relationship.type.endsWith('/officeDocument'),
  )?.[1].target;
  const path = declared ?? (packageDocument.getFile(presentationPath) ? presentationPath : 'ppt/presentation.xml');
  return packageDocument.readText(path).then((xml) => {
    if (!xml) return [];
    const presentation = pptxXml.parseXml(xml);
    const relationships = packageDocument.getRelationships(path);
    return pptxXml.descendants(presentation, 'sldId').flatMap((slide) => {
      const target = relationships.get(pptxXml.getRelationshipAttr(slide, 'id') ?? '')?.target;
      return target ? [target] : [];
    });
  });
}

function pageText(project: ProjectDocument, pageId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  const layout = page?.layoutId ? project.slideLayouts?.[page.layoutId] : undefined;
  const texts = [
    ...(page?.elementIds ?? []).map((id) => project.elements[id]),
    ...Object.values(layout?.elements ?? {}),
  ].flatMap((element) => (element?.type === 'text' ? [element.text] : []));
  return normalizeText(texts.join('\n'));
}

function elementForShape(project: ProjectDocument, pageId: string, shapeId: string) {
  const page = project.pages.find((item) => item.id === pageId);
  return (page?.elementIds ?? [])
    .map((id) => project.elements[id])
    .find((element): element is DesignElement => element?.importSource?.shapeId === shapeId);
}

function assetFileName(project: ProjectDocument, assetId: string | undefined) {
  if (!assetId) return undefined;
  return project.assets[assetId]?.fileName ?? project.assets[assetId]?.name;
}

async function audit(packageDocument: PptxPackage, project: ProjectDocument): Promise<PptxImportFidelityReport> {
  const gaps: PptxImportFidelityGap[] = [];
  const paths = await slidePaths(packageDocument);
  for (const [index, slidePath] of paths.entries()) {
    const pageId = `pptx-page-${index + 1}`;
    const xml = await packageDocument.readText(slidePath);
    if (!xml) continue;
    const slide = pptxXml.parseXml(xml);
    const importedText = pageText(project, pageId);
    for (const snippet of pptxXml.descendants(slide, 't').map((node) => node.textContent ?? '')) {
      const normalized = normalizeText(snippet);
      if (normalized.length <= 1 || importedText.includes(normalized)) continue;
      gaps.push({ code: 'missing-text', detail: snippet, pageId });
    }
    const referenced = new Set<string>();
    for (const element of pptxXml.descendants(slide, 'blip').concat(pptxXml.descendants(slide, 'videoFile'))) {
      const target = relationshipTarget(
        packageDocument,
        slidePath,
        pptxXml.getRelationshipAttr(element, 'embed') ?? pptxXml.getRelationshipAttr(element, 'link'),
      );
      if (target) referenced.add(target);
    }
    for (const target of referenced) {
      const name = fileName(target);
      const asset = Object.values(project.assets).find((item) => item.fileName === name || item.name === name);
      if (!packageDocument.getFile(target) || !asset) {
        gaps.push({ code: 'missing-media', detail: target, pageId });
        continue;
      }
      if (/\.tiff?$/i.test(name) && asset.mimeType !== 'image/png') {
        gaps.push({ code: 'unviewable-tiff', detail: target, pageId });
      }
    }
    for (const picture of pptxXml.descendants(slide, 'pic')) {
      const videoTarget = relationshipTarget(
        packageDocument,
        slidePath,
        pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'videoFile'), 'link'),
      );
      const posterTarget = relationshipTarget(
        packageDocument,
        slidePath,
        pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'blip'), 'embed'),
      );
      if (!videoTarget || !posterTarget || videoTarget === posterTarget) continue;
      const shapeId = pptxXml.firstDescendant(picture, 'cNvPr')?.getAttribute('id') ?? '';
      const element = elementForShape(project, pageId, shapeId);
      const posterName = fileName(posterTarget);
      if (
        element?.type === 'video' &&
        assetFileName(project, element.posterAssetId) === posterName &&
        assetFileName(project, element.assetId) === fileName(videoTarget)
      ) {
        continue;
      }
      gaps.push({ code: 'missing-poster', detail: `${videoTarget} poster ${posterTarget}`, pageId });
    }
    for (const shape of pptxXml
      .descendants(slide, 'sp')
      .concat(pptxXml.descendants(slide, 'pic'), pptxXml.descendants(slide, 'cxnSp'))) {
      if (!pptxCustomGeometry.parse(shape)) continue;
      const shapeId = pptxXml.firstDescendant(shape, 'cNvPr')?.getAttribute('id') ?? '';
      const element = elementForShape(project, pageId, shapeId);
      const hasImage = Boolean(pptxXml.firstDescendant(shape, 'blip'));
      const kept = hasImage
        ? element?.type === 'image' && Boolean(element.clipPath)
        : element?.type === 'shape' && Boolean(element.path);
      if (!kept) {
        gaps.push({
          code: 'dropped-custom-geometry',
          detail: `${hasImage ? 'clip' : 'line'} ${shapeId}`,
          pageId,
        });
      }
    }
  }
  return { gaps };
}

export const pptxImportFidelity = {
  audit,
};
