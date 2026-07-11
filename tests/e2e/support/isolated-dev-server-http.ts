export const isolatedDevServerHttp = {
  async waitForOk(url: string): Promise<void> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 30_000) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch {
        // Keep polling until the server accepts connections.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for ${url}`);
  },
};
