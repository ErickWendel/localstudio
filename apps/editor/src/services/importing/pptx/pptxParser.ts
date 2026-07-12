import type { PlaceholderRole, ShapeKind, ShapeLineEndpoint } from '../../../domain/documents/model';
import { pptxAnimationBuilds } from './pptx-animation-builds';
import type {
  ParseContext,
  ParseScope,
  PptxDeck,
  PptxLayout,
  PptxSlideObject,
  PptxTextDefaults,
  PptxTransform,
} from './pptx-parser-model';
import { pptxParserDefaults } from './pptx-parser-model';
import { pptxTextParser } from './pptxTextParser';
import { pptxVisualStyle } from './pptx-visual-style';
import { pptxFileUtils } from './pptxFileUtils';
import type { PptxRelationship } from './pptxPackage';
import { pptxXml } from './pptxXml';

function getPresentationSize(document: Document) {
  const size = pptxXml.firstDescendant(document, 'sldSz');
  const cx = Number(size?.getAttribute('cx'));
  const cy = Number(size?.getAttribute('cy'));
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cx <= 0 || cy <= 0) {
    return { width: pptxParserDefaults.pageWidth, height: pptxParserDefaults.pageHeight, scaleX: 1, scaleY: 1 };
  }
  const width = pptxParserDefaults.pageWidth;
  const height = Math.round((cy / cx) * width);
  return {
    width,
    height,
    scaleX: width / cx,
    scaleY: height / cy,
  };
}

function localShapeId(element: Element, fallback: string) {
  const nonVisual = pptxXml.firstDescendant(element, 'cNvPr');
  return nonVisual?.getAttribute('id') ?? fallback;
}

function parseFrame(element: Element, scaleX: number, scaleY: number, groupTransform?: PptxTransform): PptxTransform | undefined {
  const transform = pptxXml.firstDescendant(element, 'xfrm');
  const offset = transform ? pptxXml.firstDescendant(transform, 'off') : undefined;
  const extent = transform ? pptxXml.firstDescendant(transform, 'ext') : undefined;
  const x = Number(offset?.getAttribute('x'));
  const y = Number(offset?.getAttribute('y'));
  const width = Number(extent?.getAttribute('cx'));
  const height = Number(extent?.getAttribute('cy'));
  if (![x, y, width, height].every(Number.isFinite)) return undefined;
  const localFrame = {
    x: x * scaleX,
    y: y * scaleY,
    width: Math.max(1, width * scaleX),
    height: Math.max(1, height * scaleY),
    rotation: getRotation(transform),
    ...(transform?.getAttribute('flipH') === '1' ? { flipX: true } : {}),
  };
  if (!groupTransform) {
    return {
      ...localFrame,
      x: Math.round(localFrame.x),
      y: Math.round(localFrame.y),
      width: Math.round(localFrame.width),
      height: Math.round(localFrame.height),
    };
  }
  return {
    ...localFrame,
    x: Math.round(groupTransform.x + localFrame.x),
    y: Math.round(groupTransform.y + localFrame.y),
    width: Math.round(localFrame.width),
    height: Math.round(localFrame.height),
    rotation: groupTransform.rotation + localFrame.rotation,
  };
}

function getRotation(transform: Element | undefined) {
  const rotation = Number(transform?.getAttribute('rot'));
  return Number.isFinite(rotation) ? Math.round(rotation / 60000) : 0;
}

function parseTextObject(
  shape: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const placeholderRole = pptxTextParser.getPlaceholderRole(shape);
  const text =
    pptxTextParser.getTextParagraphs(shape) ||
    (idScope === 'slide' ? '' : pptxTextParser.getPlaceholderFallbackText(placeholderRole));
  if (!text) return undefined;
  const frame = parseFrame(shape, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const shapeId = localShapeId(shape, String(zIndex));
  const opacity = pptxVisualStyle.getOpacity(shape);
  return {
    frame,
    id: `${slideId}-${idScope}-text-${shapeId}`,
    kind: 'text',
    ...(opacity !== undefined ? { opacity } : {}),
    ...(placeholderRole ? { placeholderRole } : {}),
    rotation: frame.rotation,
    source: idScope,
    sourceShapeId: shapeId,
    style: pptxTextParser.getTextStyle(shape, scaleY, textDefaults, scope.theme),
    text,
    textBox: pptxTextParser.getTextBox(shape, scaleX, scaleY),
    zIndex,
  };
}

function getRelationshipTarget(
  context: ParseContext,
  relationships: Map<string, PptxRelationship>,
  id: string | null | undefined,
  pageId?: string,
) {
  if (!id) return undefined;
  const relationship = relationships.get(id);
  if (!relationship) return undefined;
  if (relationship.targetMode === 'External') {
    context.package.warnings.push({
      code: 'pptx-external-relationship',
      message: `Skipped external PowerPoint relationship: ${relationship.target}`,
      ...(pageId ? { pageId } : {}),
      severity: 'warning',
    });
    return undefined;
  }
  return relationship.target;
}

function parsePictureObject(
  context: ParseContext,
  picture: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  relationships: Map<string, PptxRelationship>,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const frame = parseFrame(picture, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const videoRelId =
    pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'videoFile'), 'link') ??
    pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'media'), 'embed');
  const imageRelId = pptxXml.getRelationshipAttr(pptxXml.firstDescendant(picture, 'blip'), 'embed');
  const assetPath =
    getRelationshipTarget(context, relationships, videoRelId, slideId) ??
    getRelationshipTarget(context, relationships, imageRelId, slideId);
  if (!assetPath) return undefined;
  const mimeType = context.package.getContentType(assetPath) ?? pptxFileUtils.getMimeType(assetPath);
  const assetType = pptxFileUtils.getAssetType(assetPath, mimeType);
  if (!assetType) {
    context.package.warnings.push({
      code: 'pptx-unsupported-asset',
      message: `Skipped unsupported PowerPoint asset: ${assetPath}`,
      pageId: slideId,
      severity: 'warning',
    });
  }
  if (!assetType) return undefined;
  const shapeId = localShapeId(picture, String(zIndex));
  const opacity = pptxVisualStyle.getOpacity(picture);
  const crop = parsePictureCrop(picture);
  return {
    assetPath,
    ...(crop ? { crop } : {}),
    frame,
    id: `${slideId}-${idScope}-${assetType}-${shapeId}`,
    kind: assetType,
    ...(opacity !== undefined ? { opacity } : {}),
    rotation: frame.rotation,
    source: idScope,
    sourceShapeId: shapeId,
    zIndex,
  };
}

function parseCropCoordinate(value: string | null | undefined) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? Math.max(0, coordinate / 100000) : 0;
}

function parsePictureCrop(picture: Element) {
  const srcRect = pptxXml.firstDescendant(picture, 'srcRect');
  if (!srcRect) return undefined;
  const left = parseCropCoordinate(srcRect.getAttribute('l'));
  const top = parseCropCoordinate(srcRect.getAttribute('t'));
  const right = parseCropCoordinate(srcRect.getAttribute('r'));
  const bottom = parseCropCoordinate(srcRect.getAttribute('b'));
  const width = Math.max(0.01, 1 - left - right);
  const height = Math.max(0.01, 1 - top - bottom);
  return { x: left, y: top, width, height };
}

function getBackgroundColor(document: Document, theme: ParseScope['theme'], fallback = '#000000') {
  const background = pptxXml.firstDescendant(document, 'bgPr');
  return pptxVisualStyle.getHexColor(background, fallback, theme);
}

function findRelationshipByType(relationships: Map<string, PptxRelationship>, typeSuffix: string) {
  return Array.from(relationships.values()).find((relationship) =>
    relationship.type.endsWith(typeSuffix),
  );
}

function shapeKindForPreset(preset: string | null | undefined): ShapeKind | undefined {
  if (!preset) return undefined;
  if (preset === 'rect') return 'rect';
  if (preset === 'roundRect') return 'rounded-rect';
  if (preset === 'ellipse') return 'ellipse';
  if (preset === 'triangle' || preset === 'rtTriangle') return 'triangle';
  if (preset === 'diamond') return 'diamond';
  if (preset === 'parallelogram') return 'parallelogram';
  if (preset === 'pentagon') return 'pentagon';
  if (preset === 'line') return 'line';
  if (preset === 'arc') return 'arc';
  if (preset.toLowerCase().includes('arrow')) return 'arrow';
  return undefined;
}

function getLineEndpoint(value: string | null | undefined): ShapeLineEndpoint | undefined {
  if (!value) return undefined;
  if (value === 'triangle') return 'arrow';
  if (value === 'stealth') return 'open-arrow';
  if (value === 'oval') return 'circle';
  if (value === 'diamond') return 'diamond';
  return undefined;
}

function getStrokeWidth(line: Element | undefined, scaleY: number) {
  const width = Number(line?.getAttribute('w'));
  return Number.isFinite(width) && width > 0 ? Math.max(1, Math.round(width * scaleY)) : undefined;
}

function parseShapeObject(
  shape: Element,
  slideId: string,
  zIndex: number,
  scaleX: number,
  scaleY: number,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject | undefined {
  const preset = pptxXml.firstDescendant(shape, 'prstGeom')?.getAttribute('prst');
  const shapeKind = shapeKindForPreset(preset);
  if (!shapeKind) return undefined;
  const frame = parseFrame(shape, scaleX, scaleY, scope.groupTransform);
  if (!frame) return undefined;
  const shapeProperties = pptxXml.firstDescendant(shape, 'spPr');
  const line = shapeProperties ? pptxXml.firstDescendant(shapeProperties, 'ln') : undefined;
  const shapeId = localShapeId(shape, String(zIndex));
  const placeholderRole = pptxTextParser.getPlaceholderRole(shape);
  const fill = shapeProperties ? pptxVisualStyle.getHexColor(pptxXml.firstDescendant(shapeProperties, 'solidFill'), '', scope.theme) : '';
  const stroke = line ? pptxVisualStyle.getHexColor(pptxXml.firstDescendant(line, 'solidFill'), '', scope.theme) : '';
  const opacity = pptxVisualStyle.getOpacity(shapeProperties);
  const startEndpoint = getLineEndpoint(pptxXml.firstDescendant(line ?? shape, 'headEnd')?.getAttribute('type'));
  const endEndpoint = getLineEndpoint(pptxXml.firstDescendant(line ?? shape, 'tailEnd')?.getAttribute('type'));
  const strokeWidth = getStrokeWidth(line, scaleY);
  return {
    frame,
    id: `${slideId}-${idScope}-shape-${shapeId}`,
    kind: 'shape',
    ...(fill ? { fill } : {}),
    ...(stroke ? { stroke } : {}),
    ...(strokeWidth ? { strokeWidth } : {}),
    ...(startEndpoint ? { startEndpoint } : {}),
    ...(endEndpoint ? { endEndpoint } : {}),
    ...(opacity !== undefined ? { opacity } : {}),
    ...(placeholderRole ? { placeholderRole } : {}),
    rotation: frame.rotation,
    shape: shapeKind,
    source: idScope,
    sourceShapeId: shapeId,
    zIndex,
  };
}

function parseGroupTransform(group: Element, scaleX: number, scaleY: number, parent?: PptxTransform) {
  const frame = parseFrame(group, scaleX, scaleY, parent);
  return frame;
}

function getTableColumnWidths(table: Element) {
  return pptxXml.childElements(pptxXml.firstDescendant(table, 'tblGrid') ?? table, 'gridCol').map((column) => {
    const width = Number(column.getAttribute('w'));
    return Number.isFinite(width) && width > 0 ? width : 0;
  });
}

function parseTableObjects(
  frame: PptxTransform,
  graphicFrame: Element,
  slideId: string,
  zIndexStart: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  scope: ParseScope,
): PptxSlideObject[] {
  const table = pptxXml.firstDescendant(graphicFrame, 'tbl');
  if (!table) return [];
  const columnWidths = getTableColumnWidths(table);
  const rowElements = pptxXml.childElements(table, 'tr');
  const objects: PptxSlideObject[] = [];
  let y = frame.y;
  rowElements.forEach((row, rowIndex) => {
    const rawHeight = Number(row.getAttribute('h'));
    const rowHeight = Number.isFinite(rawHeight) && rawHeight > 0 ? Math.round(rawHeight * scaleY) : frame.height;
    let x = frame.x;
    pptxXml.childElements(row, 'tc').forEach((cell, columnIndex) => {
      const columnWidth = Math.round((columnWidths[columnIndex] ?? 0) * scaleX) || Math.round(frame.width / Math.max(1, columnWidths.length));
      const cellId = `${slideId}-slide-table-${rowIndex + 1}-${columnIndex + 1}`;
      const fill = pptxVisualStyle.getHexColor(pptxXml.firstDescendant(cell, 'solidFill'), '#FFFFFF', scope.theme);
      objects.push({
        fill,
        frame: { x, y, width: columnWidth, height: rowHeight },
        id: `${cellId}-shape`,
        kind: 'shape',
        opacity: 1,
        rotation: frame.rotation,
        shape: 'rect',
        source: 'slide',
        sourceShapeId: cellId,
        stroke: '#FFFFFF',
        strokeWidth: 1,
        zIndex: zIndexStart + objects.length,
      });
      const text = pptxTextParser.getTextParagraphs(cell);
      if (text) {
        objects.push({
          frame: { x, y, width: columnWidth, height: rowHeight },
          id: `${cellId}-text`,
          kind: 'text',
          opacity: 1,
          rotation: frame.rotation,
          source: 'slide',
          sourceShapeId: `${cellId}-text`,
          style: pptxTextParser.getTextStyle(cell, scaleY, textDefaults, scope.theme),
          text,
          textBox: pptxTextParser.getTextBox(cell, scaleX, scaleY),
          zIndex: zIndexStart + objects.length,
        });
      }
      x += columnWidth;
    });
    y += rowHeight;
  });
  return objects;
}

function addUnsupportedGraphicWarnings(
  context: ParseContext,
  graphicFrame: Element,
  slideId: string,
) {
  const graphicData = pptxXml.firstDescendant(graphicFrame, 'graphicData');
  const uri = graphicData?.getAttribute('uri') ?? '';
  if (uri.includes('/chart')) {
    context.package.warnings.push({
      code: 'pptx-unsupported-chart',
      message: 'Skipped unsupported PowerPoint chart.',
      pageId: slideId,
      severity: 'info',
    });
  }
  if (uri.includes('/diagram')) {
    context.package.warnings.push({
      code: 'pptx-unsupported-diagram',
      message: 'Skipped unsupported PowerPoint SmartArt or diagram.',
      pageId: slideId,
      severity: 'info',
    });
  }
}

function parseSlideTreeObjects(
  context: ParseContext,
  tree: Element | undefined,
  slideId: string,
  zIndexStart: number,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  relationships: Map<string, PptxRelationship>,
  scope: ParseScope,
  idScope: 'layout' | 'master' | 'slide' = 'slide',
): PptxSlideObject[] {
  const objects: PptxSlideObject[] = [];
  if (!tree) return objects;
  for (const child of pptxXml.childElements(tree)) {
    const zIndex = zIndexStart + objects.length;
    if (child.localName === 'sp') {
      const textObject = parseTextObject(child, slideId, zIndex, scaleX, scaleY, textDefaults, scope, idScope);
      if (textObject) objects.push(textObject);
      if (!textObject || !pptxTextParser.getTextParagraphs(child)) {
        const shapeObject = parseShapeObject(child, slideId, zIndexStart + objects.length, scaleX, scaleY, scope, idScope);
        if (shapeObject) objects.push(shapeObject);
      }
    }
    if (child.localName === 'pic') {
      const object = parsePictureObject(context, child, slideId, zIndex, scaleX, scaleY, relationships, scope, idScope);
      if (object) objects.push(object);
    }
    if (child.localName === 'grpSp') {
      objects.push(
        ...parseSlideTreeObjects(
          context,
          child,
          slideId,
          zIndexStart + objects.length,
          scaleX,
          scaleY,
          textDefaults,
          relationships,
          {
            ...scope,
            ...(parseGroupTransform(child, scaleX, scaleY, scope.groupTransform)
              ? { groupTransform: parseGroupTransform(child, scaleX, scaleY, scope.groupTransform)! }
              : {}),
          },
          idScope,
        ),
      );
    }
    if (child.localName === 'graphicFrame') {
      const frame = parseFrame(child, scaleX, scaleY, scope.groupTransform);
      if (frame && pptxXml.firstDescendant(child, 'tbl')) {
        objects.push(...parseTableObjects(frame, child, slideId, zIndexStart + objects.length, scaleX, scaleY, textDefaults, scope));
      } else {
        addUnsupportedGraphicWarnings(context, child, slideId);
      }
    }
  }
  return objects;
}

async function loadTheme(context: ParseContext, masterPath: string | undefined) {
  if (!masterPath) return undefined;
  const cached = context.themeCache.get(masterPath);
  if (cached) return cached;
  const themePath = findRelationshipByType(context.package.getRelationships(masterPath), '/theme')?.target;
  if (!themePath) return undefined;
  const xml = await context.package.readText(themePath);
  if (!xml) return undefined;
  const document = pptxXml.parseXml(xml);
  const colors = new Map<string, string>();
  const colorScheme = pptxXml.firstDescendant(document, 'clrScheme');
  if (colorScheme) {
    for (const child of pptxXml.childElements(colorScheme)) {
      const color = pptxVisualStyle.getHexColor(child, '');
      if (color) colors.set(child.localName, color);
    }
  }
  const theme = { colors };
  context.themeCache.set(masterPath, theme);
  return theme;
}

async function parseInheritedObjects(
  context: ParseContext,
  sourcePath: string | undefined,
  slideId: string,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  scope: ParseScope,
  idScope: 'layout' | 'master',
) {
  if (!sourcePath) return [];
  const xml = await context.package.readText(sourcePath);
  if (!xml) return [];
  const document = pptxXml.parseXml(xml);
  const rels = context.package.getRelationships(sourcePath);
  const tree = pptxXml.firstDescendant(document, 'spTree');
  return parseSlideTreeObjects(
    context,
    tree,
    slideId,
    0,
    scaleX,
    scaleY,
    textDefaults,
    rels,
    scope,
    idScope,
  );
}

function getLayoutId(layoutPath: string | undefined) {
  if (!layoutPath) return undefined;
  const fileName = layoutPath.split('/').at(-1)?.replace(/\.xml$/i, '') ?? 'layout';
  const slug = fileName
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return `pptx-layout-${slug || 'layout'}`;
}

function getLayoutName(layoutPath: string | undefined) {
  if (!layoutPath) return undefined;
  return layoutPath.split('/').at(-1)?.replace(/\.xml$/i, '') || undefined;
}

function getLayoutNameFromDocument(document: Document, layoutPath: string) {
  const name = pptxXml.firstDescendant(document, 'cSld')?.getAttribute('name')?.trim();
  return name || getLayoutName(layoutPath) || getLayoutId(layoutPath) || 'Layout';
}

function getPlaceholderRoles(objects: PptxSlideObject[]) {
  return Array.from(
    new Set(
      objects
        .map((object) => object.placeholderRole)
        .filter((role): role is PlaceholderRole => Boolean(role)),
    ),
  );
}

function getRelationshipTargetsInListOrder(
  relationships: Map<string, PptxRelationship>,
  listItems: Element[],
) {
  return listItems
    .map((item) => {
      const relationshipId = pptxXml.getRelationshipAttr(item, 'id');
      const relationship = relationshipId ? relationships.get(relationshipId) : undefined;
      return relationship?.targetMode === 'Internal' ? relationship.target : undefined;
    })
    .filter((target): target is string => Boolean(target));
}

async function getMasterLayoutPaths(context: ParseContext, masterPath: string) {
  const xml = await context.package.readText(masterPath);
  const relationships = context.package.getRelationships(masterPath);
  if (!xml) {
    return Array.from(relationships.values())
      .filter((relationship) => relationship.type.endsWith('/slideLayout') && relationship.targetMode === 'Internal')
      .map((relationship) => relationship.target);
  }
  const document = pptxXml.parseXml(xml);
  const orderedPaths = getRelationshipTargetsInListOrder(
    relationships,
    pptxXml.descendants(document, 'sldLayoutId'),
  );
  if (orderedPaths.length > 0) return orderedPaths;
  return Array.from(relationships.values())
    .filter((relationship) => relationship.type.endsWith('/slideLayout') && relationship.targetMode === 'Internal')
    .map((relationship) => relationship.target);
}

async function parseLayout(
  context: ParseContext,
  layoutPath: string,
  masterPath: string | undefined,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
): Promise<PptxLayout | undefined> {
  const layoutId = getLayoutId(layoutPath);
  if (!layoutId) return undefined;
  const xml = await context.package.readText(layoutPath);
  if (!xml) return undefined;
  const document = pptxXml.parseXml(xml);
  const relationships = context.package.getRelationships(layoutPath);
  const resolvedMasterPath =
    masterPath ?? findRelationshipByType(relationships, '/slideMaster')?.target;
  const theme = await loadTheme(context, resolvedMasterPath);
  const scope = { theme };
  const masterObjects = await parseInheritedObjects(
    context,
    resolvedMasterPath,
    layoutId,
    scaleX,
    scaleY,
    textDefaults,
    scope,
    'master',
  );
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const layoutObjects = parseSlideTreeObjects(
    context,
    tree,
    layoutId,
    masterObjects.length,
    scaleX,
    scaleY,
    textDefaults,
    relationships,
    scope,
    'layout',
  );
  const objects = [...masterObjects, ...layoutObjects].map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  return {
    backgroundColor: getBackgroundColor(document, theme, '#FFFFFF'),
    id: layoutId,
    name: getLayoutNameFromDocument(document, layoutPath),
    objects,
    placeholderRoles: getPlaceholderRoles(objects),
    sourcePath: layoutPath,
  };
}

async function parseSlide(
  context: ParseContext,
  slidePath: string,
  slideIndex: number,
  visible: boolean,
  scaleX: number,
  scaleY: number,
  textDefaults: PptxTextDefaults,
  layoutsByPath: Map<string, PptxLayout>,
) {
  const xml = await context.package.readText(slidePath);
  if (!xml) throw new Error(`PowerPoint slide is missing: ${slidePath}`);
  const document = pptxXml.parseXml(xml);
  const rels = context.package.getRelationships(slidePath);
  const slideId = `pptx-page-${slideIndex + 1}`;
  const layoutPath = findRelationshipByType(rels, '/slideLayout')?.target;
  const layoutId = getLayoutId(layoutPath);
  const notesPath = findRelationshipByType(rels, '/notesSlide')?.target;
  const layoutRels = layoutPath ? context.package.getRelationships(layoutPath) : new Map<string, PptxRelationship>();
  const masterPath = findRelationshipByType(layoutRels, '/slideMaster')?.target;
  const theme = await loadTheme(context, masterPath);
  const scope = { theme };
  const speakerNotes = await pptxTextParser.parseSpeakerNotes(context, notesPath);
  const parsedLayout = layoutPath ? layoutsByPath.get(layoutPath) : undefined;
  const tree = pptxXml.firstDescendant(document, 'spTree');
  const inheritedObjects = (parsedLayout?.objects ?? []).map((object, index) => ({
    ...object,
    zIndex: index,
  }));
  const objects: PptxSlideObject[] = [];
  objects.push(
    ...parseSlideTreeObjects(
      context,
      tree,
      slideId,
      objects.length,
      scaleX,
      scaleY,
      textDefaults,
      rels,
      scope,
    ),
  );
  const videoStartTriggers = pptxAnimationBuilds.getVideoStartTriggers(document, objects);
  for (const object of objects) {
    const startTrigger = videoStartTriggers.get(object.sourceShapeId);
    if (object.kind === 'video' && startTrigger) object.startTrigger = startTrigger;
  }
  const resolvedLayoutId = parsedLayout?.id ?? layoutId;
  return {
    backgroundColor: getBackgroundColor(document, theme),
    id: slideId,
    ...(resolvedLayoutId ? { layoutId: resolvedLayoutId } : {}),
    ...(parsedLayout?.name ? { layoutName: parsedLayout.name } : {}),
    layoutObjects: inheritedObjects,
    name: `Slide ${slideIndex + 1}`,
    animationBuilds: pptxAnimationBuilds.parse(document, slideId, objects),
    objects,
    placeholderRoles: parsedLayout?.placeholderRoles ?? getPlaceholderRoles(inheritedObjects),
    ...(speakerNotes ? { speakerNotes } : {}),
    transitionEffect: pptxAnimationBuilds.getTransitionEffect(document),
    visible,
  };
}

function normalizeName(name: string) {
  return name.replace(/\.pptx$/i, '').trim() || 'Imported PowerPoint';
}

function findPresentationPath(context: ParseContext) {
  const packageRelationship = findRelationshipByType(context.package.getRelationships(''), '/officeDocument');
  if (packageRelationship?.targetMode === 'Internal') return packageRelationship.target;
  const legacyPath = 'ppt/presentation.xml';
  if (context.package.getFile(legacyPath)) {
    context.package.warnings.push({
      code: 'pptx-legacy-presentation-path',
      message: 'PowerPoint package did not declare the presentation part; ppt/presentation.xml was used as a fallback.',
      severity: 'warning',
    });
    return legacyPath;
  }
  return undefined;
}

async function parse(context: ParseContext, name: string): Promise<PptxDeck> {
  const presentationPath = findPresentationPath(context);
  if (!presentationPath) throw new Error('PowerPoint package is missing a presentation relationship.');
  const presentationXml = await context.package.readText(presentationPath);
  if (!presentationXml) throw new Error(`PowerPoint package is missing presentation part: ${presentationPath}`);
  const presentation = pptxXml.parseXml(presentationXml);
  const presentationRelationships = context.package.getRelationships(presentationPath);
  const size = getPresentationSize(presentation);
  const textDefaults = pptxTextParser.getPresentationTextDefaults(presentation);
  const slideEntries = pptxXml
    .descendants(presentation, 'sldId')
    .map((slide) => {
      const target = presentationRelationships.get(pptxXml.getRelationshipAttr(slide, 'id') ?? '')?.target;
      if (!target) return undefined;
      const show = slide.getAttribute('show');
      return { target, visible: show !== '0' && show !== 'false' };
    })
    .filter((entry): entry is { target: string; visible: boolean } => Boolean(entry));
  const slidePaths = slideEntries.map((entry) => entry.target);
  if (slidePaths.length === 0) throw new Error('PowerPoint package does not contain slides.');
  const masterPaths = getRelationshipTargetsInListOrder(
    presentationRelationships,
    pptxXml.descendants(presentation, 'sldMasterId'),
  );
  const layoutPathEntries: Array<{ layoutPath: string; masterPath?: string }> = [];
  for (const masterPath of masterPaths) {
    for (const layoutPath of await getMasterLayoutPaths(context, masterPath)) {
      layoutPathEntries.push({ layoutPath, masterPath });
    }
  }
  for (const slidePath of slidePaths) {
    const slideLayoutPath = findRelationshipByType(
      context.package.getRelationships(slidePath),
      '/slideLayout',
    )?.target;
    if (slideLayoutPath && !layoutPathEntries.some((entry) => entry.layoutPath === slideLayoutPath)) {
      const slideLayoutRels = context.package.getRelationships(slideLayoutPath);
      const masterPath = findRelationshipByType(slideLayoutRels, '/slideMaster')?.target;
      layoutPathEntries.push({ layoutPath: slideLayoutPath, ...(masterPath ? { masterPath } : {}) });
    }
  }
  const layouts = (
    await Promise.all(
      layoutPathEntries.map((entry) =>
        parseLayout(
          context,
          entry.layoutPath,
          entry.masterPath,
          size.scaleX,
          size.scaleY,
          textDefaults,
        ),
      ),
    )
  ).filter((layout): layout is PptxLayout => Boolean(layout));
  const layoutsByPath = new Map(layouts.map((layout) => [layout.sourcePath, layout]));
  return {
    height: size.height,
    layouts,
    name: normalizeName(name),
    slides: await Promise.all(
      slideEntries.map((entry, index) =>
        parseSlide(
          context,
          entry.target,
          index,
          entry.visible,
          size.scaleX,
          size.scaleY,
          textDefaults,
          layoutsByPath,
        ),
      ),
    ),
    warnings: context.package.warnings,
    width: size.width,
  };
}

export const pptxParser = {
  parse,
};
