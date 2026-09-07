import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditorShell } from '../../../../src/ui/editor/shell/EditorShell';
import { editorShellTestHarness } from './EditorShell.test-harness';

const {
  SavingProjectRepository,
  createAppServices,
  createProjectWithVideo,
  mockControllableVideoMetadataLoad,
  mockVideoMetadataLoadFailure,
  openLeftTab,
} = editorShellTestHarness;

async function openMovieInspector(user: ReturnType<typeof userEvent.setup>) {
  await openLeftTab(user, 'Layout');
  fireEvent.click(screen.getByRole('button', { name: 'Demo clip' }));
}

function getFileInfoSection() {
  return screen.getByRole('region', { name: 'Movie file info' });
}

describe('EditorShell video replace workflow', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/editor/');
    vi.restoreAllMocks();
  });

  it('blocks MOV replacements with a clear unsupported-format message', async () => {
    // The browser's file-picker `accept` filter is only an OS-level hint, so it
    // must not be relied on for validation; disable it here to exercise the
    // app's own format check the way a user bypassing the picker filter would.
    const user = userEvent.setup({ applyAccept: false });
    const services = createAppServices({ initialProject: createProjectWithVideo() });
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    render(<EditorShell services={services} />);
    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));

    await openMovieInspector(user);
    expect(within(getFileInfoSection()).getByText('Demo clip')).toBeInTheDocument();

    const input = screen.getByLabelText('Replace video file');
    expect(input).toHaveAttribute('accept', 'video/mp4,video/webm,.mp4,.webm');

    const video = new File(['video-bytes'], 'phone-video.mov', { type: 'video/quicktime' });
    await user.upload(input, video);

    expect(await screen.findByText('Unsupported video format')).toBeInTheDocument();
    expect(screen.getByText(/Video import supports MP4 and WebM files/)).toBeInTheDocument();
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(within(getFileInfoSection()).getByText('Demo clip')).toBeInTheDocument();
    expect(
      Object.values(repository.savedProjects.at(-1)?.assets ?? {}).some(
        (asset) => asset.name === 'phone-video.mov',
      ),
    ).toBe(false);
  });

  it('preserves the original asset and revokes the object URL when the video fails to decode', async () => {
    const user = userEvent.setup();
    const services = createAppServices({ initialProject: createProjectWithVideo() });
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));

    await openMovieInspector(user);

    mockVideoMetadataLoadFailure();
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:broken-replacement');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL');

    const video = new File(['video-bytes'], 'broken.mp4', { type: 'video/mp4' });
    await user.upload(screen.getByLabelText('Replace video file'), video);

    expect(await screen.findByText('Media import failed')).toBeInTheDocument();
    expect(createObjectUrl).toHaveBeenCalledWith(video);
    await waitFor(() => {
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:broken-replacement');
    });
    expect(within(getFileInfoSection()).getByText('Demo clip')).toBeInTheDocument();
    expect(
      Object.values(repository.savedProjects.at(-1)?.assets ?? {}).some(
        (asset) => asset.name === 'broken.mp4',
      ),
    ).toBe(false);
  });

  it('replaces the video with the new file without buffering it as a data URL', async () => {
    const user = userEvent.setup();
    const services = createAppServices({ initialProject: createProjectWithVideo() });
    const repository = new SavingProjectRepository();
    services.projectRepository = repository;
    render(<EditorShell services={services} />);
    fireEvent.click(screen.getByRole('button', { name: 'Persistence disabled' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose folder' }));

    await openMovieInspector(user);

    const metadata = mockControllableVideoMetadataLoad();
    const createObjectUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:replacement-video');

    const video = new File(['video-bytes'], 'replacement.mp4', { type: 'video/mp4' });
    await user.upload(screen.getByLabelText('Replace video file'), video);

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

    await waitFor(() => {
      const savedProject = repository.savedProjects.at(-1);
      const videoElement = savedProject?.elements['video-demo'];
      expect(videoElement?.type).toBe('video');
      const assetId = videoElement && 'assetId' in videoElement ? videoElement.assetId : undefined;
      const asset = assetId ? savedProject?.assets[assetId] : undefined;
      expect(asset?.objectUrl).toBe('blob:replacement-video');
      expect(asset?.name).toBe('replacement.mp4');
      expect(
        videoElement && 'durationSeconds' in videoElement
          ? videoElement.durationSeconds
          : undefined,
      ).toBe(8.5);
    });

    expect(createObjectUrl).toHaveBeenCalledWith(video);
    expect(within(getFileInfoSection()).getByText('replacement.mp4')).toBeInTheDocument();
    metadata.createElementSpy.mockRestore();
  });
});
