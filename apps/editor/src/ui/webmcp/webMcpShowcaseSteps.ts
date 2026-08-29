export interface WebMcpShowcaseStep {
  execution?: 'exclusive' | 'parallel';
  input: Record<string, unknown>;
  inputKind?: 'name' | undefined;
  label: string;
  options?: WebMcpShowcaseStepOption[];
  toolName: string;
}

export interface WebMcpShowcaseStepOption {
  id: string;
  input: Record<string, unknown>;
  label: string;
}

export interface WebMcpShowcaseSection {
  description: string;
  id: string;
  steps: WebMcpShowcaseStep[];
  title: string;
}

const sections: WebMcpShowcaseSection[] = [
  {
    id: 'dependencies',
    title: 'Dependencies',
    description: 'Prepare and inspect the browser models used by local AI features.',
    steps: [
      {
        label: 'Prepare AI models',
        toolName: 'prepare_ai_models',
        input: {},
      },
      {
        label: 'Inspect AI model status',
        toolName: 'get_ai_model_status',
        execution: 'parallel',
        input: {},
      },
    ],
  },
  {
    id: 'create-refine',
    title: 'Create and refine',
    description: 'Start, import, translate, and compose presentation content.',
    steps: [
      {
        label: 'Create presentation',
        toolName: 'create_presentation',
        inputKind: 'name',
        input: { name: 'WebMCP Demo Deck' },
      },
      {
        label: 'Import PowerPoint from URL',
        toolName: 'import_powerpoint_from_url',
        input: {
          url: 'https://localstudio.erickwendel.com.br/localstudio/public/web-ai-beyond-chat-renderatl-14082026%20%282%29.pptx',
        },
      },
      {
        label: 'Translate deck and notes',
        toolName: 'translate_deck_and_notes',
        input: { sourceLanguage: 'en', targetLanguage: 'pt-BR' },
      },
      {
        label: 'Upsert slide content',
        toolName: 'upsert_slide_content',
        input: {
          requestId: 'webmcp-showcase-slide-1',
          slideNumber: 1,
          mode: 'replace',
          slide: {
            name: 'Agent-native presentations',
            background: { type: 'color', color: '#050D10' },
          },
          elements: [
            {
              elementId: 'showcase-title',
              type: 'text',
              frame: { x: 180, y: 260, width: 1560, height: 220 },
              zIndex: 1,
              content: { text: 'Presentations become agent-native' },
              style: {
                fontFamily: 'Orbitron',
                fontSize: 88,
                fontWeight: 800,
                color: '#37FD76',
                align: 'center',
              },
            },
            {
              elementId: 'showcase-body',
              type: 'text',
              frame: { x: 360, y: 560, width: 1200, height: 120 },
              zIndex: 2,
              content: {
                text: 'Create, inspect, localize, and export through browser-native tools.',
              },
              style: {
                fontFamily: 'Open Sans',
                fontSize: 42,
                fontWeight: 600,
                color: '#FFFFFF',
                align: 'center',
              },
            },
          ],
        },
      },
      {
        label: 'Generate image',
        toolName: 'generate_image',
        input: {
          prompt: 'A cinematic abstract illustration for a presentation about browser agents',
          width: 1024,
          height: 1024,
          steps: 4,
        },
      },
    ],
  },
  {
    id: 'assets-styling',
    title: 'Assets and styling',
    description: 'Discover fonts, animation options, and stock media references.',
    steps: [
      {
        label: 'List authoring catalog',
        toolName: 'list_authoring_catalog',
        execution: 'parallel',
        input: { kind: 'fonts' },
        options: [
          { id: 'fonts', label: 'Fonts', input: { kind: 'fonts' } },
          {
            id: 'text-animations',
            label: 'Text animations',
            input: { kind: 'animations', elementType: 'text' },
          },
          {
            id: 'image-animations',
            label: 'Image animations',
            input: { kind: 'animations', elementType: 'image' },
          },
          {
            id: 'gif-animations',
            label: 'GIF animations',
            input: { kind: 'animations', elementType: 'gif' },
          },
          {
            id: 'video-animations',
            label: 'Video animations',
            input: { kind: 'animations', elementType: 'video' },
          },
          {
            id: 'shape-animations',
            label: 'Shape animations',
            input: { kind: 'animations', elementType: 'shape' },
          },
        ],
      },
      {
        label: 'Search stock media',
        toolName: 'search_media',
        execution: 'parallel',
        input: { kind: 'image', term: 'presentations', limit: 6 },
        options: [
          {
            id: 'images',
            label: 'Images',
            input: { kind: 'image', term: 'presentations', limit: 6 },
          },
          {
            id: 'gifs',
            label: 'GIFs',
            input: { kind: 'gif', term: 'presentations', limit: 6 },
          },
        ],
      },
    ],
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Bring the authored slide into view for visual inspection.',
    steps: [
      {
        label: 'Focus slide preview',
        toolName: 'get_slide_preview',
        execution: 'parallel',
        input: { slideNumber: 1 },
      },
    ],
  },
  {
    id: 'export',
    title: 'Export',
    description: 'Package the deck in a portable presentation format.',
    steps: [
      {
        label: 'Export presentation',
        toolName: 'export_presentation',
        input: { format: 'pdf', slideRange: 'all' },
      },
    ],
  },
  {
    id: 'context-progress',
    title: 'Context and progress',
    description: 'Read bounded project context and poll long-running operations.',
    steps: [
      {
        label: 'Inspect presentation state',
        toolName: 'get_presentation_state',
        execution: 'parallel',
        input: { detail: 'elements', slideNumbers: [1] },
      },
      {
        label: 'Get operation status',
        toolName: 'get_operation_status',
        execution: 'parallel',
        input: { operationId: 'run-an-operation-first', waitForChangeMs: 1000 },
      },
    ],
  },
];

export const webMcpShowcaseCatalog = {
  sections,
  steps: sections.flatMap((section) => section.steps),
};
