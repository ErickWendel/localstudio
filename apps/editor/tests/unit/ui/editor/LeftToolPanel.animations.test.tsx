import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { sampleProject } from '../../../../src/domain/projects/sampleProject';
import { LeftToolPanel } from '../../../../src/ui/editor/panels/LeftToolPanel';
import { leftToolPanelTestFixtures } from './LeftToolPanel.fixtures';

const { modelStates } = leftToolPanelTestFixtures;

describe('LeftToolPanel animation controls', () => {
  it('shows slide transition and all object animations in the Animate menu', async () => {
    const user = userEvent.setup();
    const onSetPageTransition = vi.fn();
    const onClearPageTransition = vi.fn();
    const onClearElementAnimationBuild = vi.fn();
    const onReorderElementAnimationBuild = vi.fn();
    const onPlayAnimationPreview = vi.fn();
    const onSetElementAnimationBuilds = vi.fn();
    const onUpdateMediaPlayback = vi.fn();
    const project = sampleProject.createSampleProject();
    project.pages[0] = {
      ...project.pages[0]!,
      elementIds: [...project.pages[0]!.elementIds, 'shape-line', 'video-demo'],
      transition: { effect: 'reveal', delayMs: 0 },
      animationBuilds: [
        {
          id: 'build-image-hero',
          elementId: 'image-hero',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
        },
        {
          id: 'build-text-title',
          elementId: 'text-title',
          effect: 'reveal',
          trigger: 'after-transition',
          delayMs: 0,
        },
        {
          id: 'build-shape-line',
          elementId: 'shape-line',
          effect: 'line-draw',
          trigger: 'after-previous',
          delayMs: 0,
          lineDrawDirection: 'start-to-end',
        },
        {
          id: 'build-video-demo',
          elementId: 'video-demo',
          effect: 'reveal',
          trigger: 'on-click',
          delayMs: 0,
          durationMs: 0,
          mediaAction: 'play',
        },
      ],
    };
    project.assets['asset-video'] = {
      id: 'asset-video',
      type: 'video',
      name: 'Demo clip',
      mimeType: 'video/mp4',
    };
    project.elements['video-demo'] = {
      id: 'video-demo',
      type: 'video',
      assetId: 'asset-video',
      x: 0,
      y: 0,
      width: 640,
      height: 360,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      loop: false,
      controls: true,
      muted: false,
      autoplayInPreview: true,
      trimStartSeconds: 0,
    };
    project.elements['shape-line'] = {
      id: 'shape-line',
      type: 'shape',
      shape: 'line',
      x: 120,
      y: 120,
      width: 500,
      height: 140,
      rotation: 0,
      locked: false,
      visible: true,
      opacity: 1,
      stroke: '#37FD76',
      strokeWidth: 8,
    };

    render(
      <LeftToolPanel
        activeTab="animations"
        animationPreview={{
          activeBuildElementId: 'text-title',
          pageId: 'page-1',
          phase: 'waiting',
          playing: true,
          waitingForClick: true,
        }}
        open
        onTabChange={vi.fn()}
        project={project}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onClearPageTransition={onClearPageTransition}
        onClearElementAnimationBuild={onClearElementAnimationBuild}
        onSetPageTransition={onSetPageTransition}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
        onUpdateMediaPlayback={onUpdateMediaPlayback}
        onReorderElementAnimationBuild={onReorderElementAnimationBuild}
        onPlayAnimationPreview={onPlayAnimationPreview}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Animate' })).toBeInTheDocument();
    expect(screen.getByText('Slide Transition')).toBeInTheDocument();
    expect(screen.getByText('Object Animations')).toBeInTheDocument();
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText('AI Design Revolution')).toBeInTheDocument();
    expect(screen.getByText('Line')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Build 4')).toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'Build 4: Movie start' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Animation for Movie start' })).toHaveValue(
      'movie-start',
    );
    const imageEffectSelect = screen.getByRole('combobox', {
      name: 'Effect for Image',
    });
    expect(
      Array.from(imageEffectSelect.querySelectorAll('optgroup')).map((group) =>
        group.getAttribute('label'),
      ),
    ).toEqual(['Appear & Move', 'Flip, Spin & Scale']);
    expect(
      Array.from(imageEffectSelect.querySelectorAll('option')).map((option) => option.value),
    ).toEqual([
      'none',
      'clothesline',
      'confetti',
      'dissolve',
      'drop',
      'droplet',
      'fade-and-move',
      'fade-through-color',
      'grid',
      'iris',
      'move-in',
      'push',
      'radial-wipe',
      'reveal',
      'switch',
      'wipe',
      'blinds',
      'color-planes',
      'cube',
      'doorway',
      'fall',
      'flip',
      'flop',
      'mosaic',
      'page-flip',
      'pivot',
      'reflection',
      'revolving-door',
      'scale',
      'swap',
      'swoosh',
      'twirl',
      'twist',
    ]);
    expect(screen.getByRole('listitem', { name: 'Build 2: AI Design Revolution' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Current animation step 2')).toBeInTheDocument();

    const dataTransfer = {
      dropEffect: '',
      effectAllowed: '',
      getData: vi.fn(() => 'text-title'),
      setData: vi.fn(),
    };
    const titleBuildRow = screen.getByRole('listitem', { name: 'Build 2: AI Design Revolution' });
    const imageBuildRow = screen.getByRole('listitem', { name: 'Build 1: Image' });
    vi.spyOn(imageBuildRow, 'getBoundingClientRect').mockReturnValue({
      bottom: 40,
      height: 40,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.dragStart(titleBuildRow, { dataTransfer });
    fireEvent.dragOver(imageBuildRow, { dataTransfer, clientY: -1 });
    expect(imageBuildRow).toHaveAttribute('data-drop-position', 'after');
    fireEvent.drop(imageBuildRow, { dataTransfer, clientY: -1 });

    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/x-localstudio-animation-build-element-id',
      'text-title',
    );
    expect(onReorderElementAnimationBuild).toHaveBeenCalledWith('text-title', 1);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Slide transition effect' }),
      'reveal',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Slide transition effect' }),
      'none',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Effect for Image' }), 'none');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for AI Design Revolution' }),
      'keyboard-typing',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for Line' }),
      'dissolve',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Effect for Line' }),
      'line-draw',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Line draw direction for Line' }),
      'middle-to-ends',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Start for AI Design Revolution' }),
      'after-previous',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Start for Movie start' }),
      'after-transition',
    );
    await user.click(
      screen.getByRole('button', { name: 'Move AI Design Revolution animation up' }),
    );
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    expect(onSetPageTransition).toHaveBeenCalledWith({ effect: 'reveal', delayMs: 500 });
    expect(onClearPageTransition).toHaveBeenCalledTimes(1);
    expect(onClearElementAnimationBuild).toHaveBeenCalledWith('image-hero');
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'keyboard-typing',
      trigger: 'after-transition',
      delayMs: 0,
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'dissolve',
      trigger: 'after-previous',
      delayMs: 0,
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'line-draw',
      trigger: 'after-previous',
      delayMs: 0,
      lineDrawDirection: 'start-to-end',
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['shape-line'], {
      effect: 'line-draw',
      trigger: 'after-previous',
      delayMs: 0,
      lineDrawDirection: 'middle-to-ends',
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'reveal',
      trigger: 'after-previous',
      delayMs: 0,
    });
    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['video-demo'], {
      effect: 'reveal',
      trigger: 'after-transition',
      delayMs: 0,
      durationMs: 0,
      mediaAction: 'play',
    });
    expect(onUpdateMediaPlayback).toHaveBeenCalledWith('video-demo', {
      autoplayInPreview: true,
      startOnClick: false,
    });
    expect(onReorderElementAnimationBuild).toHaveBeenCalledWith('text-title', 0);
    expect(onPlayAnimationPreview).toHaveBeenCalledTimes(1);
  });

  it('uses longer default duration for heavier animation presets', async () => {
    const user = userEvent.setup();
    const onSetElementAnimationBuilds = vi.fn();

    render(
      <LeftToolPanel
        activeTab="animations"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['image-hero'] }}
        modelStates={modelStates}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
      />,
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'New object animation effect' }),
      'confetti',
    );
    await user.click(screen.getByRole('button', { name: 'Add animation' }));

    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['image-hero'], {
      effect: 'confetti',
      trigger: 'on-click',
      delayMs: 700,
    });
  });

  it('applies reveal to selected elements from the whole-slide animation view', async () => {
    const user = userEvent.setup();
    const onSetElementAnimationBuilds = vi.fn();
    const onPlayAnimationPreview = vi.fn();

    render(
      <LeftToolPanel
        activeTab="animations"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title', 'image-hero'] }}
        modelStates={modelStates}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
        onPlayAnimationPreview={onPlayAnimationPreview}
      />,
    );

    expect(screen.getByText('Object Animations')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add animation' }));
    await user.click(screen.getByRole('button', { name: 'Play animation preview' }));

    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title', 'image-hero'], {
      effect: 'reveal',
      trigger: 'on-click',
      delayMs: 500,
      direction: 'left',
    });
    expect(onPlayAnimationPreview).toHaveBeenCalledTimes(1);
  });

  it('chooses keyboard typing before adding a selected text animation', async () => {
    const user = userEvent.setup();
    const onSetElementAnimationBuilds = vi.fn();

    render(
      <LeftToolPanel
        activeTab="animations"
        open
        onTabChange={vi.fn()}
        project={sampleProject.createSampleProject()}
        activePageId="page-1"
        selection={{ pageId: 'page-1', elementIds: ['text-title'] }}
        modelStates={modelStates}
        onSetElementAnimationBuilds={onSetElementAnimationBuilds}
      />,
    );

    expect(screen.getByText('No object animations on this slide.')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'New object animation effect' }),
      'keyboard-typing',
    );
    await user.click(screen.getByRole('button', { name: 'Add animation' }));

    expect(onSetElementAnimationBuilds).toHaveBeenCalledWith(['text-title'], {
      effect: 'keyboard-typing',
      trigger: 'on-click',
      delayMs: 500,
    });
  });
});
