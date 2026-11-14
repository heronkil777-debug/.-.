import { defineConfig, devices } from '@playwright/test';
import serverlessChromium, { inflate } from '@sparticuz/chromium';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The bundled AL2023 NSS/NSPR libraries also make the browser work on this Debian sandbox.
// Everything comes from npm; no browser CDN or system-package installation is needed.
const packageDir = dirname(fileURLToPath(import.meta.resolve('@sparticuz/chromium')));
await inflate(join(packageDir, '..', 'bin', 'al2023.tar.br'));
process.env.LD_LIBRARY_PATH = `${join('/tmp', 'al2023', 'lib')}:${process.env.LD_LIBRARY_PATH ?? ''}`;
serverlessChromium.setGraphicsMode = false;
const executablePath = await serverlessChromium.executablePath();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 7000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: serverlessChromium.args.filter(
        (arg) => !['--disable-web-security', '--single-process'].includes(arg),
      ),
      env: { ...process.env },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command: 'NEXO_API_PORT=8766 npm run dev -- --preview --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
