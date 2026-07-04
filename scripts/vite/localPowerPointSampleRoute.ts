import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import type { Connect } from 'vite';

const localPowerPointSampleConfig = {
  fileName: 'fullstack-monitoring-jsnation-11062026.pptx',
  path: '/Users/erickwendel/Downloads/fullstack-monitoring-jsnation-11062026.pptx',
  route: '/__localstudio/pptx-sample',
};

function handleLocalPowerPointSample(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
) {
  void (async () => {
    if (!req.url?.startsWith(localPowerPointSampleConfig.route)) {
      next();
      return;
    }

    const requestUrl = new URL(req.url, 'http://localstudio.invalid');
    if (requestUrl.pathname !== `${localPowerPointSampleConfig.route}/file`) {
      next();
      return;
    }

    const fileStat = await stat(localPowerPointSampleConfig.path).catch(() => undefined);
    if (!fileStat?.isFile()) {
      res.statusCode = 404;
      res.end('Sample file not found.');
      return;
    }

    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader('content-length', String(fileStat.size));
    res.setHeader('content-disposition', `inline; filename="${localPowerPointSampleConfig.fileName}"`);
    createReadStream(localPowerPointSampleConfig.path).pipe(res);
  })().catch(next);
}

export function localPowerPointSampleRoute() {
  return {
    name: 'local-powerpoint-sample-route',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handleLocalPowerPointSample);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use(handleLocalPowerPointSample);
    },
  };
}
