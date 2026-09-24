import { describe, expect, it } from 'vitest';
import type { Page } from '../../../src/domain/documents/model';
import { slideNameAlignment } from '../../../src/domain/documents/slideNameAlignment';

function page(id: string, name: string, visible = true): Page {
  return {
    id,
    name,
    width: 1920,
    height: 1080,
    background: { type: 'color', color: '#000000' },
    elementIds: [],
    ...(visible ? {} : { visible: false }),
  };
}

describe('slide name alignment', () => {
  it('gives default slide names the same number as their page when nothing is skipped', () => {
    const pages = [page('page-1', 'Slide 3'), page('page-2', 'Agenda'), page('page-3', 'Slide 1')];

    expect(slideNameAlignment.getAlignedSlideName(pages, 0)).toBe('Slide 1');
    expect(slideNameAlignment.getAlignedSlideName(pages, 1)).toBe('Agenda');
    expect(slideNameAlignment.alignDefaultSlideNames(pages).map((item) => item.name)).toEqual([
      'Slide 1',
      'Agenda',
      'Slide 3',
    ]);
  });

  it('keeps stored slide numbers when a page is skipped', () => {
    const pages = [page('page-1', 'Slide 1'), page('page-2', 'Slide 4', false), page('page-3', 'Slide 2')];

    expect(slideNameAlignment.getAlignedSlideName(pages, 0)).toBe('Slide 1');
    expect(slideNameAlignment.getAlignedSlideName(pages, 1)).toBe('Slide 4');
    expect(slideNameAlignment.getAlignedSlideName(pages, 2)).toBe('Slide 2');
    expect(slideNameAlignment.alignDefaultSlideNames(pages).map((item) => item.name)).toEqual([
      'Slide 1',
      'Slide 4',
      'Slide 2',
    ]);
  });
});
