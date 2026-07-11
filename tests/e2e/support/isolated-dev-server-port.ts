import { createServer } from 'node:net';

export const isolatedDevServerPort = {
  async getFreePort(): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => {
          if (!address || typeof address === 'string') {
            reject(new Error('Failed to allocate a free local port.'));
            return;
          }
          resolve(address.port);
        });
      });
      server.on('error', reject);
    });
  },
};
