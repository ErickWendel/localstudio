export interface IsolatedDevServer {
  baseURL: string;
  port: number;
  stop: () => Promise<void>;
}

export interface IsolatedPeerServer {
  path: string;
  port: number;
  stop: () => Promise<void>;
}

export interface ReadyServerAddress {
  baseURL: string;
  port: number;
}
