import { fireEvent, act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  SavingProjectRepository,
  createAppServices,
  createProjectWithVideo,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoad,
  openLeftTab,
  selectImageLayer,
} = editorShellTestHarness;

describe('EditorShell media import workflows', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('inserts text and media from the floating toolbar', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    await openLeftTab(user, 'Layout');
    await selectImageLayer(user);

    fireEvent.click(screen.getByRole('button', { name: 'Insert Text' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add a heading' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));
    await waitFor(() => {
      const insertedText = Object.values(repository.savedProjects.at(-1)?.elements ?? {}).find(
        (element) =>
          element.type === 'text' && element.id !== 'text-title' && element.id !== 'text-subtitle',
      );
      expect(insertedText).toMatchObject({
        type: 'text',
        text: 'Add a heading',
        width: 600,
        height: 240,
        fontFamily: 'Orbitron',
        fontSize: 96,
        fontWeight: 800,
        fill: '#37FD76',
        align: 'center',
      });
    });

    const image = new File(['image-bytes'], 'toolbar-image.png', { type: 'image/png' });
    await selectImageLayer(user);
    fireEvent.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), image);

    expect(
      await screen.findByRole('button', { name: 'toolbar-image.png' }, { timeout: 5_000 }),
    ).toHaveAttribute('aria-pressed', 'true');

    mockVideoMetadataLoad();
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:toolbar-video');
    const video = new File(['video-bytes'], 'toolbar-video.mp4', { type: 'video/mp4' });
    fireEvent.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const importedVideo = Object.values(savedProject?.elements ?? {}).find(
        (element) => element.type === 'video',
      );
      expect(importedVideo).toMatchObject({
        autoplayInPreview: true,
        playing: true,
        type: 'video',
      });
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.name).toBe('toolbar-video.mp4');
      expect(savedProject?.assets[importedVideo?.assetId ?? '']?.objectUrl).toBe(
        'blob:toolbar-video',
      );
    });
    expect(createObjectUrl).toHaveBeenCalledWith(video);
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video trim end')).toHaveValue('8.5');
  });

  it('shows loading feedback while local video metadata is imported', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    services.projectRepository = new SavingProjectRepository();
    const metadata = mockControllableVideoMetadataLoad();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pending-video');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'pending-video.mp4', { type: 'video/mp4' });
    fireEvent.click(screen.getByRole('button', { name: 'Insert Media' }));
    await user.upload(screen.getByLabelText('Insert media file'), video);

    expect(await screen.findByText('Loading media')).toBeInTheDocument();
    expect(
      screen.getByText('Loading video metadata without copying the full file into memory.'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(metadata.hasMetadataTarget()).toBe(true);
    });

    act(() => {
      metadata.loadMetadata();
    });

    await waitFor(() => {
      expect(screen.queryByText('Loading media')).not.toBeInTheDocument();
    });
    metadata.createElementSpy.mockRestore();
  });

  it('blocks MOV uploads with a clear unsupported-format message', async () => {
    const user = userEvent.setup();
    const services = createAppServices();
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    render(<EditorShell services={services} />);

    const video = new File(['video-bytes'], 'phone-video.mov', { type: 'video/quicktime' });
    fireEvent.click(screen.getByRole('button', { name: 'Insert Media' }));
    const input = screen.getByLabelText('Insert media file');
    expect(input).toHaveAttribute('accept', 'image/*,video/*');
    await user.upload(input, video);

    expect(await screen.findByText('Unsupported video format')).toBeInTheDocument();
    expect(screen.getByText('Supported formats')).toBeInTheDocument();
    expect(screen.getByText('info')).toHaveClass('media-import-info-icon');
    expect(screen.getByText(/Video import supports MP4 and WebM files/)).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Media import progress' }),
    ).not.toBeInTheDocument();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(
      Object.values(repository.savedProjects.at(-1)?.assets ?? {}).some(
        (asset) => asset.name === 'phone-video.mov',
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByText('Unsupported video format')).not.toBeInTheDocument();
  });

  it('opens the media settings panel when a video layer is selected', async () => {
    const user = userEvent.setup();
    render(
      <EditorShell services={createAppServices({ initialProject: createProjectWithVideo() })} />,
    );

    await openLeftTab(user, 'Layout');
    fireEvent.click(screen.getByRole('button', { name: 'Demo clip' }));

    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Movie' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Selected video repeat mode')).toBeInTheDocument();
  });
});
