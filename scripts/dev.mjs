import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apps = [
  { name: 'landing', path: '../apps/landing', port: '4173' },
  { name: 'editor', path: '../apps/editor', port: '4174' },
  { name: 'joystick', path: '../apps/joystick', port: '4175' },
];

const children = apps.map((app) => {
  const child = spawn('vite', ['--host', '0.0.0.0', '--port', app.port, '--strictPort'], {
    cwd: fileURLToPath(new URL(app.path, import.meta.url)),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(prefixLines(app.name, chunk));
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(prefixLines(app.name, chunk));
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${app.name}] exited with ${signal ?? code}`);
    shutdown(code ?? 1);
  });

  return child;
});

let shuttingDown = false;

function prefixLines(name, chunk) {
  return chunk
    .toString()
    .split(/\n/)
    .map((line, index, lines) => {
      if (index === lines.length - 1 && line === '') return '';
      return `[${name}] ${line}`;
    })
    .join('\n');
}

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 250).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
