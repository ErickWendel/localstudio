type MockAiBrowserApiPayload = {
  slideElements: string[];
  slideTasks: string;
};

export function mockAiBrowserApiInitScript({ slideElements, slideTasks }: MockAiBrowserApiPayload) {
  let promptResponseIndex = 0;
  let elementResponseIndex = 0;

  Object.defineProperty(navigator, 'gpu', {
    configurable: true,
    value: {},
  });

  type MonitorOptions = { monitor?: ((target: EventTarget) => void) | undefined };

  Object.defineProperty(window, 'LanguageModel', {
    configurable: true,
    value: {
      availability: async () => {
        await Promise.resolve();
        return 'available';
      },
      create: async (options: MonitorOptions = {}) => {
        await Promise.resolve();
        const monitorTarget = new EventTarget();
        options.monitor?.(monitorTarget);
        monitorTarget.dispatchEvent(
          new CustomEvent('downloadprogress', { detail: { loaded: 1, total: 1 } }),
        );
        return {
          destroy: () => undefined,
          prompt: async () => {
            await Promise.resolve();
            if (promptResponseIndex === 0) {
              promptResponseIndex += 1;
              return slideTasks;
            }
            promptResponseIndex += 1;
            const response = slideElements[elementResponseIndex] ?? slideElements.at(-1)!;
            elementResponseIndex += 1;
            return response;
          },
        };
      },
    },
  });

  Object.defineProperty(window, 'LanguageDetector', {
    configurable: true,
    value: {
      create: async () => {
        await Promise.resolve();
        return {
          detect: async () => {
            await Promise.resolve();
            return [{ detectedLanguage: 'en' }];
          },
        };
      },
    },
  });

  Object.defineProperty(window, 'Translator', {
    configurable: true,
    value: {
      availability: async () => {
        await Promise.resolve();
        return 'available';
      },
      create: async (options: MonitorOptions & { targetLanguage?: string } = {}) => {
        await Promise.resolve();
        const monitorTarget = new EventTarget();
        options.monitor?.(monitorTarget);
        monitorTarget.dispatchEvent(new ProgressEvent('downloadprogress', { loaded: 1 }));
        return {
          ready: Promise.resolve(),
          translate: async (text: string) => {
            await Promise.resolve();
            return `[${options.targetLanguage}] ${text}`;
          },
        };
      },
    },
  });
}
