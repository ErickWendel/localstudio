import type { PeerOptions } from 'peerjs';

type RuntimePeerOptions = Pick<PeerOptions, 'host' | 'path' | 'port' | 'secure'>;

declare global {
  var __LOCALSTUDIO_PEERJS_OPTIONS__: RuntimePeerOptions | undefined;
}

export function getRuntimePeerOptions(): PeerOptions | undefined {
  const options = globalThis.__LOCALSTUDIO_PEERJS_OPTIONS__;
  if (!options?.host || !options.port) return undefined;
  const peerOptions: PeerOptions = {
    host: options.host,
    port: options.port,
  };
  if (options.path) peerOptions.path = options.path;
  if (options.secure !== undefined) peerOptions.secure = options.secure;
  return peerOptions;
}
