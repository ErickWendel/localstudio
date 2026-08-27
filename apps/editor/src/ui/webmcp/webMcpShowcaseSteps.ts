export interface WebMcpShowcaseStep {
  input: Record<string, unknown>;
  inputKind?: 'name' | undefined;
  label: string;
  toolName: string;
}

export const webMcpShowcaseSteps: WebMcpShowcaseStep[] = [
  {
    label: 'Create presentation',
    toolName: 'create_presentation',
    inputKind: 'name',
    input: { name: 'WebMCP Demo Deck' },
  },
  {
    label: 'Inspect presentation state',
    toolName: 'get_presentation_state',
    input: { detail: 'elements', slideNumbers: [1] },
  },
  {
    label: 'Import PowerPoint from URL',
    toolName: 'import_powerpoint_from_url',
    input: { url: 'http://localhost:8000/presentation.pptx' },
  },
  {
    label: 'Translate deck and notes',
    toolName: 'translate_deck_and_notes',
    input: { sourceLanguage: 'en', targetLanguage: 'pt-BR' },
  },
  {
    label: 'Generate detailed descriptions',
    toolName: 'generate_deck_detailed_description',
    input: { slideNumbers: [1], language: 'en', force: true },
  },
  {
    label: 'List authoring catalog',
    toolName: 'list_authoring_catalog',
    input: { kind: 'fonts' },
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
            text: 'Create, inspect, localize, export, and publish through browser-native tools.',
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
    label: 'Focus slide preview',
    toolName: 'get_slide_preview',
    input: { slideNumber: 1 },
  },
  {
    label: 'Inspect AI model status',
    toolName: 'get_ai_model_status',
    input: {},
  },
  {
    label: 'Prepare AI models',
    toolName: 'prepare_ai_models',
    input: {},
  },
  {
    label: 'Search stock media',
    toolName: 'search_media',
    input: { kind: 'image', term: 'presentations', limit: 6 },
  },
  {
    label: 'Export presentation',
    toolName: 'export_presentation',
    input: { format: 'pdf', slideRange: 'all' },
  },
  {
    label: 'Publish presentation',
    toolName: 'publish_presentation',
    input: {},
  },
  {
    label: 'Get operation status',
    toolName: 'get_operation_status',
    input: { operationId: 'run-an-operation-first', waitForChangeMs: 1000 },
  },
];
