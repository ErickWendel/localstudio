import { networkInterfaces } from 'node:os';
import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';

const localNetworkOriginPath = '/__localstudio/network-origin';

function isPrivateIpv4(address: string) {
  const octets = address.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const first = octets[0];
  const second = octets[1];
  if (first === undefined || second === undefined) return false;
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
  return addresses.find(isPrivateIpv4) ?? addresses[0];
}

function getRequestPort(req: Connect.IncomingMessage) {
  const host = req.headers.host;
  if (!host) return '';
  const lastColonIndex = host.lastIndexOf(':');
  if (lastColonIndex < 0) return '';
  return host.slice(lastColonIndex);
}

function handleLocalNetworkOrigin(req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  if (!req.url?.startsWith(localNetworkOriginPath)) {
    next();
    return;
  }
  const address = getLocalIpv4Address();
  if (!address) {
    res.statusCode = 404;
    res.end('Local network address not found.');
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ origin: `http://${address}${getRequestPort(req)}` }));
}

export function localNetworkOriginRoute() {
  return {
    name: 'local-network-origin-route',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handleLocalNetworkOrigin);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handleLocalNetworkOrigin);
    },
  };
}
