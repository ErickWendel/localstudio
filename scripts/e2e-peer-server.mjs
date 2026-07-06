import { PeerServer } from 'peer';

const host = process.env.HOST ?? '127.0.0.1';
const path = process.env.PEERJS_PATH ?? '/peerjs';
const port = getPort();

PeerServer({
  host,
  path,
  port,
});

console.log(`LocalStudio E2E PeerJS server ready:`);
console.log(`  Local:   http://${host}:${port}${path}/`);

function getPort() {
  const rawPort = process.env.PORT;
  const parsedPort = Number.parseInt(rawPort ?? '', 10);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0 || parsedPort > 65_535) {
    throw new Error(`Invalid PORT value: ${rawPort ?? ''}`);
  }
  return parsedPort;
}
