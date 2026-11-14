import type {
  Capabilities,
  CommandResult,
  PackageInfo,
  PacmanInsights,
  Session,
  SystemInfo,
} from './types';

const bootstrapKey = new URLSearchParams(window.location.search).get('nexo_key') || '';
const bootstrapHeaders: Record<string, string> = bootstrapKey ? { 'X-NEXO-Key': bootstrapKey } : {};
if (bootstrapKey) {
  const url = new URL(window.location.href);
  url.searchParams.delete('nexo_key');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}
let sessionReady = false;
let sessionRequest: Promise<Session> | null = null;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'X-NEXO-Request': '1',
      ...bootstrapHeaders,
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data as T;
}
export async function ensureSession(): Promise<Session> {
  if (sessionReady)
    return { app: 'NEXO', version: '', preview: false, focus: 'system-pacman', tokenReady: true };
  if (!sessionRequest) {
    sessionRequest = request<Session>('/api/session')
      .then((session) => {
        sessionReady = true;
        return session;
      })
      .catch((error) => {
        sessionRequest = null;
        throw error;
      });
  }
  return sessionRequest;
}
async function get<T>(path: string): Promise<T> {
  await ensureSession();
  return request<T>(path);
}
export const api = {
  session: () => get<Session>('/api/session'),
  system: () => get<SystemInfo>('/api/system'),
  capabilities: () => get<Capabilities>('/api/capabilities'),
  packages: (q: string) =>
    get<{
      available: boolean;
      packages: import('./types').Package[];
      total: number;
      message: string;
    }>(`/api/packages?q=${encodeURIComponent(q)}`),
  pacmanInsights: () => get<PacmanInsights>('/api/pacman/insights'),
  pacmanPackage: (name: string) =>
    get<PackageInfo>(`/api/pacman/package?name=${encodeURIComponent(name)}`),
  command: async (action: string, packageName = '') => {
    await ensureSession();
    return request<CommandResult>('/api/commands', {
      method: 'POST',
      body: JSON.stringify({ action, package: packageName }),
    });
  },
  snapshotExport: () => get<Record<string, unknown>>('/api/export'),
  copyText: async (text: string): Promise<'clipboard' | 'manual'> => {
    try {
      if (!navigator.clipboard?.writeText) return 'manual';
      await navigator.clipboard.writeText(text);
      return 'clipboard';
    } catch {
      return 'manual';
    }
  },
};
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
