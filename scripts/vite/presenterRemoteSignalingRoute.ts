import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect } from 'vite';
import {
  presenterRemoteProtocol,
  type PresenterRemoteCommand,
} from '@localstudio/presenter-remote/protocol';
import {
  InMemoryPresenterRemoteSignalingService,
  type RegisterPresenterRemoteSessionInput,
} from '@localstudio/presenter-remote/signaling-service';
import type { PresenterRemoteIceCandidateMessage } from '@localstudio/presenter-remote/webrtc';

const presenterRemotePath = '/__localstudio/presenter-remote';
const signalingService = new InMemoryPresenterRemoteSignalingService();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
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
  return isRecord(value) && typeof value.presenterLabel === 'string' && typeof value.ttlMs === 'number';
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

function isIceCandidateMessage(value: unknown): value is PresenterRemoteIceCandidateMessage {
  return (
    isRecord(value) &&
    isIceCandidate(value.candidate) &&
    (value.target === 'controller' || value.target === 'presenter')
  );
}

function isCommandEnvelope(value: unknown): value is {
  command: PresenterRemoteCommand;
  controllerId: string;
} {
  return (
    isRecord(value) &&
    typeof value.controllerId === 'string' &&
    value.controllerId.length > 0 &&
    presenterRemoteProtocol.isCommand(value.command)
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

async function handleSessionsRoute(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'GET') {
    sendJson(res, 200, signalingService.listActiveSessions());
    return true;
  }
  if (req.method !== 'POST') return false;
  const payload = await readRequestJson(req);
  if (!isRegisterSessionInput(payload)) {
    sendJson(res, 400, { error: 'Invalid session registration payload.' });
    return true;
  }
  sendJson(res, 201, signalingService.registerSession(payload));
  return true;
}

function handleOffersRoute(req: IncomingMessage, res: ServerResponse, code: string) {
  if (req.method !== 'GET') return false;
  sendJson(res, 200, signalingService.takePendingOffers(code));
  return true;
}

async function handleStateRoute(req: IncomingMessage, res: ServerResponse, code: string) {
  if (req.method === 'GET') {
    sendJson(res, 200, signalingService.getPublishedState(code) ?? null);
    return true;
  }
  if (req.method !== 'PUT') return false;
  const payload = await readRequestJson(req);
  if (!presenterRemoteProtocol.isState(payload)) {
    sendJson(res, 400, { error: 'Invalid state payload.' });
    return true;
  }
  sendJson(res, signalingService.publishState(code, payload) ? 200 : 404, { ok: true });
  return true;
}

async function handleControllersRoute(req: IncomingMessage, res: ServerResponse, code: string) {
  if (req.method !== 'POST') return false;
  const payload = await readRequestJson(req);
  if (!isControllerConnectInput(payload)) {
    sendJson(res, 400, { error: 'Invalid controller payload.' });
    return true;
  }
  const session = signalingService.connectController(code, payload.controllerId);
  sendJson(res, session ? 200 : 404, session ?? null);
  return true;
}

async function handleControllerRoute(req: IncomingMessage, res: ServerResponse, route: {
  action: string;
  code: string;
  controllerId: string;
}) {
  if (route.action === 'offer' && req.method === 'POST') {
    const payload = await readRequestJson(req);
    if (!isOfferInput(payload)) {
      sendJson(res, 400, { error: 'Invalid offer payload.' });
      return true;
    }
    const result = signalingService.createControllerOffer({
      controllerId: route.controllerId,
      offerSdp: payload.offerSdp,
      sessionCode: route.code,
    });
    sendJson(res, result.status === 'pending' ? 200 : 403, { ok: result.status === 'pending' });
    return true;
  }
  if (route.action === 'answer' && req.method === 'POST') {
    const payload = await readRequestJson(req);
    if (!isAnswerInput(payload)) {
      sendJson(res, 400, { error: 'Invalid answer payload.' });
      return true;
    }
    sendJson(
      res,
      signalingService.publishAnswer(route.code, route.controllerId, payload.answerSdp) ? 200 : 404,
      { ok: true },
    );
    return true;
  }
  if (route.action === 'answer' && req.method === 'GET') {
    const answerSdp = signalingService.getAnswer(route.code, route.controllerId);
    sendJson(res, answerSdp ? 200 : 404, answerSdp ? { answerSdp } : null);
    return true;
  }
  if (route.action === 'ice' && req.method === 'POST') {
    const payload = await readRequestJson(req);
    if (!isIceCandidateMessage(payload)) {
      sendJson(res, 400, { error: 'Invalid ICE payload.' });
      return true;
    }
    sendJson(
      res,
      signalingService.publishIceCandidate(route.code, route.controllerId, payload) ? 200 : 404,
      { ok: true },
    );
    return true;
  }
  if (route.action === 'ice/controller' && req.method === 'GET') {
    sendJson(res, 200, signalingService.takeIceCandidates(route.code, route.controllerId, 'controller'));
    return true;
  }
  if (route.action === 'ice/presenter' && req.method === 'GET') {
    sendJson(res, 200, signalingService.takeIceCandidates(route.code, route.controllerId, 'presenter'));
    return true;
  }
  if (route.action === '' && req.method === 'DELETE') {
    sendJson(res, signalingService.closeController(route.code, route.controllerId) ? 200 : 404, { ok: true });
    return true;
  }
  return false;
}

async function handleCommandsRoute(req: IncomingMessage, res: ServerResponse, code: string) {
  if (req.method === 'GET') {
    sendJson(res, 200, signalingService.takeCommands(code));
    return true;
  }
  if (req.method !== 'POST') return false;
  const payload = await readRequestJson(req);
  if (!isCommandEnvelope(payload)) {
    sendJson(res, 400, { error: 'Invalid command payload.' });
    return true;
  }
  sendJson(
    res,
    signalingService.publishCommand(code, payload.command, payload.controllerId) ? 200 : 403,
    { ok: true },
  );
  return true;
}

function handleSessionRoute(req: IncomingMessage, res: ServerResponse, code: string) {
  if (req.method === 'GET') {
    const session = signalingService.lookupSession(code);
    sendJson(res, session ? 200 : 404, session ?? null);
    return true;
  }
  if (req.method === 'DELETE') {
    sendJson(res, signalingService.closeSession(code) ? 200 : 404, { ok: true });
    return true;
  }
  return false;
}

async function handlePresenterRemoteSignaling(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  if (!req.url?.startsWith(presenterRemotePath)) {
    next();
    return;
  }

  const requestUrl = new URL(req.url, 'http://localstudio.invalid');
  try {
    if (requestUrl.pathname === `${presenterRemotePath}/sessions`) {
      if (await handleSessionsRoute(req, res)) return;
    }

    const offersCode = getSessionCode(requestUrl.pathname, '/offers');
    if (offersCode && handleOffersRoute(req, res, offersCode)) return;

    const stateCode = getSessionCode(requestUrl.pathname, '/state');
    if (stateCode && await handleStateRoute(req, res, stateCode)) return;

    const controllersCode = getSessionCode(requestUrl.pathname, '/controllers');
    if (controllersCode && await handleControllersRoute(req, res, controllersCode)) return;

    const controllerRoute = getControllerRoute(requestUrl.pathname);
    if (controllerRoute && await handleControllerRoute(req, res, controllerRoute)) return;

    const commandsCode = getSessionCode(requestUrl.pathname, '/commands');
    if (commandsCode && await handleCommandsRoute(req, res, commandsCode)) return;

    const sessionCode = getSessionCode(requestUrl.pathname);
    if (sessionCode && handleSessionRoute(req, res, sessionCode)) return;

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
