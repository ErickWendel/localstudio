import { createReadStream } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { localStudioAppRoutes } from '@localstudio/app-routes';

const host = process.env.HOST ?? '0.0.0.0';
const port = getPort();
const root = resolve(process.cwd(), process.env.DIST_DIR ?? 'dist');
const docsEntryPath = localStudioAppRoutes.docs.gettingStartedAnchor;
const localPowerPointSampleConfig = {
  fileName: 'fullstack-monitoring-jsnation-11062026.pptx',
  path:
    process.env.LOCALSTUDIO_E2E_PPTX_SAMPLE_PATH ??
    resolve(process.cwd(), 'tests/e2e/fixtures/pptx/fullstack-monitoring-jsnation-11062026.pptx'),
  route: '/__localstudio/pptx-sample',
};
const server = createServer((request, response) => {
  void handleRequest(request.url, response);
});

server.listen(port, host, () => {
  const actualPort = getListeningPort();
  console.log('LocalStudio static server ready on one origin:');
  console.log(`  Local:   http://localhost:${actualPort}/`);
  console.log('');
  console.log('Routes:');
  console.log('  /');
  console.log('  /editor/');
  console.log('  /joystick/');
  console.log('  /docs/');
});

async function handleRequest(rawUrl, response) {
  const url = new URL(rawUrl ?? '/', 'http://localstudio.invalid');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === `${localPowerPointSampleConfig.route}/file`) {
    await serveLocalPowerPointSample(response);
    return;
  }
  if (pathname === '/__localstudio/network-origin') {
    serveLocalNetworkOrigin(response);
    return;
  }
  if (pathname === '/docs' || pathname === '/docs/') {
    serveRedirect(response, docsEntryPath);
    return;
  }

  const filePath = await resolveFilePath(pathname);
  if (!filePath) {
    response.statusCode = 404;
    response.end();
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', getContentType(filePath));
  if (extname(filePath) === '.html') {
    response.end(injectRuntimeConfig(await readFile(filePath, 'utf8')));
    return;
  }
  createReadStream(filePath).pipe(response);
}

async function serveLocalPowerPointSample(response) {
  const sampleFiles = await getLocalPowerPointSampleFiles();
  if (sampleFiles.length === 0) {
    response.statusCode = 404;
    response.end(`Sample PowerPoint not found: ${localPowerPointSampleConfig.path}`);
    return;
  }

  response.statusCode = 200;
  response.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );
  response.setHeader('Content-Length', String(getTotalSize(sampleFiles)));
  response.setHeader(
    'Content-Disposition',
    `inline; filename="${localPowerPointSampleConfig.fileName}"`,
  );
  await pipeFiles(
    sampleFiles.map((file) => file.path),
    response,
  );
}

async function getLocalPowerPointSampleFiles() {
  const fileStat = await stat(localPowerPointSampleConfig.path).catch(() => undefined);
  if (fileStat?.isFile()) {
    return [{ path: localPowerPointSampleConfig.path, size: fileStat.size }];
  }

  const partPrefix = `${basename(localPowerPointSampleConfig.path)}.part-`;
  const partDirectory = dirname(localPowerPointSampleConfig.path);
  const entries = await readdir(partDirectory).catch(() => []);
  const partNames = entries.filter((entry) => entry.startsWith(partPrefix)).sort();
  const files = await Promise.all(
    partNames.map(async (partName) => {
      const partPath = join(partDirectory, partName);
      const partStat = await stat(partPath);
      return { path: partPath, size: partStat.size };
    }),
  );
  return files.filter((file) => file.size > 0);
}

function getTotalSize(files) {
  return files.reduce((total, file) => total + file.size, 0);
}

async function pipeFiles(filePaths, response) {
  for (const filePath of filePaths) {
    await new Promise((resolvePipe, reject) => {
      const stream = createReadStream(filePath);
      stream.on('error', reject);
      stream.on('end', resolvePipe);
      stream.pipe(response, { end: false });
    });
  }
  response.end();
}

async function resolveFilePath(pathname) {
  const staticPath = safeJoin(root, pathname === '/' ? '/index.html' : pathname);
  if (staticPath && (await isFile(staticPath))) return staticPath;

  if (shouldServeIndex(pathname)) {
    if (pathname.startsWith('/editor/')) return safeJoin(root, '/editor/index.html');
    if (pathname.startsWith('/joystick/')) return safeJoin(root, '/joystick/index.html');
    if (pathname.startsWith('/docs/')) return resolveDocsHtml(pathname);
    if (pathname.startsWith('/webmcp/') || pathname === '/webmcp') {
      return safeJoin(root, '/webmcp/index.html');
    }
    return safeJoin(root, '/index.html');
  }

  return undefined;
}

function serveRedirect(response, location) {
  response.statusCode = 302;
  response.setHeader('Location', location);
  response.end();
}

async function resolveDocsHtml(pathname) {
  const docsPath = pathname === '/docs/' ? '/docs/index.html' : `${pathname}.html`;
  const docsFile = safeJoin(root, docsPath);
  if (docsFile && (await isFile(docsFile))) return docsFile;

  const nestedIndexPath = pathname.endsWith('/') ? `${pathname}index.html` : `${pathname}/index.html`;
  const nestedIndexFile = safeJoin(root, nestedIndexPath);
  if (nestedIndexFile && (await isFile(nestedIndexFile))) return nestedIndexFile;

  return safeJoin(root, '/docs/index.html');
}

function shouldServeIndex(pathname) {
  const filename = pathname.split('/').at(-1) ?? '';
  return !filename.includes('.') && !pathname.startsWith('/__localstudio/');
}

function serveLocalNetworkOrigin(response) {
  const address = getLocalIpv4Address();
  if (!address) {
    response.statusCode = 404;
    response.end('Local network address not found.');
    return;
  }
  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify({ origin: `http://${address}:${getListeningPort()}` }));
}

function injectRuntimeConfig(html) {
  const script = getRuntimeConfigScript();
  if (!script) return html;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`;
}

function getRuntimeConfigScript() {
  const peerPort = Number.parseInt(process.env.LOCALSTUDIO_PEERJS_PORT ?? '', 10);
  if (!Number.isInteger(peerPort) || peerPort <= 0) return '';
  const options = {
    host: process.env.LOCALSTUDIO_PEERJS_HOST ?? '127.0.0.1',
    path: process.env.LOCALSTUDIO_PEERJS_PATH ?? '/peerjs',
    port: peerPort,
    secure: process.env.LOCALSTUDIO_PEERJS_SECURE === '1',
  };
  return `<script>globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__=${JSON.stringify(options)};</script>`;
}

function isPrivateIpv4(address) {
  const octets = address.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const first = octets[0];
  const second = octets[1];
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function getLocalIpv4Address() {
  const addresses = Object.values(networkInterfaces())
    .flatMap((networkInterface) => networkInterface ?? [])
    .filter((address) => address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
  return addresses.find(isPrivateIpv4) ?? addresses[0] ?? '127.0.0.1';
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function safeJoin(base, pathname) {
  const normalizedPath = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const candidate = resolve(base, `.${sep}${normalizedPath}`);
  return candidate.startsWith(`${base}${sep}`) || candidate === base ? candidate : undefined;
}

function getContentType(path) {
  const extension = extname(path);
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.json') return 'application/json; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.wasm') return 'application/wasm';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function getPort() {
  const rawPort = process.env.PORT ?? '4173';
  const parsedPort = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  return parsedPort;
}

function getListeningPort() {
  const address = server.address();
  if (!address || typeof address === 'string') return port;
  return address.port;
}

function shutdown(code = 0) {
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
