export const aiAutomationContractProject = {
  createProject() {
    return {
      assets: {},
      createdAt: '2026-01-01T00:00:00.000Z',
      elements: {
        'text-1': {
          align: 'left',
          fill: '#111111',
          fontFamily: 'Inter',
          fontSize: 40,
          fontWeight: 400,
          height: 120,
          id: 'text-1',
          lineHeight: 1.1,
          locked: false,
          opacity: 1,
          rotation: 0,
          text: 'Hello',
          type: 'text',
          visible: true,
          width: 500,
          x: 20,
          y: 20,
        },
      },
      fonts: {},
      id: 'project-automation',
      name: 'Automation Contract',
      pages: [
        {
          background: { color: '#ffffff', type: 'color' },
          elementIds: ['text-1'],
          height: 1080,
          id: 'page-1',
          name: 'Slide 1',
          visible: true,
          width: 1920,
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  },
};
