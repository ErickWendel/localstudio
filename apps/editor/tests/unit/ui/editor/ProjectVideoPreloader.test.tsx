import { render } from '@testing-library/react';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { ProjectVideoPreloader } from '../../../../src/ui/editor/media/ProjectVideoPreloader';

describe('ProjectVideoPreloader', () => {
  it('preloads project video and GIF assets without exposing playback controls', () => {
    const project = sampleProject.createSampleProject();
    project.assets['asset-video'] = {
      id: 'asset-video',
      type: 'video',
      name: 'Imported video',
      mimeType: 'video/mp4',
      objectUrl: 'blob:video',
    };
    project.assets['asset-gif'] = {
      id: 'asset-gif',
      type: 'gif',
      name: 'Imported GIF',
      mimeType: 'image/gif',
      objectUrl: 'blob:gif',
    };

    const { container } = render(<ProjectVideoPreloader project={project} />);
    const video = container.querySelector('video[src="blob:video"]') as HTMLVideoElement;
    const gif = container.querySelector('img[src="blob:gif"]');

    expect(video).toBeInTheDocument();
    expect(video.preload).toBe('auto');
    expect(video.controls).toBe(false);
    expect(gif).toBeInTheDocument();
  });
});
