import {
  AlignElementCommand,
  DeleteElementCommand,
  SetZOrderCommand,
  UpdateElementFrameCommand,
  UpdateTextContentCommand,
} from '../../../../src/domain/commands/basicCommands';
import { createSampleProject } from '../../../../src/domain/sampleProject';

describe('editor commands', () => {
  it('aligns an element to page horizontal center immutably', () => {
    const project = createSampleProject();
    const command = new AlignElementCommand('page-1', 'image-hero', 'horizontal-center');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']?.x).toBe((1920 - 1200) / 2);
    expect(project.elements['image-hero']?.x).toBe(360);
  });

  it('brings an element to front by moving its id to the end', () => {
    const project = createSampleProject();
    const command = new SetZOrderCommand('page-1', 'image-hero', 'front');
    const next = command.execute(project);

    expect(next.pages[0]?.elementIds.at(-1)).toBe('image-hero');
  });

  it('deletes an element and removes it from z-order', () => {
    const project = createSampleProject();
    const command = new DeleteElementCommand('page-1', 'text-subtitle');
    const next = command.execute(project);

    expect(next.elements['text-subtitle']).toBeUndefined();
    expect(next.pages[0]?.elementIds).not.toContain('text-subtitle');
  });

  it('updates element position, size, and rotation immutably', () => {
    const project = createSampleProject();
    const command = new UpdateElementFrameCommand('image-hero', {
      x: 42,
      y: 84,
      width: 640,
      height: 320,
      rotation: 12,
    });
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['image-hero']).toMatchObject({
      x: 42,
      y: 84,
      width: 640,
      height: 320,
      rotation: 12,
    });
    expect(project.elements['image-hero']).toMatchObject({
      x: 360,
      y: 210,
      width: 1200,
      height: 650,
      rotation: 0,
    });
  });

  it('updates text content immutably', () => {
    const project = createSampleProject();
    const command = new UpdateTextContentCommand('text-title', 'Edited headline');
    const next = command.execute(project);

    expect(next).not.toBe(project);
    expect(next.elements['text-title']).toMatchObject({ text: 'Edited headline' });
    expect(project.elements['text-title']).toMatchObject({ text: 'AI Design Revolution' });
  });
});
