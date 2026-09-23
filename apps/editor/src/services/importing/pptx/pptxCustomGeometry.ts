import type { ShapePath, VectorPathCommand } from '../../../domain/documents/model';
import { pptxXml } from './pptxXml';

function coordinate(point: Element | undefined, name: 'x' | 'y', size: number) {
  const value = Number(point?.getAttribute(name));
  if (!Number.isFinite(value) || size === 0) return 0;
  return value / size;
}

function parsePath(path: Element): VectorPathCommand[] {
  const width = Number(path.getAttribute('w')) || 1;
  const height = Number(path.getAttribute('h')) || 1;
  const commands: VectorPathCommand[] = [];
  for (const command of pptxXml.childElements(path)) {
    if (command.localName === 'close') {
      commands.push({ type: 'close' });
      continue;
    }
    const points = pptxXml.childElements(command, 'pt');
    if (command.localName === 'moveTo' || command.localName === 'lnTo') {
      commands.push({
        type: command.localName === 'moveTo' ? 'move' : 'line',
        x: coordinate(points[0], 'x', width),
        y: coordinate(points[0], 'y', height),
      });
    }
    if (command.localName === 'cubicBezTo' && points.length >= 3) {
      commands.push({
        type: 'cubic',
        cx1: coordinate(points[0], 'x', width),
        cy1: coordinate(points[0], 'y', height),
        cx2: coordinate(points[1], 'x', width),
        cy2: coordinate(points[1], 'y', height),
        x: coordinate(points[2], 'x', width),
        y: coordinate(points[2], 'y', height),
      });
    }
  }
  return commands;
}

function isUnitRectangle(commands: VectorPathCommand[]) {
  const points = commands.filter((command) => command.type !== 'close');
  if (points.length < 3 || points.some((command) => command.type === 'cubic')) return false;
  const xs = points.map((command) => command.x ?? 0);
  const ys = points.map((command) => command.y ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return minX >= -0.02 && minY >= -0.02 && maxX <= 1.02 && maxY <= 1.02 && maxX - minX > 0.9 && maxY - minY > 0.9;
}

function parse(shape: Element) {
  const geometry = pptxXml.firstDescendant(shape, 'custGeom');
  const pathList = geometry ? pptxXml.firstDescendant(geometry, 'pathLst') : undefined;
  if (!pathList) return undefined;
  const commands = pptxXml.childElements(pathList, 'path').flatMap(parsePath);
  if (commands.length === 0 || isUnitRectangle(commands)) return undefined;
  return commands;
}

function toShapePath(shape: Element): ShapePath | undefined {
  const commands = parse(shape);
  if (!commands || commands.some((command) => command.type === 'close')) return undefined;
  const points: number[] = [];
  for (const command of commands) {
    if (command.type === 'move') {
      points.push(command.x ?? 0, command.y ?? 0);
      continue;
    }
    if (command.type === 'line') {
      const endX = command.x ?? 0;
      const endY = command.y ?? 0;
      const startX = points.at(-2) ?? endX;
      const startY = points.at(-1) ?? endY;
      points.push(
        startX + (endX - startX) / 3,
        startY + (endY - startY) / 3,
        startX + ((endX - startX) * 2) / 3,
        startY + ((endY - startY) * 2) / 3,
        endX,
        endY,
      );
      continue;
    }
    if (command.type === 'cubic') {
      if (points.length === 0) points.push(0, 0);
      points.push(command.cx1 ?? 0, command.cy1 ?? 0, command.cx2 ?? 0, command.cy2 ?? 0, command.x ?? 0, command.y ?? 0);
    }
  }
  if (points.length < 8) return undefined;
  return { kind: 'bezier', points };
}

export const pptxCustomGeometry = {
  parse,
  toShapePath,
};
