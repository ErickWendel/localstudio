export interface WebMcpShowcaseStep {
  input: Record<string, unknown>;
  inputKind?: 'name' | undefined;
  label: string;
  toolName: string;
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
        input: {},
      },
    ],
  },
  {
    id: 'create-refine',
    title: 'Create and refine',
    description: 'Start, import, translate, compose, and describe presentation content.',
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
      {
        label: 'Generate detailed descriptions',
        toolName: 'generate_deck_detailed_description',
        input: { slideNumbers: [1], language: 'en', force: true },
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
        input: { kind: 'fonts' },
      },
      {
        label: 'Search stock media',
        toolName: 'search_media',
        input: { kind: 'image', term: 'presentations', limit: 6 },
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
        input: { detail: 'elements', slideNumbers: [1] },
      },
      {
        label: 'Get operation status',
        toolName: 'get_operation_status',
        input: { operationId: 'run-an-operation-first', waitForChangeMs: 1000 },
      },
    ],
  },
];

export const webMcpShowcaseCatalog = {
  sections,
  steps: sections.flatMap((section) => section.steps),
};
