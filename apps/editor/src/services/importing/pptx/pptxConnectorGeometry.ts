import type { ShapePath } from '../../../domain/documents/model';
import type { PptxTransform } from './pptx-parser-model';
import { pptxXml } from './pptxXml';

function getAdjustment(shape: Element, name: string) {
  const geometry = pptxXml.firstDescendant(shape, 'prstGeom');
  const adjustmentList = geometry ? pptxXml.childElements(geometry, 'avLst')[0] : undefined;
  const adjustment = adjustmentList
    ? pptxXml
        .childElements(adjustmentList, 'gd')
        .find((candidate) => candidate.getAttribute('name') === name)
    : undefined;
  const match = adjustment?.getAttribute('fmla')?.match(/^val\s+(-?\d+(?:\.\d+)?)$/);
  const value = Number(match?.[1]);
  return Number.isFinite(value) ? value / 100000 : 0.5;
}

function transformPoints(points: number[], frame: PptxTransform) {
  return points.map((coordinate, index) => {
    if (index % 2 === 0) return frame.flipX ? 1 - coordinate : coordinate;
    return frame.flipY ? 1 - coordinate : coordinate;
  });
}

function getBentConnectorPoints(shape: Element, segmentCount: number) {
  const x1 = getAdjustment(shape, 'adj1');
  const y2 = getAdjustment(shape, 'adj2');
  const x3 = getAdjustment(shape, 'adj3');
  if (segmentCount === 2) return [0, 0, 1, 0, 1, 1];
  if (segmentCount === 3) return [0, 0, x1, 0, x1, 1, 1, 1];
  if (segmentCount === 4) return [0, 0, x1, 0, x1, y2, 1, y2, 1, 1];
  return [0, 0, x1, 0, x1, y2, x3, y2, x3, 1, 1, 1];
}

function getCurvedConnectorPoints(shape: Element, segmentCount: number) {
  const x2 = getAdjustment(shape, 'adj1');
  const y4 = getAdjustment(shape, 'adj2');
  const x6 = getAdjustment(shape, 'adj3');
  if (segmentCount === 2) return [0, 0, 0.5, 0, 1, 0.5, 1, 1];
  if (segmentCount === 3) {
    return [0, 0, x2 / 2, 0, x2, 0.25, x2, 0.5, x2, 0.75, (1 + x2) / 2, 1, 1, 1];
  }
  if (segmentCount === 4) {
    const x3 = (1 + x2) / 2;
    return [
      0, 0, x2 / 2, 0, x2, y4 / 4, x2, y4 / 2,
      x2, (y4 * 3) / 4, (x2 + x3) / 2, y4, x3, y4,
      (x3 + 1) / 2, y4, 1, (1 + y4) / 2, 1, 1,
    ];
  }
  const x3 = x2;
  const x1 = (x3 + x6) / 2;
  const y1 = y4 / 2;
  const y5 = (1 + y4) / 2;
  return [
    0, 0, x3 / 2, 0, x3, y1 / 2, x3, y1,
    x3, (y1 + y4) / 2, (x3 + x1) / 2, y4, x1, y4,
    (x6 + x1) / 2, y4, x6, (y5 + y4) / 2, x6, y5,
    x6, (y5 + 1) / 2, (x6 + 1) / 2, 1, 1, 1,
  ];
}

function getPath(shape: Element, preset: string | null | undefined, frame: PptxTransform) {
  if (preset === 'straightConnector1') {
    return { kind: 'polyline', points: transformPoints([0, 0, 1, 1], frame) } satisfies ShapePath;
  }
  const bentMatch = preset?.match(/^bentConnector([2-5])$/);
  if (bentMatch) {
    const points = getBentConnectorPoints(shape, Number(bentMatch[1]));
    return { kind: 'polyline', points: transformPoints(points, frame) } satisfies ShapePath;
  }
  const curvedMatch = preset?.match(/^curvedConnector([2-5])$/);
  if (curvedMatch) {
    const points = getCurvedConnectorPoints(shape, Number(curvedMatch[1]));
    return { kind: 'bezier', points: transformPoints(points, frame) } satisfies ShapePath;
  }
  return undefined;
}

export const pptxConnectorGeometry = { getPath };
