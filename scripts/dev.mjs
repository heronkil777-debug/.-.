import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
const preview = process.argv.includes('--preview');
const bootstrapKey = randomBytes(32).toString('base64url');
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(code), 350).unref();
}
function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
  return child;
}
start(
  'python3',
  [
    'backend/server.py',
    '--host',
    '127.0.0.1',
    '--port',
    process.env.NEXO_API_PORT || '8765',
    ...(preview ? ['--preview'] : []),
  ],
  {
    NEXO_BOOTSTRAP_KEY: bootstrapKey,
  },
);
start(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    preview ? '0.0.0.0' : '127.0.0.1',
    ...process.argv.slice(2).filter((arg) => arg !== '--preview'),
  ],
  {
    // The local Vite proxy is trusted; the public preview is enabled only explicitly.
    NEXO_PREVIEW_PROXY_KEY: bootstrapKey,
  },
);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
