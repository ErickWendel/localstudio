import type { TestInfo } from '@playwright/test';

export const connectedPeerDiagnostics = {
  create() {
    const diagnostics: string[] = [];
    const capture = (source: string) => (message: { text: () => string }) => {
      const text = message.text();
      if (!text.includes('LocalStudio presenter remote') && !text.includes('PeerJS')) return;
      diagnostics.push(`${source}: ${text}`);
      if (/error|failed|timed out|lost connection/i.test(text)) console.log(`${source}: ${text}`);
    };

    return {
      attach: async (testInfo: TestInfo) => {
        await testInfo.attach('presenter-remote-diagnostics', {
          body: diagnostics.join('\n') || 'No presenter remote diagnostics captured.',
          contentType: 'text/plain',
        });
      },
      capture,
      push: (message: string) => diagnostics.push(message),
    };
  },
};
