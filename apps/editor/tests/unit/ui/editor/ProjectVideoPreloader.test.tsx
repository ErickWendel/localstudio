import { render } from '@testing-library/react';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { ProjectVideoPreloader } from '../../../../src/ui/editor/media/ProjectVideoPreloader';

describe('ProjectVideoPreloader', () => {
  it('preloads project video assets without exposing playback controls', () => {
    const project = sampleProject.createSampleProject();
    project.assets['asset-video'] = {
      id: 'asset-video',
      type: 'video',
      name: 'Imported video',
      mimeType: 'video/mp4',
      objectUrl: 'blob:video',
    };

    const { container } = render(<ProjectVideoPreloader project={project} />);
    const video = container.querySelector('video[src="blob:video"]') as HTMLVideoElement;

    expect(video).toBeInTheDocument();
    expect(video.preload).toBe('auto');
    expect(video.controls).toBe(false);
  });
});
