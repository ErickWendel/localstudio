import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type {
  AnimationDirection,
  AnimationEffect,
  CropRect,
  ElementAnimationBuild,
  Page,
} from '../../domain/documents/model';
import type { PresentationExportWarning } from '../contracts/interfaces';

type PptxZipFiles = Record<string, Uint8Array>;

interface PptxPackagePatchElement {
  crop?: CropRect | undefined;
  id: string;
}

export interface PptxPackagePatchPage {
  elements: PptxPackagePatchElement[];
  pageId: string;
}

interface Relationship {
  id: string;
  target: string;
  type: string;
}

const contentTypeDefaults = [
  { contentType: 'image/gif', extension: 'gif' },
  { contentType: 'video/mp4', extension: 'mp4' },
  { contentType: 'video/quicktime', extension: 'mov' },
  { contentType: 'video/webm', extension: 'webm' },
];

function getSlidePath(slideIndex: number) {
  return `ppt/slides/slide${slideIndex + 1}.xml`;
}

function getSlideRelsPath(slideIndex: number) {
  return `ppt/slides/_rels/slide${slideIndex + 1}.xml.rels`;
}

function xmlEscape(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function normalizeZipPath(path: string) {
  const segments: string[] = [];
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

function resolveRelationshipTarget(sourcePath: string, target: string) {
  if (target.startsWith('/')) return normalizeZipPath(target);
  return normalizeZipPath(`${sourcePath.split('/').slice(0, -1).join('/')}/${target}`);
}

function stripSlideGeneratedTiming(xml: string) {
  return xml
    .replace(/<p:transition[\s\S]*?<\/p:transition>/g, '')
    .replace(/<p:transition\b[^/]*\/>/g, '')
    .replace(/<p:timing[\s\S]*?<\/p:timing>/g, '');
}

function mapDirection(direction: AnimationDirection | undefined) {
  if (direction === 'left') return 'l';
  if (direction === 'right') return 'r';
  if (direction === 'up') return 'u';
  if (direction === 'down') return 'd';
  return undefined;
}

function mapTransitionEffect(effect: AnimationEffect | undefined, warnings: PresentationExportWarning[], page: Page) {
  const direction = mapDirection(page.transition?.direction);
  const directionAttribute = direction ? ` dir="${direction}"` : '';
  if (effect === 'fade' || effect === 'dissolve') return '<p:fade/>';
  if (effect === 'push') return `<p:push${directionAttribute}/>`;
  if (effect === 'wipe') return `<p:wipe${directionAttribute}/>`;
  if (effect) {
    warnings.push({
      category: 'transition',
      code: 'pptx-transition-effect-downgraded',
      message: `${effect} transition was not exported to PowerPoint.`,
      pageId: page.id,
    });
  }
  return undefined;
}

function buildTransitionXml(page: Page, warnings: PresentationExportWarning[]) {
  if (!page.transition) return '';
  const transitionEffectXml = mapTransitionEffect(page.transition.effect, warnings, page);
  if (!transitionEffectXml) return '';
  const attributes = [
    page.transition.durationMs !== undefined ? `dur="${Math.max(0, page.transition.durationMs)}"` : undefined,
    page.transition.delayMs > 0 ? `advClick="0"` : `advClick="1"`,
    page.transition.delayMs > 0 ? `advTm="${Math.max(0, page.transition.delayMs)}"` : undefined,
  ].filter(Boolean);
  return `<p:transition${attributes.length ? ` ${attributes.join(' ')}` : ''}>${transitionEffectXml}</p:transition>`;
}

function getPresetClass(build: ElementAnimationBuild) {
  if (build.mediaAction === 'play') return 'mediacall';
  if (build.kind === 'build-out') return 'exit';
  if (build.kind === 'emphasis') return 'emph';
  return 'entr';
}

function getNodeType(build: ElementAnimationBuild) {
  if (build.trigger === 'on-click') return 'clickEffect';
  if (build.trigger === 'after-previous') return 'withEffect';
  return 'afterEffect';
}

function getPresetSubtype(build: ElementAnimationBuild) {
  if (build.effect === 'fade' || build.effect === 'dissolve') return 'fade';
  if (build.effect === 'push') return 'push';
  if (build.effect === 'wipe') return 'wipe';
  return 'appear';
}

function getAnimationCommand(build: ElementAnimationBuild, shapeId: string, timingId: number) {
  if (build.mediaAction === 'play') {
    return `<p:par><p:cTn id="${timingId}" nodeType="${getNodeType(build)}" presetClass="mediacall"><p:childTnLst><p:cmd type="call" cmd="play"><p:cBhvr><p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par>`;
  }
  const duration = Math.max(0, build.durationMs ?? build.delayMs);
  const delay = Math.max(0, build.delayMs);
  const direction = mapDirection(build.direction);
  const directionAttribute = direction ? ` dir="${direction}"` : '';
  return `<p:par><p:cTn id="${timingId}" nodeType="${getNodeType(build)}" presetClass="${getPresetClass(build)}" presetSubtype="${getPresetSubtype(build)}" dur="${duration}" delay="${delay}"${directionAttribute}><p:childTnLst><p:animEffect transition="${build.kind === 'build-out' ? 'out' : 'in'}" filter="${getPresetSubtype(build)}"><p:cBhvr><p:tgtEl><p:spTgt spid="${shapeId}"/></p:tgtEl></p:cBhvr></p:animEffect></p:childTnLst></p:cTn></p:par>`;
}

function isExportableAnimationEffect(effect: AnimationEffect) {
  return (
    effect === 'reveal' ||
    effect === 'fade' ||
    effect === 'dissolve' ||
    effect === 'push' ||
    effect === 'wipe'
  );
}

function buildTimingXml(
  page: Page,
  elementNameToShapeId: Map<string, string>,
  warnings: PresentationExportWarning[],
) {
  const builds = (page.animationBuilds ?? []).filter((build) =>
    page.elementIds.includes(build.elementId),
  );
  if (builds.length === 0) return '';
  const commands: string[] = [];
  const buildList: string[] = [];
  builds.forEach((build, index) => {
    const shapeId = elementNameToShapeId.get(build.elementId);
    if (!shapeId) {
      warnings.push({
        category: 'animation',
        code: 'pptx-animation-target-missing',
        elementId: build.elementId,
        message: 'Animation target was not present in the generated PowerPoint slide.',
        pageId: page.id,
      });
      return;
    }
    let patchedBuild = build;
    if (!isExportableAnimationEffect(build.effect)) {
      const downgradedEffect: AnimationEffect = build.effect === 'keyboard-typing' ? 'fade' : 'reveal';
      patchedBuild = { ...build, effect: downgradedEffect };
      warnings.push({
        category: 'animation',
        code: 'pptx-animation-effect-downgraded',
        elementId: build.elementId,
        message: `${build.effect} animation was downgraded to ${downgradedEffect} for PowerPoint export.`,
        pageId: page.id,
      });
    }
    commands.push(getAnimationCommand(patchedBuild, shapeId, index + 2));
    buildList.push(`<p:bldP spid="${shapeId}"/>`);
  });
  if (commands.length === 0) return '';
  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>${commands.join('')}</p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${buildList.join('')}</p:bldLst></p:timing>`;
}

function getElementNameToShapeId(xml: string) {
  const map = new Map<string, string>();
  const pattern = /<p:cNvPr\s+([^>]*?)\/?>/g;
  for (const match of xml.matchAll(pattern)) {
    const attributes = match[1] ?? '';
    const id = attributes.match(/\bid="([^"]+)"/)?.[1];
    const name = attributes.match(/\bname="([^"]+)"/)?.[1];
    if (id && name) map.set(name.replace(/&quot;/g, '"').replace(/&amp;/g, '&'), id);
  }
  return map;
}

function cropToSrcRect(crop: CropRect) {
  const left = Math.round(Math.max(0, crop.x) * 100000);
  const top = Math.round(Math.max(0, crop.y) * 100000);
  const right = Math.round(Math.max(0, 1 - crop.x - crop.width) * 100000);
  const bottom = Math.round(Math.max(0, 1 - crop.y - crop.height) * 100000);
  return `<a:srcRect l="${left}" t="${top}" r="${right}" b="${bottom}"/>`;
}

function patchPictureCrop(xml: string, element: PptxPackagePatchElement) {
  if (!element.crop) return xml;
  const escapedId = xmlEscape(element.id);
  const picturePattern = new RegExp(
    `(<p:pic[\\s\\S]*?<p:cNvPr\\s+[^>]*\\bname="${escapedId}"[\\s\\S]*?<p:blipFill>)([\\s\\S]*?)(</p:blipFill>[\\s\\S]*?</p:pic>)`,
  );
  return xml.replace(picturePattern, (_match, start: string, body: string, end: string) => {
    const nextBody = body.includes('<a:srcRect')
      ? body.replace(/<a:srcRect\b[^/]*\/>/, cropToSrcRect(element.crop!))
      : `${body}${cropToSrcRect(element.crop!)}`;
    return `${start}${nextBody}${end}`;
  });
}

function patchSlideXml(
  xml: string,
  page: Page,
  patchPage: PptxPackagePatchPage | undefined,
  warnings: PresentationExportWarning[],
) {
  let patchedXml = stripSlideGeneratedTiming(xml);
  const transitionXml = buildTransitionXml(page, warnings);
  const elementNameToShapeId = getElementNameToShapeId(patchedXml);
  for (const element of patchPage?.elements ?? []) {
    patchedXml = patchPictureCrop(patchedXml, element);
  }
  const timingXml = buildTimingXml(page, elementNameToShapeId, warnings);
  return {
    shapeIds: new Set(elementNameToShapeId.values()),
    xml: patchedXml.replace('</p:sld>', `${transitionXml}${timingXml}</p:sld>`),
  };
}

function parseAttributes(xml: string) {
  const attributes = new Map<string, string>();
  for (const match of xml.matchAll(/\s([A-Za-z_:][\w:.-]*)="([^"]*)"/g)) {
    attributes.set(match[1]!, match[2]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  return attributes;
}

function parseRelationships(xml: string | undefined) {
  if (!xml) return [];
  const relationships: Relationship[] = [];
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attributes = parseAttributes(match[1] ?? '');
    const id = attributes.get('Id');
    const type = attributes.get('Type');
    const target = attributes.get('Target');
    if (id && type && target) relationships.push({ id, target, type });
  }
  return relationships;
}

function ensureContentTypeDefaults(files: PptxZipFiles) {
  const contentTypesPath = '[Content_Types].xml';
  const file = files[contentTypesPath];
  if (!file) return;
  let xml = strFromU8(file);
  const additions = contentTypeDefaults.filter(
    (item) => !new RegExp(`<Default\\s+[^>]*Extension="${item.extension}"`).test(xml),
  );
  if (additions.length === 0) return;
  const defaultsXml = additions
    .map(
      (item) =>
        `<Default Extension="${item.extension}" ContentType="${xmlEscape(item.contentType)}"/>`,
    )
    .join('');
  xml = xml.replace('</Types>', `${defaultsXml}</Types>`);
  files[contentTypesPath] = strToU8(xml);
}

function getDeclaredContentTypeExtensions(files: PptxZipFiles) {
  const file = files['[Content_Types].xml'];
  if (!file) return new Set<string>();
  const xml = strFromU8(file);
  const extensions = new Set<string>();
  for (const match of xml.matchAll(/<Default\s+[^>]*Extension="([^"]+)"/g)) {
    extensions.add(match[1]!.toLowerCase());
  }
  return extensions;
}

function getPathExtension(path: string) {
  return path.toLowerCase().split('.').pop() ?? '';
}

function warn(warnings: PresentationExportWarning[], warning: PresentationExportWarning) {
  warnings.push(warning);
}

function validatePackage(
  files: PptxZipFiles,
  pages: Page[],
  slideShapeIds: Map<string, Set<string>>,
  warnings: PresentationExportWarning[],
) {
  for (const requiredPath of ['[Content_Types].xml', 'ppt/presentation.xml']) {
    if (!files[requiredPath]) {
      warn(warnings, {
        category: 'relationship',
        code: 'pptx-required-package-file-missing',
        message: `PowerPoint package is missing ${requiredPath}.`,
      });
    }
  }
  const contentTypeExtensions = getDeclaredContentTypeExtensions(files);
  pages.forEach((page, index) => {
    const slidePath = getSlidePath(index);
    const slideFile = files[slidePath];
    if (!slideFile) {
      warn(warnings, {
        category: 'relationship',
        code: 'pptx-slide-file-missing',
        message: `PowerPoint package is missing ${slidePath}.`,
        pageId: page.id,
      });
      return;
    }
    const relsPath = getSlideRelsPath(index);
    const relsFile = files[relsPath];
    const relationships = parseRelationships(relsFile ? strFromU8(relsFile) : undefined);
    for (const relationship of relationships) {
      const targetPath = resolveRelationshipTarget(slidePath, relationship.target);
      if (!relationship.target.startsWith('http') && !files[targetPath]) {
        warn(warnings, {
          category: 'relationship',
          code: 'pptx-relationship-target-missing',
          message: `PowerPoint relationship ${relationship.id} points to missing ${targetPath}.`,
          pageId: page.id,
        });
      }
      if (targetPath.startsWith('ppt/media/')) {
        const extension = getPathExtension(targetPath);
        if (extension && !contentTypeExtensions.has(extension)) {
          warn(warnings, {
            category: 'content-type',
            code: 'pptx-media-content-type-missing',
            message: `PowerPoint media ${targetPath} is missing a content type declaration.`,
            pageId: page.id,
          });
        }
      }
    }
    const shapeIds = slideShapeIds.get(page.id) ?? new Set<string>();
    for (const build of page.animationBuilds ?? []) {
      if (!page.elementIds.includes(build.elementId)) continue;
      if (shapeIds.size === 0) {
        warn(warnings, {
          category: 'animation',
          code: 'pptx-animation-shape-targets-unvalidated',
          elementId: build.elementId,
          message: 'Animation timing targets could not be validated for this slide.',
          pageId: page.id,
        });
      }
    }
  });
}

function toExactArrayBuffer(bytes: Uint8Array) {
  const output = new Uint8Array(bytes.byteLength);
  output.set(bytes);
  return output.buffer;
}

function patchPackageBuffer(
  buffer: ArrayBuffer,
  pages: Page[],
  initialWarnings: PresentationExportWarning[],
  patchPages: PptxPackagePatchPage[] = [],
) {
  const warnings = [...initialWarnings];
  const files = unzipSync(new Uint8Array(buffer)) as PptxZipFiles;
  ensureContentTypeDefaults(files);
  const patchPageById = new Map(patchPages.map((page) => [page.pageId, page]));
  const slideShapeIds = new Map<string, Set<string>>();
  pages.forEach((page, index) => {
    const path = getSlidePath(index);
    const file = files[path];
    if (!file) return;
    const result = patchSlideXml(strFromU8(file), page, patchPageById.get(page.id), warnings);
    slideShapeIds.set(page.id, result.shapeIds);
    files[path] = strToU8(result.xml);
  });
  validatePackage(files, pages, slideShapeIds, warnings);
  return {
    buffer: toExactArrayBuffer(zipSync(files)),
    warnings,
  };
}

export const pptxPackagePatcher = {
  patchPackageBuffer,
};
