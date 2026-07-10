import type { Peer } from 'peerjs';

function waitForPeerId(peer: Peer) {
  if (peer.open && peer.id) return Promise.resolve(peer.id);
  return new Promise<string>((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', reject);
  });
}

function waitForPeer(peer: Peer) {
  if (peer.open) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', reject);
  });
}

function rejectAfter(timeoutMs: number, message: string) {
  return new Promise<never>((_, reject) => {
    globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
}

export const presenterRemotePeerOpen = {
  rejectAfter,
  waitForPeer,
  waitForPeerId,
} as const;
