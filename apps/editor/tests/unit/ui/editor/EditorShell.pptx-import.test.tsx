import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { createAppServices as createRealAppServices } from '../../../../src/app/composition';
import type { ProjectDocument } from '../../../../src/domain/documents/model';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import type {
  FontImportRequest,
  FontImportResult,
  FontImportService,
  PresentationImportService,
  ProjectRepository,
} from '../../../../src/services/contracts/interfaces';
import type { PptxImportInput } from '../../../../src/services/importing/pptx/pptxImportService';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';

function createAppServices(options: Parameters<typeof createRealAppServices>[0] = {}) {
  vi.stubGlobal('showDirectoryPicker', vi.fn());
  return createRealAppServices({
    initialProject: sampleProject.createSampleProject(),
    ...options,
  });
}

class SavingProjectRepository implements ProjectRepository {
  savedProjects: ProjectDocument[] = [];
  savedProjectsAs: ProjectDocument[] = [];

  loadProject(): Promise<ProjectDocument | null> {
    return Promise.resolve(null);
  }

  saveProject(project: ProjectDocument): Promise<void> {
    this.savedProjects.push(project);
    return Promise.resolve();
  }

  saveProjectAs(project: ProjectDocument): Promise<void> {
    this.savedProjectsAs.push(project);
    return Promise.resolve();
  }
}

class PendingPresentationImportService implements PresentationImportService {
  importCalls: PptxImportInput[] = [];
  resolveImport: ((project: ProjectDocument) => void) | undefined;

  importPowerPoint(input: PptxImportInput): Promise<ProjectDocument> {
    this.importCalls.push(input);
    return new Promise((resolve) => {
      this.resolveImport = resolve;
    });
  }
}

class FailingFontImportService implements FontImportService {
  requests: FontImportRequest[] = [];
  resolveFonts: (() => void) | undefined;

  listDownloadableFonts() {
    return [];
  }

  resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult> {
    this.requests = requests;
    return new Promise((resolve) => {
      this.resolveFonts = () => {
        resolve({
          fonts: {},
          resolutions: [],
          warnings: [
            {
              code: 'font-download-failed',
              message: 'Could not download Montserrat.',
              severity: 'warning',
            },
          ],
        });
      };
    });
  }

  loadProjectFonts(): Promise<void> {
    return Promise.resolve();
  }
}

class MissingFontImportService implements FontImportService {
  requests: FontImportRequest[][] = [];

  listDownloadableFonts() {
    return [
      { family: 'Carlito', aliases: ['Calibri'], source: 'google-fonts' as const },
      { family: 'Inter', source: 'google-fonts' as const },
    ];
  }

  resolveAndDownloadFonts(requests: FontImportRequest[]): Promise<FontImportResult> {
    this.requests.push(requests);
    if (requests.some((request) => request.family === 'Tenorite')) {
      return Promise.resolve({
        fonts: {},
        resolutions: requests.map((request) => ({
          fontStyle: request.fontStyle,
          fontWeight: request.fontWeight,
          message: `${request.family} is missing and needs a replacement or uploaded font file.`,
          requestedFamily: request.family,
          status: 'missing-needs-user' as const,
        })),
        warnings: [
          {
            code: 'font-missing',
            message:
              'Tenorite is not available locally and no downloadable match is configured. Replace it or upload the font to preserve the PowerPoint design.',
            severity: 'warning',
          },
        ],
      });
    }

    return Promise.resolve({
      fonts: {
        'google-fonts-carlito-normal-700': {
          id: 'google-fonts-carlito-normal-700',
          family: 'Carlito',
          requestedFamily: requests[0]?.family ?? 'Carlito',
          source: 'google-fonts',
          fontStyle: 'normal',
          fontWeight: 700,
          mimeType: 'font/woff2',
          fileName: 'google-fonts-carlito-normal-700.woff2',
          storage: 'inline',
          objectUrl: 'blob:font',
          sourceUrl: 'https://fonts.gstatic.com/carlito.woff2',
        },
      },
      resolutions: requests.map((request) => ({
        family: request.family,
        fontStyle: request.fontStyle,
        fontWeight: request.fontWeight,
        requestedFamily: request.family,
        status: 'downloaded-exact' as const,
      })),
      warnings: [],
    });
  }

  loadProjectFonts(): Promise<void> {
    return Promise.resolve();
  }
}

function createPowerPointFileHandle(file: File | Error) {
  return {
    getFile: () => {
      if (file instanceof File) return Promise.resolve(file);
      return Promise.reject(file);
    },
    kind: 'file',
    name: 'deck.pptx',
  };
}

function findProjectNameButton(projectName: string) {
  return screen.findByRole(
    'button',
    { name: `Edit project name ${projectName}` },
    { timeout: 5_000 },
  );
}

describe('EditorShell PowerPoint import', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('shows PowerPoint import progress only after a source is selected', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const importService = new PendingPresentationImportService();
    services.presentationImportService = importService;
    let resolvePicker: ((handles: Array<{ getFile: () => Promise<File> }>) => void) | undefined;
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(
        () =>
          new Promise<Array<{ getFile: () => Promise<File> }>>((resolve) => {
            resolvePicker = resolve;
          }),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));

    expect(screen.queryByRole('progressbar', { name: 'PowerPoint import progress' })).toBeNull();

    act(() => {
      resolvePicker?.([
        {
          getFile: () =>
            Promise.resolve(
              new File(['pptx'], 'deck.pptx', {
                type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              }),
            ),
        },
      ]);
    });

    expect(
      await screen.findByRole('progressbar', { name: 'PowerPoint import progress' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(importService.importCalls).toHaveLength(1);
    });
    expect(importService.importCalls[0]?.file.name).toBe('deck.pptx');

    act(() => {
      importService.resolveImport?.({
        ...services.initialProject,
        name: 'Imported PowerPoint Deck',
      });
    });

    expect(await findProjectNameButton('Imported PowerPoint Deck')).toBeInTheDocument();
  });

  it('chooses a fresh persistence target after importing PowerPoint over a saved project', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    const importService = new PendingPresentationImportService();
    services.projectRepository = repository;
    services.presentationImportService = importService;
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new File(['pptx'], 'deck.pptx', {
              type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            }),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));
    expect(repository.savedProjects).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));
    await waitFor(() => {
      expect(importService.importCalls).toHaveLength(1);
    });

    act(() => {
      importService.resolveImport?.({
        ...services.initialProject,
        id: 'imported-powerpoint-project',
        name: 'Imported PowerPoint Deck',
      });
    });

    expect(await findProjectNameButton('Imported PowerPoint Deck')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Persistence disabled' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    await user.click(screen.getByRole('button', { name: 'Choose folder' }));

    expect(repository.savedProjectsAs).toHaveLength(1);
    expect(repository.savedProjectsAs[0]).toMatchObject({
      id: 'imported-powerpoint-project',
      name: 'Imported PowerPoint Deck',
    });
  });

  it('downloads PPTX fonts during import without blocking the deck when fonts fail', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const fontImportService = new FailingFontImportService();
    services.fontImportService = fontImportService;
    services.presentationImportService = {
      importPowerPoint: () =>
        Promise.resolve({
          ...services.initialProject,
          name: 'Imported Font Deck',
          elements: {
            title: {
              id: 'title',
              type: 'text',
              text: 'Custom font',
              x: 0,
              y: 0,
              width: 400,
              height: 100,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
              align: 'left',
              fill: '#111111',
              fontFamily: 'Montserrat',
              fontSize: 48,
              fontWeight: 700,
            },
          },
          pages: [
            {
              ...services.initialProject.pages[0]!,
              elementIds: ['title'],
            },
          ],
        }),
    };
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new File(['pptx'], 'deck.pptx', {
              type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            }),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));

    expect(await screen.findAllByText('Downloading fonts')).toHaveLength(2);
    await waitFor(() => {
      expect(fontImportService.resolveFonts).toBeDefined();
    });
    await act(async () => {
      fontImportService.resolveFonts?.();
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => resolve());
            });
          });
        });
      });
    });
    expect(await findProjectNameButton('Imported Font Deck')).toBeInTheDocument();
    expect(fontImportService.requests).toEqual([
      { family: 'Montserrat', fontStyle: 'normal', fontWeight: 700 },
    ]);
  });

  it('shows missing PPTX fonts and replaces them from Google Fonts search', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const fontImportService = new MissingFontImportService();
    services.fontImportService = fontImportService;
    services.presentationImportService = {
      importPowerPoint: () =>
        Promise.resolve({
          ...services.initialProject,
          name: 'Imported Missing Font Deck',
          elements: {
            title: {
              id: 'title',
              type: 'text',
              text: 'Custom font',
              x: 0,
              y: 0,
              width: 400,
              height: 100,
              rotation: 0,
              locked: false,
              visible: true,
              opacity: 1,
              align: 'left',
              fill: '#111111',
              fontFamily: 'Tenorite',
              fontSize: 48,
              fontWeight: 700,
            },
          },
          pages: [
            {
              ...services.initialProject.pages[0]!,
              elementIds: ['title'],
            },
          ],
        }),
    };
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new File(['pptx'], 'deck.pptx', {
              type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            }),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));

    const warningDialog = await screen.findByRole('dialog', {
      name: 'PowerPoint font warnings',
    });
    expect(warningDialog).toHaveTextContent('This PowerPoint presentation may look different.');
    expect(warningDialog).toHaveTextContent('The font Tenorite is missing.');

    await user.click(within(warningDialog).getByRole('button', { name: 'Replace Fonts' }));
    const replacementDialog = screen.getByRole('dialog', { name: 'Replace PowerPoint fonts' });
    expect(within(replacementDialog).getByRole('table', { name: 'Missing PowerPoint fonts' })).toHaveTextContent(
      'Tenorite',
    );

    await user.type(
      within(replacementDialog).getByRole('searchbox', {
        name: 'Search Google Fonts for replacement',
      }),
      'carl',
    );
    await user.click(within(replacementDialog).getByRole('button', { name: /Carlito/ }));
    expect(replacementDialog).toHaveTextContent('Carlito');

    await user.click(within(replacementDialog).getByRole('button', { name: 'Replace Fonts' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Replace PowerPoint fonts' })).toBeNull();
    });
    expect(fontImportService.requests.at(-1)).toEqual([
      { family: 'Carlito', fontStyle: 'normal', fontWeight: 700 },
    ]);
  });

  it('reports PowerPoint picker failures without starting import progress', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const importService = new PendingPresentationImportService();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    services.presentationImportService = importService;
    vi.stubGlobal(
      'showOpenFilePicker',
      vi.fn(() =>
        Promise.resolve([
          createPowerPointFileHandle(
            new DOMException(
              'A requested file or directory could not be found at the time an operation was processed.',
              'NotFoundError',
            ),
          ),
        ] as FileSystemFileHandle[]),
      ),
    );
    render(<EditorShell services={services} />);

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Import' }));
    await user.click(screen.getByRole('menuitem', { name: 'PowerPoint (.pptx)' }));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });
    expect(importService.importCalls).toHaveLength(0);
    expect(screen.queryByRole('progressbar', { name: 'PowerPoint import progress' })).toBeNull();
    expect(consoleError.mock.calls[0]?.[0]).toBe('[LocalStudio PPTX Import]');
    consoleError.mockRestore();
  });
});
