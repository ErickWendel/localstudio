import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, normalize, resolve, sep } from 'node:path';

const host = process.env.HOST ?? '0.0.0.0';
const port = getPort();
const root = resolve(process.cwd(), process.env.DIST_DIR ?? 'dist');
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
});

async function handleRequest(rawUrl, response) {
  const url = new URL(rawUrl ?? '/', 'http://localstudio.invalid');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/__localstudio/network-origin') {
    serveLocalNetworkOrigin(response);
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

async function resolveFilePath(pathname) {
  const staticPath = safeJoin(root, pathname === '/' ? '/index.html' : pathname);
  if (staticPath && (await isFile(staticPath))) return staticPath;

  if (shouldServeIndex(pathname)) {
    if (pathname.startsWith('/editor/')) return safeJoin(root, '/editor/index.html');
    if (pathname.startsWith('/joystick/')) return safeJoin(root, '/joystick/index.html');
    if (pathname.startsWith('/webmcp/') || pathname === '/webmcp') {
      return safeJoin(root, '/webmcp/index.html');
    }
    return safeJoin(root, '/index.html');
  }

  return undefined;
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
