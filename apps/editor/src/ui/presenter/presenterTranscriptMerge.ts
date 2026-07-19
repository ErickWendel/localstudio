export interface PresenterTranscriptMergeResult {
  text: string;
  updatedExistingTail: boolean;
}

const duplicateCoverageThreshold = 0.68;
const fuzzyWordMatchThreshold = 0.78;

function normalizeTranscriptText(text: string) {
  return text.trim().replace(/\s+/g, ' ');
}

function normalizeTranscriptWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function getLevenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex] === right[rightIndex] ? 0 : 1;
      current[rightIndex + 1] = Math.min(
        current[rightIndex]! + 1,
        previous[rightIndex + 1]! + 1,
        previous[rightIndex]! + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length]!;
}

function wordsAreSimilar(left: string, right: string) {
  if (!left || !right) return false;
  if (left === right) return true;
  const longestLength = Math.max(left.length, right.length);
  if (longestLength <= 3) return false;
  const similarity = 1 - getLevenshteinDistance(left, right) / longestLength;
  return similarity >= fuzzyWordMatchThreshold;
}

function getTranscriptWordOverlap(previousWords: string[], nextWords: string[]) {
  const maxOverlap = Math.min(previousWords.length, nextWords.length);
  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    const previousSuffix = previousWords.slice(previousWords.length - overlap);
    const nextPrefix = nextWords.slice(0, overlap);
    if (previousSuffix.every((word, index) => wordsAreSimilar(word, nextPrefix[index] ?? ''))) {
      return overlap;
    }
  }
  return 0;
}

function findBestPrefixMatch(previousWords: string[], nextWords: string[]) {
  let best = { length: 0, startIndex: -1 };
  for (let startIndex = 0; startIndex < previousWords.length; startIndex += 1) {
    let length = 0;
    while (
      startIndex + length < previousWords.length &&
      length < nextWords.length &&
      wordsAreSimilar(previousWords[startIndex + length] ?? '', nextWords[length] ?? '')
    ) {
      length += 1;
    }
    if (length > best.length) best = { length, startIndex };
  }
  return best;
}

export function mergeRollingTranscript(
  previousText: string,
  nextText: string,
): PresenterTranscriptMergeResult {
  const previous = normalizeTranscriptText(previousText);
  const next = normalizeTranscriptText(nextText);
  if (!next) return { text: previous, updatedExistingTail: true };
  if (!previous) return { text: next, updatedExistingTail: false };
  if (previous.includes(next)) return { text: previous, updatedExistingTail: true };
  if (next.startsWith(previous)) return { text: next, updatedExistingTail: false };

  const previousWords = previous.split(' ');
  const nextWords = next.split(' ');
  const normalizedPreviousWords = previousWords.map(normalizeTranscriptWord);
  const normalizedNextWords = nextWords.map(normalizeTranscriptWord);
  const overlap = getTranscriptWordOverlap(normalizedPreviousWords, normalizedNextWords);
  if (overlap > 0) {
    return {
      text: normalizeTranscriptText(`${previous} ${nextWords.slice(overlap).join(' ')}`),
      updatedExistingTail: false,
    };
  }

  const prefixMatch = findBestPrefixMatch(normalizedPreviousWords, normalizedNextWords);
  const prefixCoverage = prefixMatch.length / nextWords.length;
  if (prefixCoverage >= duplicateCoverageThreshold) {
    const prefix = previousWords.slice(0, prefixMatch.startIndex);
    return {
      text: normalizeTranscriptText([...prefix, ...nextWords].join(' ')),
      updatedExistingTail: true,
    };
  }

  if (nextWords.length <= 2) return { text: previous, updatedExistingTail: true };
  return {
    text: normalizeTranscriptText(`${previous} ${next}`),
    updatedExistingTail: false,
  };
}
