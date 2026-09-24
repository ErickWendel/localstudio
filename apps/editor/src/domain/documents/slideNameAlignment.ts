import type { Page } from './model';

const defaultSlideNamePattern = /^Slide \d+$/;

function isDefaultSlideName(name: string) {
  return defaultSlideNamePattern.test(name.trim());
}

function hasSkippedPages(pages: readonly Page[]) {
  return pages.some((page) => page.visible === false);
}

function normalizeSlideName(pages: readonly Page[], index: number, name: string) {
  const trimmed = name.trim();
  if (!isDefaultSlideName(trimmed) || hasSkippedPages(pages)) return trimmed;
  return `Slide ${index + 1}`;
}

function getAlignedSlideName(pages: readonly Page[], index: number) {
  return normalizeSlideName(pages, index, pages[index]?.name ?? '');
}

function alignDefaultSlideNames(pages: readonly Page[]): Page[] {
  if (hasSkippedPages(pages)) return [...pages];
  let changed = false;
  const nextPages = pages.map((page, index) => {
    const name = normalizeSlideName(pages, index, page.name);
    if (name === page.name) return page;
    changed = true;
    return { ...page, name };
  });
  return changed ? nextPages : [...pages];
}

export const slideNameAlignment = {
  alignDefaultSlideNames,
  getAlignedSlideName,
  isDefaultSlideName,
  normalizeSlideName,
};
