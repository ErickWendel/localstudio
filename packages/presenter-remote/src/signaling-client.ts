import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
  type PresenterRemoteSession,
  type PresenterRemoteState,
} from './protocol';
import type { RegisterPresenterRemoteSessionInput } from './signaling-service';

export interface PresenterRemoteSignalingClientOptions {
  endpoint: string;
  fetcher?: typeof fetch | undefined;
}

async function readJson(response: Response) {
  if (!response.ok) throw new Error(`Signaling request failed with ${response.status}`);
  return response.json() as Promise<unknown>;
}

export class PresenterRemoteSignalingClient {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(options: PresenterRemoteSignalingClientOptions) {
    this.endpoint = resolveEndpoint(options.endpoint);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  async listSessions(): Promise<PresenterRemoteSession[]> {
    const value = await readJson(await this.fetcher(`${this.endpoint}/sessions`));
    if (!Array.isArray(value)) return [];
    return value.filter(presenterRemoteProtocol.isSession);
  }

  async lookupSession(code: string): Promise<PresenterRemoteSession | undefined> {
    const response = await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}`);
    if (response.status === 404) return undefined;
    const value = await readJson(response);
    return presenterRemoteProtocol.isSession(value) ? value : undefined;
  }

  async registerSession(input: RegisterPresenterRemoteSessionInput): Promise<PresenterRemoteSession> {
    const value = await readJson(
      await this.fetcher(`${this.endpoint}/sessions`, {
        body: JSON.stringify(input),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
    if (!presenterRemoteProtocol.isSession(value)) throw new Error('Signaling response was not a session.');
    return value;
  }

  async publishState(code: string, state: PresenterRemoteState) {
    await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}/state`, {
        body: JSON.stringify(state),
        headers: { 'content-type': 'application/json' },
        method: 'PUT',
      }),
    );
  }

  async getPublishedState(code: string): Promise<PresenterRemoteState | undefined> {
    const value = await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}/state`),
    );
    return presenterRemoteProtocol.isState(value) ? value : undefined;
  }

  async connectController(code: string, controllerId: string) {
    const value = await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}/controllers`, {
        body: JSON.stringify({ controllerId }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
    return presenterRemoteProtocol.isSession(value) ? value : undefined;
  }

  async publishCommand(code: string, command: PresenterRemoteCommand) {
    await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}/commands`, {
        body: JSON.stringify(command),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
    );
  }

  async takeCommands(code: string): Promise<PresenterRemoteCommand[]> {
    const value = await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}/commands`),
    );
    if (!Array.isArray(value)) return [];
    return value.filter(presenterRemoteProtocol.isCommand);
  }

  async closeSession(code: string) {
    await readJson(
      await this.fetcher(`${this.endpoint}/sessions/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      }),
    );
  }
}

function resolveEndpoint(endpoint: string) {
  const baseOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  return new URL(endpoint, baseOrigin).toString().replace(/\/+$/, '');
}
