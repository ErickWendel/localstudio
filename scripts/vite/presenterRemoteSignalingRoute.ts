import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import type {
  PresenterRemoteCommand,
  PresenterRemoteSession,
  PresenterRemoteState,
} from '@localstudio/presenter-remote/protocol';
import type { RegisterPresenterRemoteSessionInput } from '@localstudio/presenter-remote/signaling-service';
import type { PresenterRemoteControllerOffer } from '@localstudio/presenter-remote/webrtc';

const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
const codePattern = /^[A-HJ-NP-Z1-9]{4}-[A-HJ-NP-Z1-9]{4}$/;
const presenterRemotePath = '/__localstudio/presenter-remote';

interface StoredPresenterRemoteSession {
  commands: PresenterRemoteCommand[];
  controllers: Set<string>;
  publishedState?: PresenterRemoteState | undefined;
  session: PresenterRemoteSession;
  webRtcControllers: Map<string, StoredControllerConnection>;
}

interface StoredControllerConnection {
  answerSdp?: string | undefined;
  controllerIceCandidates: RTCIceCandidateInit[];
  offerSdp: string;
  presenterIceCandidates: RTCIceCandidateInit[];
}

const sessions = new Map<string, StoredPresenterRemoteSession>();

function normalizeCode(value: string) {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4, 8)}`;
}

function createCode() {
  let rawCode = '';
  for (let index = 0; index < 8; index += 1) {
    rawCode += codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)] ?? 'A';
  }
  return `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [code, storedSession] of sessions) {
    if (Date.parse(storedSession.session.expiresAt) <= now) sessions.delete(code);
  }
}

function registerSession(input: RegisterPresenterRemoteSessionInput) {
  pruneExpiredSessions();
  for (const [code, storedSession] of sessions) {
    if (storedSession.session.presenterLabel === input.presenterLabel) sessions.delete(code);
  }
  let code = createCode();
  while (sessions.has(code) || !codePattern.test(code)) code = createCode();
  const session: PresenterRemoteSession = {
    code,
    connectedControllerCount: 0,
    expiresAt: new Date(Date.now() + input.ttlMs).toISOString(),
    presenterLabel: input.presenterLabel,
    sessionId: createSessionId(),
  };
  sessions.set(code, { commands: [], controllers: new Set(), session, webRtcControllers: new Map() });
  return session;
}

function listActiveSessions() {
  pruneExpiredSessions();
  return Array.from(sessions.values(), ({ session }) => ({ ...session }));
}

function lookupSession(code: string) {
  pruneExpiredSessions();
  return sessions.get(normalizeCode(code))?.session;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPreviewElement(value: unknown) {
  if (!isRecord(value)) return false;
  const hasCommonFrame =
    typeof value.id === 'string' &&
    typeof value.x === 'number' &&
    typeof value.y === 'number' &&
    typeof value.width === 'number' &&
    typeof value.height === 'number' &&
    typeof value.rotation === 'number' &&
    typeof value.opacity === 'number';
  if (!hasCommonFrame || typeof value.kind !== 'string') return false;
  if (value.kind === 'text') {
    return (
      typeof value.text === 'string' &&
      typeof value.fontFamily === 'string' &&
      typeof value.fontSize === 'number' &&
      typeof value.fontWeight === 'number' &&
      typeof value.fill === 'string' &&
      (value.align === 'left' || value.align === 'center' || value.align === 'right')
    );
  }
  if (value.kind === 'image' || value.kind === 'media') {
    return value.assetUrl === undefined || typeof value.assetUrl === 'string';
  }
  if (value.kind === 'shape') return typeof value.shape === 'string';
  return false;
}

function isSlidePreview(value: unknown) {
  if (!isRecord(value)) return false;
  return (
    typeof value.backgroundColor === 'string' &&
    (value.backgroundImageUrl === undefined || typeof value.backgroundImageUrl === 'string') &&
    Array.isArray(value.elements) &&
    value.elements.every(isPreviewElement) &&
    typeof value.height === 'number' &&
    typeof value.width === 'number'
  );
}

function isCommand(value: unknown): value is PresenterRemoteCommand {
  if (!isRecord(value) || value.type !== 'command' || typeof value.command !== 'string') return false;
  if (
    value.command === 'close' ||
    value.command === 'next' ||
    value.command === 'pause-timer' ||
    value.command === 'previous' ||
    value.command === 'request-state' ||
    value.command === 'reset-timer' ||
    value.command === 'resume-timer' ||
    value.command === 'start-presenting'
  ) {
    return true;
  }
  if (value.command === 'go-to-page') return typeof value.pageId === 'string';
  if (value.command === 'update-notes') {
    return typeof value.pageId === 'string' && typeof value.notes === 'string';
  }
  return false;
}

function isState(value: unknown): value is PresenterRemoteState {
  if (!isRecord(value) || value.type !== 'state' || !isRecord(value.timer)) return false;
  return (
    typeof value.activePageId === 'string' &&
    typeof value.activePageIndex === 'number' &&
    (value.activePageName === undefined || typeof value.activePageName === 'string') &&
    typeof value.buildsRemaining === 'number' &&
    typeof value.connectedControllerCount === 'number' &&
    typeof value.deckName === 'string' &&
    (value.nextPageName === undefined || typeof value.nextPageName === 'string') &&
    (value.nextSlidePreview === undefined || isSlidePreview(value.nextSlidePreview)) &&
    typeof value.notes === 'string' &&
    typeof value.pageCount === 'number' &&
    (value.presenterMode === 'presenting' || value.presenterMode === 'ready') &&
    (value.slidePreview === undefined || isSlidePreview(value.slidePreview)) &&
    isStringArray(value.shortcuts) &&
    typeof value.timer.elapsedMs === 'number' &&
    typeof value.timer.paused === 'boolean'
  );
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readRequestJson(req: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Invalid JSON request payload.'));
      }
    });
  });
}

function isRegisterSessionInput(value: unknown): value is RegisterPresenterRemoteSessionInput {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.presenterLabel === 'string' && typeof record.ttlMs === 'number';
}

function isControllerConnectInput(value: unknown): value is { controllerId: string } {
  return isRecord(value) && typeof value.controllerId === 'string' && value.controllerId.length > 0;
}

function isOfferInput(value: unknown): value is { offerSdp: string } {
  return isRecord(value) && typeof value.offerSdp === 'string' && value.offerSdp.length > 0;
}

function isAnswerInput(value: unknown): value is { answerSdp: string } {
  return isRecord(value) && typeof value.answerSdp === 'string' && value.answerSdp.length > 0;
}

function isIceCandidate(value: unknown): value is RTCIceCandidateInit {
  return isRecord(value) && (typeof value.candidate === 'string' || value.candidate === undefined);
}

function isIceCandidateMessage(value: unknown): value is {
  candidate: RTCIceCandidateInit;
  target: 'controller' | 'presenter';
} {
  return (
    isRecord(value) &&
    isIceCandidate(value.candidate) &&
    (value.target === 'controller' || value.target === 'presenter')
  );
}

function getSessionCode(pathname: string, suffix = '') {
  const prefix = `${presenterRemotePath}/sessions/`;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return undefined;
  return decodeURIComponent(pathname.slice(prefix.length, suffix ? -suffix.length : undefined));
}

function getControllerRoute(pathname: string) {
  const prefix = `${presenterRemotePath}/sessions/`;
  if (!pathname.startsWith(prefix)) return undefined;
  const parts = pathname.slice(prefix.length).split('/');
  if (parts.length < 3 || parts[1] !== 'controllers') return undefined;
  return {
    action: parts.slice(3).join('/'),
    code: decodeURIComponent(parts[0] ?? ''),
    controllerId: decodeURIComponent(parts[2] ?? ''),
  };
}

async function handlePresenterRemoteSignaling(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  if (!req.url?.startsWith(presenterRemotePath)) {
    next();
    return;
  }

  const requestUrl = new URL(req.url, 'http://localstudio.invalid');
  try {
    if (requestUrl.pathname === `${presenterRemotePath}/sessions` && req.method === 'GET') {
      sendJson(res, 200, listActiveSessions());
      return;
    }

    if (requestUrl.pathname === `${presenterRemotePath}/sessions` && req.method === 'POST') {
      const payload = await readRequestJson(req);
      if (!isRegisterSessionInput(payload)) {
        sendJson(res, 400, { error: 'Invalid session registration payload.' });
        return;
      }
      sendJson(res, 201, registerSession(payload));
      return;
    }

    const offersCode = getSessionCode(requestUrl.pathname, '/offers');
    if (offersCode && req.method === 'GET') {
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(offersCode));
      const offers: PresenterRemoteControllerOffer[] = storedSession
        ? Array.from(storedSession.webRtcControllers.entries())
            .filter(([, connection]) => connection.answerSdp === undefined)
            .map(([controllerId, connection]) => ({ controllerId, offerSdp: connection.offerSdp }))
        : [];
      sendJson(res, 200, offers);
      return;
    }

    const stateCode = getSessionCode(requestUrl.pathname, '/state');
    if (stateCode && req.method === 'GET') {
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(stateCode));
      const publishedState = storedSession?.publishedState;
      sendJson(
        res,
        200,
        publishedState && storedSession
          ? {
              ...publishedState,
              connectedControllerCount: storedSession.session.connectedControllerCount,
            }
          : null,
      );
      return;
    }
    if (stateCode && req.method === 'PUT') {
      const payload = await readRequestJson(req);
      if (!isState(payload)) {
        sendJson(res, 400, { error: 'Invalid state payload.' });
        return;
      }
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(stateCode));
      if (!storedSession) {
        sendJson(res, 404, { ok: false });
        return;
      }
      storedSession.publishedState = {
        ...payload,
        connectedControllerCount: storedSession.session.connectedControllerCount,
      };
      sendJson(res, 200, { ok: true });
      return;
    }

    const controllersCode = getSessionCode(requestUrl.pathname, '/controllers');
    if (controllersCode && req.method === 'POST') {
      const payload = await readRequestJson(req);
      if (!isControllerConnectInput(payload)) {
        sendJson(res, 400, { error: 'Invalid controller payload.' });
        return;
      }
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(controllersCode));
      if (!storedSession) {
        sendJson(res, 404, null);
        return;
      }
      storedSession.controllers.add(payload.controllerId);
      storedSession.session.connectedControllerCount = storedSession.controllers.size;
      sendJson(res, 200, storedSession.session);
      return;
    }

    const controllerRoute = getControllerRoute(requestUrl.pathname);
    if (controllerRoute) {
      const code = normalizeCode(controllerRoute.code);
      pruneExpiredSessions();
      const storedSession = sessions.get(code);
      if (!storedSession) {
        sendJson(res, 404, { ok: false });
        return;
      }
      if (controllerRoute.action === 'offer' && req.method === 'POST') {
        const payload = await readRequestJson(req);
        if (!isOfferInput(payload)) {
          sendJson(res, 400, { error: 'Invalid offer payload.' });
          return;
        }
        storedSession.webRtcControllers.set(controllerRoute.controllerId, {
          controllerIceCandidates: [],
          offerSdp: payload.offerSdp,
          presenterIceCandidates: [],
        });
        sendJson(res, 200, { ok: true });
        return;
      }
      const connection = storedSession.webRtcControllers.get(controllerRoute.controllerId);
      if (!connection) {
        sendJson(res, 404, { ok: false });
        return;
      }
      if (controllerRoute.action === 'answer' && req.method === 'POST') {
        const payload = await readRequestJson(req);
        if (!isAnswerInput(payload)) {
          sendJson(res, 400, { error: 'Invalid answer payload.' });
          return;
        }
        connection.answerSdp = payload.answerSdp;
        sendJson(res, 200, { ok: true });
        return;
      }
      if (controllerRoute.action === 'answer' && req.method === 'GET') {
        sendJson(res, connection.answerSdp ? 200 : 404, connection.answerSdp ? { answerSdp: connection.answerSdp } : null);
        return;
      }
      if (controllerRoute.action === 'ice' && req.method === 'POST') {
        const payload = await readRequestJson(req);
        if (!isIceCandidateMessage(payload)) {
          sendJson(res, 400, { error: 'Invalid ICE payload.' });
          return;
        }
        if (payload.target === 'presenter') connection.controllerIceCandidates.push(payload.candidate);
        else connection.presenterIceCandidates.push(payload.candidate);
        sendJson(res, 200, { ok: true });
        return;
      }
      if (controllerRoute.action === 'ice/controller' && req.method === 'GET') {
        const candidates = connection.presenterIceCandidates;
        connection.presenterIceCandidates = [];
        sendJson(res, 200, candidates);
        return;
      }
      if (controllerRoute.action === 'ice/presenter' && req.method === 'GET') {
        const candidates = connection.controllerIceCandidates;
        connection.controllerIceCandidates = [];
        sendJson(res, 200, candidates);
        return;
      }
      if (controllerRoute.action === '' && req.method === 'DELETE') {
        storedSession.webRtcControllers.delete(controllerRoute.controllerId);
        storedSession.controllers.delete(controllerRoute.controllerId);
        storedSession.session.connectedControllerCount = storedSession.controllers.size;
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    const commandsCode = getSessionCode(requestUrl.pathname, '/commands');
    if (commandsCode && req.method === 'GET') {
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(commandsCode));
      if (!storedSession) {
        sendJson(res, 200, []);
        return;
      }
      const commands = storedSession.commands;
      storedSession.commands = [];
      sendJson(res, 200, commands);
      return;
    }
    if (commandsCode && req.method === 'POST') {
      const payload = await readRequestJson(req);
      if (!isCommand(payload)) {
        sendJson(res, 400, { error: 'Invalid command payload.' });
        return;
      }
      pruneExpiredSessions();
      const storedSession = sessions.get(normalizeCode(commandsCode));
      if (!storedSession) {
        sendJson(res, 404, { ok: false });
        return;
      }
      storedSession.commands.push(payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    const sessionCode = getSessionCode(requestUrl.pathname);
    if (sessionCode && req.method === 'GET') {
      const session = lookupSession(sessionCode);
      sendJson(res, session ? 200 : 404, session ?? null);
      return;
    }
    if (sessionCode && req.method === 'DELETE') {
      sendJson(res, sessions.delete(normalizeCode(sessionCode)) ? 200 : 404, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Presenter remote signaling route not found.' });
  } catch (error) {
    next(error);
  }
}

function presenterRemoteSignalingMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  void handlePresenterRemoteSignaling(req, res, next);
}

export function presenterRemoteSignalingRoute() {
  return {
    name: 'presenter-remote-signaling-route',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(presenterRemoteSignalingMiddleware);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(presenterRemoteSignalingMiddleware);
    },
  };
}
