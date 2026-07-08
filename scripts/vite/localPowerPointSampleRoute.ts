import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { basename, dirname, join, resolve } from 'node:path';
import type { Connect } from 'vite';

const localPowerPointSampleConfig = {
  fileName: 'fullstack-monitoring-jsnation-11062026.pptx',
  path:
    process.env.LOCALSTUDIO_E2E_PPTX_SAMPLE_PATH ??
    resolve(process.cwd(), 'tests/e2e/fixtures/pptx/fullstack-monitoring-jsnation-11062026.pptx'),
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

    const sampleFiles = await getLocalPowerPointSampleFiles();
    if (sampleFiles.length === 0) {
      res.statusCode = 404;
      res.end('Sample file not found.');
      return;
    }

    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    res.setHeader('content-length', String(getTotalSize(sampleFiles)));
    res.setHeader('content-disposition', `inline; filename="${localPowerPointSampleConfig.fileName}"`);
    await pipeFiles(sampleFiles.map((file) => file.path), res);
  })().catch(next);
}

async function getLocalPowerPointSampleFiles() {
  const fileStat = await stat(localPowerPointSampleConfig.path).catch(() => undefined);
  if (fileStat?.isFile()) {
    return [{ path: localPowerPointSampleConfig.path, size: fileStat.size }];
  }

  const partPrefix = `${basename(localPowerPointSampleConfig.path)}.part-`;
  const partDirectory = dirname(localPowerPointSampleConfig.path);
  const entries = await readdir(partDirectory).catch(() => []);
  const partNames = entries.filter((entry) => entry.startsWith(partPrefix)).sort();
  const files = await Promise.all(
    partNames.map(async (partName) => {
      const partPath = join(partDirectory, partName);
      const partStat = await stat(partPath);
      return { path: partPath, size: partStat.size };
    }),
  );
  return files.filter((file) => file.size > 0);
}

function getTotalSize(files: Array<{ size: number }>) {
  return files.reduce((total, file) => total + file.size, 0);
}

async function pipeFiles(filePaths: string[], res: ServerResponse) {
  for (const filePath of filePaths) {
    await new Promise<void>((resolvePipe, reject) => {
      const stream = createReadStream(filePath);
      stream.on('error', reject);
      stream.on('end', resolvePipe);
      stream.pipe(res, { end: false });
    });
  }
  res.end();
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
