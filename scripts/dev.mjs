import { spawn } from 'node:child_process';

const apps = [
  { name: 'landing', port: '4173', workspace: '@localstudio/landing' },
  { name: 'editor', port: '4174', workspace: '@localstudio/editor' },
  { name: 'joystick', port: '4175', workspace: '@localstudio/joystick' },
];

const children = apps.map((app) => {
  const child = spawn(
    'npm',
    ['run', 'dev', '--workspace', app.workspace, '--', '--port', app.port, '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

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
