export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-NEXO-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('O servidor local não respondeu como esperado.', response.status);
  }
  if (!response.ok)
    throw new ApiError(data.error || 'Não foi possível concluir a operação.', response.status);
  return data as T;
}

const launchUrl = new URL(window.location.href);
const launchKey = launchUrl.searchParams.get('nexo_key') || '';
if (launchKey) {
  launchUrl.searchParams.delete('nexo_key');
  window.history.replaceState(null, '', launchUrl.pathname + launchUrl.search + launchUrl.hash);
}
let sessionPromise: Promise<import('./types').Session> | null = null;
async function session() {
  if (!sessionPromise)
    sessionPromise = (async () => {
      const response = await fetch('/api/session', {
        headers: { 'X-NEXO-Key': launchKey },
        credentials: 'same-origin',
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new ApiError(data.error || 'Abra o NEXO pelo atalho do menu.', response.status);
      return data as import('./types').Session;
    })().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  return sessionPromise;
}

export const api = {
  session,
  system: () => request<import('./types').SystemInfo>('/api/system'),
  capabilities: () => request<import('./types').Capabilities>('/api/capabilities'),
  notes: (q = '') =>
    request<{ notes: import('./types').Note[] }>(`/api/notes?q=${encodeURIComponent(q)}`),
  createNote: (data: Partial<import('./types').Note>) =>
    request<{ note: import('./types').Note }>('/api/notes', 'POST', data),
  updateNote: (id: string, data: Partial<import('./types').Note>) =>
    request<{ note: import('./types').Note }>(`/api/notes/${id}`, 'PATCH', data),
  deleteNote: (id: string) => request<{ ok: boolean }>(`/api/notes/${id}`, 'DELETE'),
  clips: (q = '') =>
    request<{ clips: import('./types').Clip[]; status: import('./types').ClipboardStatus }>(
      `/api/clips?q=${encodeURIComponent(q)}`,
    ),
  addClip: (text: string) =>
    request<{ clip: import('./types').Clip }>('/api/clips', 'POST', { text }),
  pinClip: (id: string, pinned: boolean) =>
    request<{ ok: boolean }>(`/api/clips/${id}`, 'PATCH', { pinned }),
  deleteClip: (id: string) => request<{ ok: boolean }>(`/api/clips/${id}`, 'DELETE'),
  clearClips: () => request<{ ok: boolean }>('/api/clips', 'DELETE'),
  copyNative: (text: string) =>
    request<{ copied: boolean; message: string }>('/api/clipboard/copy', 'POST', { text }),
  setClipboard: (enabled: boolean) =>
    request<{ status: import('./types').ClipboardStatus }>('/api/settings', 'PATCH', {
      clipboardEnabled: enabled,
    }),
  packages: (q = '') =>
    request<{
      available: boolean;
      packages: import('./types').Package[];
      total: number;
      message: string;
    }>(`/api/packages?q=${encodeURIComponent(q)}`),
  command: (action: string, pkg = '') =>
    request<import('./types').CommandResult>('/api/commands', 'POST', { action, package: pkg }),
  export: () =>
    request<{
      app: string;
      version: number;
      notes: import('./types').Note[];
      clips: import('./types').Clip[];
    }>('/api/export'),
};

export function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<'native' | 'browser'> {
  try {
    const result = await api.copyNative(text);
    if (result.copied) return 'native';
  } catch {
    /* Browser fallback below. */
  }
  if (!navigator.clipboard?.writeText)
    throw new Error(
      'A cópia não está disponível neste contexto. Selecione o texto e copie manualmente.',
    );
  await navigator.clipboard.writeText(text);
  return 'browser';
}
