import type { DesignElement } from '../../../apps/editor/src/domain/documents/model';

export const presenterRouteElements = {
  createImage(id: string, assetId: string, x: number, y: number): DesignElement {
    return {
      assetId,
      height: 360,
      id,
      locked: false,
      opacity: 1,
      rotation: 0,
      type: 'image',
      visible: true,
      width: 640,
      x,
      y,
    };
  },

  createShape(id: string, fill: string, x: number, y: number): DesignElement {
    return {
      fill,
      height: 220,
      id,
      locked: false,
      opacity: 0.94,
      rotation: 8,
      shape: 'rounded-rect',
      stroke: '#111827',
      strokeWidth: 3,
      type: 'shape',
      visible: true,
      width: 300,
      x,
      y,
    };
  },

  createText(id: string, text: string, x: number, y: number): DesignElement {
    return {
      align: 'center',
      fill: '#FFFFFF',
      fontFamily: 'Inter',
      fontSize: 84,
      fontWeight: 700,
      height: 160,
      id,
      lineHeight: 1.05,
      locked: false,
      opacity: 1,
      rotation: 0,
      text,
      type: 'text',
      verticalAlign: 'middle',
      visible: true,
      width: 900,
      x,
      y,
    };
  },
};
