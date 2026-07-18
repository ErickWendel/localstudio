import type { TextColorRange } from './model';

interface ApplyTextColorRangeInput {
  fill: string;
  range: TextColorRange;
  ranges?: TextColorRange[] | undefined;
  textLength: number;
}

function clampRange(range: TextColorRange, textLength: number) {
  return {
    ...range,
    start: Math.max(0, Math.min(textLength, Math.floor(range.start))),
    end: Math.max(0, Math.min(textLength, Math.floor(range.end))),
  };
}

function rangesOverlap(left: TextColorRange, right: TextColorRange) {
  return left.start < right.end && right.start < left.end;
}

function mergeAdjacentRanges(ranges: TextColorRange[]) {
  return ranges.reduce<TextColorRange[]>((merged, range) => {
    const previous = merged.at(-1);
    if (previous && previous.end === range.start && previous.fill === range.fill) {
      previous.end = range.end;
      return merged;
    }
    merged.push({ ...range });
    return merged;
  }, []);
}

function applyTextColorRange({
  fill,
  range,
  ranges = [],
  textLength,
}: ApplyTextColorRangeInput) {
  const nextRange = clampRange({ ...range, fill }, textLength);
  if (nextRange.start >= nextRange.end) return ranges;

  const nextRanges = ranges.flatMap((existingRange) => {
    const clampedExistingRange = clampRange(existingRange, textLength);
    if (clampedExistingRange.start >= clampedExistingRange.end) return [];
    if (!rangesOverlap(clampedExistingRange, nextRange)) return [clampedExistingRange];

    const fragments: TextColorRange[] = [];
    if (clampedExistingRange.start < nextRange.start) {
      fragments.push({
        ...clampedExistingRange,
        end: nextRange.start,
      });
    }
    if (clampedExistingRange.end > nextRange.end) {
      fragments.push({
        ...clampedExistingRange,
        start: nextRange.end,
      });
    }
    return fragments;
  });

  nextRanges.push(nextRange);
  return mergeAdjacentRanges(nextRanges.sort((left, right) => left.start - right.start));
}

function trimTextColorRanges(ranges: TextColorRange[] | undefined, textLength: number) {
  const trimmedRanges = mergeAdjacentRanges(
    (ranges ?? [])
      .map((range) => clampRange(range, textLength))
      .filter((range) => range.start < range.end)
      .sort((left, right) => left.start - right.start),
  );
  return trimmedRanges.length > 0 ? trimmedRanges : undefined;
}

export const textColorRanges = {
  applyTextColorRange,
  trimTextColorRanges,
};
