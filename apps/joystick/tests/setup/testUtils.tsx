import '@testing-library/jest-dom/vitest';

Object.defineProperties(HTMLMediaElement.prototype, {
  load: {
    configurable: true,
    value() {
      return undefined;
    },
  },
  pause: {
    configurable: true,
    value() {
      return undefined;
    },
  },
  play: {
    configurable: true,
    value() {
      return Promise.resolve();
    },
  },
});
