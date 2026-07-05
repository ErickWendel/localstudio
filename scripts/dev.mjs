import { createServer as createHttpServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const host = '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '4173', 10);

const apps = [
  {
    base: '/editor/',
    configFile: '../apps/editor/vite.config.ts',
    indexFile: '../apps/editor/index.html',
    name: 'editor',
    root: '../apps/editor',
  },
  {
    base: '/joystick/',
    configFile: '../apps/joystick/vite.config.ts',
    indexFile: '../apps/joystick/index.html',
    name: 'joystick',
    root: '../apps/joystick',
  },
  {
    base: '/',
    configFile: '../apps/landing/vite.config.ts',
    indexFile: '../apps/landing/index.html',
    name: 'landing',
    root: '../apps/landing',
  },
];

const httpServer = createHttpServer();
const viteServers = [];

for (const app of apps) {
  const server = await createViteServer({
    appType: 'spa',
    configFile: fileURLToPath(new URL(app.configFile, import.meta.url)),
    root: fileURLToPath(new URL(app.root, import.meta.url)),
    server: {
      hmr: {
        server: httpServer,
      },
      middlewareMode: true,
    },
  });
  viteServers.push({ ...app, server });
}

httpServer.on('request', (request, response) => {
  const app =
    viteServers.find((candidate) => candidate.base !== '/' && request.url?.startsWith(candidate.base)) ??
    viteServers.find((candidate) => candidate.base === '/');
  if (shouldServeIndex(request.url)) {
    void serveIndex(app, request, response);
    return;
  }
  app?.server.middlewares(request, response, () => {
    if (!response.headersSent) {
      response.statusCode = 404;
      response.end();
    }
  });
});

httpServer.listen(port, host, () => {
  const networkUrls = getNetworkUrls();
  console.log(`LocalStudio dev server ready on one origin:`);
  console.log(`  Local:   http://localhost:${port}/`);
  for (const url of networkUrls) console.log(`  Network: ${url}`);
  console.log('');
  console.log(`Routes:`);
  console.log(`  /`);
  console.log(`  /editor/`);
  console.log(`  /joystick/`);
});

let shuttingDown = false;

function getNetworkUrls() {
  const interfaces = getNetworkInterfaces();
  return interfaces.map((address) => `http://${address}:${port}/`);
}

function getNetworkInterfaces() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
}

async function serveIndex(app, request, response) {
  if (!shouldServeIndex(request.url)) {
    response.statusCode = 404;
    response.end();
    return;
  }
  try {
    const indexPath = fileURLToPath(new URL(app.indexFile, import.meta.url));
    const html = await readFile(indexPath, 'utf8');
    const transformedHtml = await app.server.transformIndexHtml(request.url ?? app.base, html);
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/html');
    response.end(transformedHtml);
  } catch (error) {
    app.server.ssrFixStacktrace(error);
    console.error(error);
    response.statusCode = 500;
    response.end();
  }
}

function shouldServeIndex(url) {
  if (!url) return true;
  const pathname = new URL(url, 'http://localstudio.invalid').pathname;
  const filename = pathname.split('/').at(-1) ?? '';
  return (
    !filename.includes('.') &&
    !pathname.startsWith('/__localstudio/') &&
    !pathname.includes('/@') &&
    !pathname.includes('/src/') &&
    !pathname.includes('/node_modules/')
  );
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all(viteServers.map((app) => app.server.close()));
  httpServer.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));
