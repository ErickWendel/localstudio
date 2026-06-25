export interface GeneratedSlideTasksDocument {
  language: string;
  page: {
    name: string;
    width: 1920;
    height: 1080;
    background: { type: 'color'; color: string };
  };
  tasks: GeneratedSlideTask[];
}

export type GeneratedSlideTask =
  | { type: 'set-background'; color: string }
  | { type: 'add-placeholder-image'; id: string; description: string; placementHint: string }
  | { type: 'add-remote-image'; id: string; url: string; description: string; placementHint: string }
  | { type: 'add-title'; id: string; text: string; placementHint: string }
  | { type: 'add-subtitle'; id: string; text: string; placementHint: string }
  | { type: 'add-body-text'; id: string; text: string; placementHint: string }
  | { type: 'add-bullets'; id: string; items: string[]; placementHint: string }
  | { type: 'add-shape'; id: string; shape: 'rect' | 'ellipse'; placementHint: string }
  | { type: 'add-cta'; id: string; text: string; placementHint: string };

export type GeneratedSlideElement = GeneratedTextElement | GeneratedImageElement | GeneratedShapeElement;

export interface GeneratedBaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface GeneratedTextElement extends GeneratedBaseElement {
  type: 'text';
  text: string;
  fontFamily: 'Orbitron' | 'Open Sans';
  fontSize: number;
  fontWeight: 400 | 600 | 700 | 800 | 900;
  fill: string;
  align: 'left' | 'center' | 'right';
}

export interface GeneratedImageElement extends GeneratedBaseElement {
  type: 'image';
  assetRole: 'placeholder' | 'remote';
  src?: string;
}

export interface GeneratedShapeElement extends GeneratedBaseElement {
  type: 'shape';
  shape: 'rect' | 'ellipse';
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

const PAGE_WIDTH = 1920;
const PAGE_HEIGHT = 1080;
const MAX_TASKS = 16;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const FONT_WEIGHTS = [400, 600, 700, 800, 900] as const;

const pageSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'width', 'height', 'background'],
  properties: {
    name: { type: 'string' },
    width: { type: 'number', enum: [PAGE_WIDTH] },
    height: { type: 'number', enum: [PAGE_HEIGHT] },
    background: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'color'],
      properties: {
        type: { type: 'string', enum: ['color'] },
        color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      },
    },
  },
} as const;

export const GENERATED_SLIDE_TASKS_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['language', 'page', 'tasks'],
  properties: {
    language: { type: 'string' },
    page: pageSchema,
    tasks: {
      type: 'array',
      maxItems: MAX_TASKS,
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'color'],
            properties: {
              type: { type: 'string', enum: ['set-background'] },
              color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'description', 'placementHint'],
            properties: {
              type: { type: 'string', enum: ['add-placeholder-image'] },
              id: { type: 'string' },
              description: { type: 'string' },
              placementHint: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'url', 'description', 'placementHint'],
            properties: {
              type: { type: 'string', enum: ['add-remote-image'] },
              id: { type: 'string' },
              url: { type: 'string' },
              description: { type: 'string' },
              placementHint: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'text', 'placementHint'],
            properties: {
              type: { type: 'string', enum: ['add-title', 'add-subtitle', 'add-body-text', 'add-cta'] },
              id: { type: 'string' },
              text: { type: 'string' },
              placementHint: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'items', 'placementHint'],
            properties: {
              type: { type: 'string', enum: ['add-bullets'] },
              id: { type: 'string' },
              items: { type: 'array', maxItems: 8, items: { type: 'string' } },
              placementHint: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'shape', 'placementHint'],
            properties: {
              type: { type: 'string', enum: ['add-shape'] },
              id: { type: 'string' },
              shape: { type: 'string', enum: ['rect', 'ellipse'] },
              placementHint: { type: 'string' },
            },
          },
        ],
      },
    },
  },
} as const;

export const GENERATED_SLIDE_ELEMENT_RESPONSE_SCHEMA = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: [
        'type',
        'id',
        'text',
        'x',
        'y',
        'width',
        'height',
        'rotation',
        'opacity',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'fill',
        'align',
      ],
      properties: {
        type: { type: 'string', enum: ['text'] },
        id: { type: 'string' },
        text: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        rotation: { type: 'number' },
        opacity: { type: 'number' },
        fontFamily: { type: 'string', enum: ['Orbitron', 'Open Sans'] },
        fontSize: { type: 'number' },
        fontWeight: { type: 'number', enum: [400, 600, 700, 800, 900] },
        fill: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        align: { type: 'string', enum: ['left', 'center', 'right'] },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'id', 'assetRole', 'x', 'y', 'width', 'height', 'rotation', 'opacity'],
      properties: {
        type: { type: 'string', enum: ['image'] },
        id: { type: 'string' },
        assetRole: { type: 'string', enum: ['placeholder', 'remote'] },
        src: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        rotation: { type: 'number' },
        opacity: { type: 'number' },
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'id', 'shape', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'fill'],
      properties: {
        type: { type: 'string', enum: ['shape'] },
        id: { type: 'string' },
        shape: { type: 'string', enum: ['rect', 'ellipse'] },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        rotation: { type: 'number' },
        opacity: { type: 'number' },
        fill: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        stroke: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
        strokeWidth: { type: 'number' },
      },
    },
  ],
} as const;

function extractJson(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('```')) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeColor(value: unknown, fallback = '#37FD76') {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : fallback;
}

function normalizePage(value: unknown): GeneratedSlideTasksDocument['page'] {
  const record = asRecord(value, 'page');
  const background = asRecord(record.background, 'page.background');
  return {
    name: asString(record.name, 'Generated Slide'),
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    background: {
      type: 'color',
      color: normalizeColor(background.color, '#050D10'),
    },
  };
}

function normalizeId(value: unknown, fallback: string) {
  return asString(value, fallback).replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
}

function normalizeTask(value: unknown, index: number): GeneratedSlideTask {
  const record = asRecord(value, 'task');
  const type = record.type;

  if (type === 'set-background') {
    return { type, color: normalizeColor(record.color, '#050D10') };
  }

  if (type === 'add-placeholder-image') {
    return {
      type,
      id: normalizeId(record.id, `placeholder-${index}`),
      description: asString(record.description, 'Placeholder image'),
      placementHint: asString(record.placementHint, 'best fit'),
    };
  }

  if (type === 'add-remote-image') {
    const url = asString(record.url, '');
    if (!url.startsWith('https://')) throw new Error('Remote image tasks must use an https URL');
    return {
      type,
      id: normalizeId(record.id, `remote-${index}`),
      url,
      description: asString(record.description, 'Remote image'),
      placementHint: asString(record.placementHint, 'best fit'),
    };
  }

  if (type === 'add-title' || type === 'add-subtitle' || type === 'add-body-text' || type === 'add-cta') {
    return {
      type,
      id: normalizeId(record.id, `${type}-${index}`),
      text: asString(record.text, 'Text'),
      placementHint: asString(record.placementHint, 'best fit'),
    };
  }

  if (type === 'add-bullets') {
    const items = Array.isArray(record.items) ? record.items.map((item) => asString(item, '')).filter(Boolean) : [];
    return {
      type,
      id: normalizeId(record.id, `bullets-${index}`),
      items: items.slice(0, 8),
      placementHint: asString(record.placementHint, 'best fit'),
    };
  }

  if (type === 'add-shape') {
    return {
      type,
      id: normalizeId(record.id, `shape-${index}`),
      shape: record.shape === 'ellipse' ? 'ellipse' : 'rect',
      placementHint: asString(record.placementHint, 'best fit'),
    };
  }

  throw new Error(`Unsupported generated slide task type: ${String(type)}`);
}

function normalizeBase(record: Record<string, unknown>) {
  const x = clamp(asNumber(record.x, 0), 0, PAGE_WIDTH - 1);
  const y = clamp(asNumber(record.y, 0), 0, PAGE_HEIGHT - 1);
  return {
    id: normalizeId(record.id, 'element'),
    x,
    y,
    width: clamp(asNumber(record.width, 320), 1, PAGE_WIDTH - x),
    height: clamp(asNumber(record.height, 160), 1, PAGE_HEIGHT - y),
    rotation: clamp(asNumber(record.rotation, 0), -360, 360),
    opacity: clamp(asNumber(record.opacity, 1), 0, 1),
  };
}

function normalizeElement(value: unknown): GeneratedSlideElement {
  const record = asRecord(value, 'element');
  const type = record.type;
  const base = normalizeBase(record);

  if (type === 'text') {
    const requestedWeight = asNumber(record.fontWeight, 600);
    const fontWeight = FONT_WEIGHTS.includes(requestedWeight as (typeof FONT_WEIGHTS)[number])
      ? (requestedWeight as GeneratedTextElement['fontWeight'])
      : 600;
    const fontSize = clamp(asNumber(record.fontSize, 48), 28, 140);
    return {
      ...base,
      type,
      text: asString(record.text, 'Text'),
      fontFamily: record.fontFamily === 'Open Sans' ? 'Open Sans' : 'Orbitron',
      fontSize,
      fontWeight,
      fill: normalizeColor(record.fill),
      align: record.align === 'left' || record.align === 'right' ? record.align : 'center',
      width: Math.max(base.width, 220),
      height: Math.max(base.height, Math.ceil(fontSize * 1.25)),
    };
  }

  if (type === 'image') {
    if (record.assetRole !== 'placeholder' && record.assetRole !== 'remote') {
      throw new Error('Generated image elements must use assetRole "placeholder" or "remote"');
    }
    const src = record.src;
    if (record.assetRole === 'remote' && (typeof src !== 'string' || !src.startsWith('https://'))) {
      throw new Error('Remote generated image elements must include an https src');
    }
    return {
      ...base,
      type,
      assetRole: record.assetRole,
      ...(record.assetRole === 'remote' && typeof src === 'string' ? { src } : {}),
    };
  }

  if (type === 'shape') {
    return {
      ...base,
      type,
      shape: record.shape === 'ellipse' ? 'ellipse' : 'rect',
      fill: normalizeColor(record.fill),
      ...(record.stroke ? { stroke: normalizeColor(record.stroke, '#37FD76') } : {}),
      ...(record.strokeWidth !== undefined ? { strokeWidth: clamp(asNumber(record.strokeWidth, 1), 0, 24) } : {}),
    };
  }

  throw new Error(`Unsupported generated element type: ${String(type)}`);
}

export function parseGeneratedSlideTasksJson(value: string): GeneratedSlideTasksDocument {
  const parsed = JSON.parse(extractJson(value)) as unknown;
  const record = asRecord(parsed, 'generated slide tasks');
  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  return {
    language: asString(record.language, 'en'),
    page: normalizePage(record.page),
    tasks: rawTasks.slice(0, MAX_TASKS).map(normalizeTask),
  };
}

export function parseGeneratedSlideElementJson(value: string): GeneratedSlideElement {
  return normalizeElement(JSON.parse(extractJson(value)) as unknown);
}
