const frameSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'width', 'height'],
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number', minimum: 1 },
    height: { type: 'number', minimum: 1 },
  },
};

const cropSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['x', 'y', 'width', 'height'],
  properties: {
    x: { type: 'number' },
    y: { type: 'number' },
    width: { type: 'number', minimum: 0 },
    height: { type: 'number', minimum: 0 },
  },
};

const animationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['effect', 'order'],
  properties: {
    effect: {
      type: 'string',
      enum: [
        'blinds',
        'clothesline',
        'color-planes',
        'confetti',
        'cube',
        'doorway',
        'dissolve',
        'drop',
        'droplet',
        'fade',
        'fade-and-move',
        'fade-through-color',
        'fall',
        'flip',
        'flop',
        'grid',
        'iris',
        'keyboard-typing',
        'line-draw',
        'mosaic',
        'move-in',
        'page-flip',
        'pivot',
        'push',
        'radial-wipe',
        'reflection',
        'reveal',
        'revolving-door',
        'scale',
        'swap',
        'switch',
        'swoosh',
        'twirl',
        'twist',
        'wipe',
      ],
    },
    trigger: { type: 'string', enum: ['on-click', 'after-transition', 'after-previous'] },
    kind: { type: 'string', enum: ['build-in', 'build-out', 'emphasis'] },
    delayMs: { type: 'number', minimum: 0 },
    durationMs: { type: 'number', minimum: 0 },
    direction: { type: 'string', enum: ['up', 'right', 'down', 'left'] },
    order: { type: 'integer', minimum: 0 },
  },
};

const commonProperties = {
  elementId: { type: 'string', minLength: 1, maxLength: 500 },
  frame: frameSchema,
  zIndex: { type: 'integer', minimum: 0 },
  rotation: { type: 'number' },
  opacity: { type: 'number', minimum: 0, maximum: 1 },
  visible: { type: 'boolean' },
  locked: { type: 'boolean' },
  animations: { type: 'array', maxItems: 50, items: animationSchema },
};

const mediaContentSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assetId: { type: 'string', minLength: 1, maxLength: 500 },
    url: { type: 'string', minLength: 1, maxLength: 8000 },
    mediaRef: { type: 'string', minLength: 1, maxLength: 500 },
  },
  oneOf: [{ required: ['assetId'] }, { required: ['url'] }, { required: ['mediaRef'] }],
};

function elementSchema(
  type: 'gif' | 'image' | 'shape' | 'text' | 'video',
  properties: Record<string, unknown>,
  required: string[],
) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['elementId', 'type', 'frame', 'zIndex', ...required],
    properties: {
      ...commonProperties,
      type: { const: type },
      ...properties,
    },
  };
}

const backgroundSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'color'],
      properties: { type: { const: 'color' }, color: { type: 'string' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'assetId', 'colorFallback'],
      properties: {
        type: { const: 'asset' },
        assetId: { type: 'string' },
        colorFallback: { type: 'string' },
      },
    },
  ],
};

export const slideUpsertInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['requestId', 'mode', 'elements'],
  oneOf: [
    { required: ['slideId'], not: { required: ['slideNumber'] } },
    { required: ['slideNumber'], not: { required: ['slideId'] } },
  ],
  properties: {
    requestId: { type: 'string', minLength: 1, maxLength: 500 },
    slideId: { type: 'string', minLength: 1, maxLength: 500 },
    slideNumber: { type: 'integer', minimum: 1 },
    mode: { type: 'string', enum: ['merge', 'replace'] },
    slide: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', maxLength: 500 },
        width: { type: 'number', minimum: 1, maximum: 10000 },
        height: { type: 'number', minimum: 1, maximum: 10000 },
        background: backgroundSchema,
        speakerNotes: { type: 'string', maxLength: 100000 },
      },
    },
    elements: {
      type: 'array',
      maxItems: 100,
      items: {
        oneOf: [
          elementSchema(
            'text',
            {
              content: {
                type: 'object',
                additionalProperties: false,
                required: ['text'],
                properties: { text: { type: 'string', maxLength: 100000 } },
              },
              style: {
                type: 'object',
                additionalProperties: false,
                required: ['fontFamily', 'fontSize', 'fontWeight', 'color'],
                properties: {
                  fontFamily: { type: 'string', minLength: 1, maxLength: 500 },
                  fontSize: { type: 'number', minimum: 1 },
                  fontWeight: { type: 'number', minimum: 1 },
                  color: { type: 'string' },
                  align: { type: 'string', enum: ['left', 'center', 'right'] },
                  verticalAlign: { type: 'string', enum: ['bottom', 'middle', 'top'] },
                  lineHeight: { type: 'number', minimum: 0 },
                  highlight: { type: 'string' },
                },
              },
            },
            ['content', 'style'],
          ),
          elementSchema(
            'image',
            {
              content: mediaContentSchema,
              crop: cropSchema,
              flipX: { type: 'boolean' },
              mask: { const: 'ellipse' },
            },
            ['content'],
          ),
          elementSchema(
            'gif',
            {
              content: mediaContentSchema,
              playing: { type: 'boolean' },
            },
            ['content'],
          ),
          elementSchema(
            'video',
            {
              content: mediaContentSchema,
              playback: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  loop: { type: 'boolean' },
                  controls: { type: 'boolean' },
                  muted: { type: 'boolean' },
                  autoplayInPreview: { type: 'boolean' },
                  trimStartSeconds: { type: 'number', minimum: 0 },
                  trimEndSeconds: { type: 'number', minimum: 0 },
                  playAcrossSlides: { type: 'boolean' },
                  startOnClick: { type: 'boolean' },
                  volume: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
            },
            ['content'],
          ),
          elementSchema(
            'shape',
            {
              content: {
                type: 'object',
                additionalProperties: false,
                required: ['shape'],
                properties: {
                  shape: {
                    type: 'string',
                    enum: [
                      'arc',
                      'arrow',
                      'diamond',
                      'ellipse',
                      'line',
                      'parallelogram',
                      'pentagon',
                      'rect',
                      'rounded-rect',
                      'triangle',
                    ],
                  },
                  fill: { type: 'string' },
                  stroke: { type: 'string' },
                  strokeWidth: { type: 'number', minimum: 0 },
                },
              },
            },
            ['content'],
          ),
        ],
      },
    },
    deleteElementIds: {
      type: 'array',
      maxItems: 100,
      uniqueItems: true,
      items: { type: 'string', minLength: 1, maxLength: 500 },
    },
  },
};
