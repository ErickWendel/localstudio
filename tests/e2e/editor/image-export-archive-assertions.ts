import { expect } from '../support/journey-test';
import { readPngVisiblePixelRatio } from '../support/png-visible-pixel-ratio';

export const imageExportArchiveAssertions = {
  expectReadableSampleFinalSlides(archiveFiles: Record<string, Uint8Array>) {
    const suspectSlides = [1, 5, 19, 24, 25, 27, 30, 40, 42, 50].map(
      (slideNumber) => `fullstack-monitoring-jsnation-11062026-Slide ${slideNumber}.png`,
    );
    const blackSlides = suspectSlides.filter((fileName) => {
      const imageBytes = archiveFiles[fileName];
      expect(imageBytes, `${fileName} should exist in the image archive`).toBeDefined();
      if (!imageBytes) return true;
      return readPngVisiblePixelRatio(imageBytes) < 0.01;
    });
    expect(blackSlides).toEqual([]);
  },
};
