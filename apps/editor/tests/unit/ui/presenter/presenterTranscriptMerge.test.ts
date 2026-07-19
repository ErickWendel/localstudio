import { describe, expect, it } from 'vitest';
import { mergeRollingTranscript } from '../../../../src/ui/presenter/presenterTranscriptMerge';

describe('mergeRollingTranscript', () => {
  it('ignores a repeated rolling transcript when speech has stopped', () => {
    const previous =
      "Hello there. I'm Eric Wendell and this is my talk about WebBI. I'm gonna show you what is the WebBI thing in the browser.";
    const next =
      "Hello there. I'm Eric Wendell and this is my talk about WebBI. I'm gonna show you what is the WebBI thing in the browser.";

    expect(mergeRollingTranscript(previous, next)).toEqual({
      text: previous,
      updatedExistingTail: true,
    });
  });

  it('updates the existing tail instead of appending a fuzzy duplicate', () => {
    const previous =
      "you Hello there. I'm Eric Wendell and this is my talk about where Hello there. I'm Eric Wendell and this is my talk about WebBI. I'm gonna show you what is this";
    const next =
      "Hello there. I'm Eric Wendell and this is my talk about Webby. I'm gonna show you what is the Webby thing in the browser.";

    const result = mergeRollingTranscript(previous, next);

    expect(result.updatedExistingTail).toBe(true);
    expect(result.text).toBe(
      "you Hello there. I'm Eric Wendell and this is my talk about where Hello there. I'm Eric Wendell and this is my talk about Webby. I'm gonna show you what is the Webby thing in the browser.",
    );
  });

  it('appends only new words when the rolling transcript continues the previous text', () => {
    const result = mergeRollingTranscript(
      'Hello there. I am talking about WebAI in the browser.',
      'WebAI in the browser. And now I am showing slides.',
    );

    expect(result).toEqual({
      text: 'Hello there. I am talking about WebAI in the browser. And now I am showing slides.',
      updatedExistingTail: false,
    });
  });
});
