export type Page = 'overview' | 'notes' | 'clipboard' | 'pacman' | 'settings';
export type NoteColor = 'sage' | 'sand' | 'blue' | 'rose' | 'plain';
export interface Note {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  pinned: boolean;
  created: number;
  updated: number;
}
export interface Clip {
  id: string;
  text: string;
  source: string;
  pinned: boolean;
  created: number;
}
export interface ClipboardStatus {
  available: boolean;
  backend: 'wayland' | 'x11' | null;
  enabled: boolean;
  error: string;
  textOnly: boolean;
  sensitiveFilter: boolean;
}
export interface SystemInfo {
  hostname: string;
  os: string;
  isArch: boolean;
  kernel: string;
  architecture: string;
  uptimeSeconds: number;
  cpu: { percent: number; cores: number; model: string; load: number[] };
  memory: {
    total: number;
    available: number;
    used: number;
    percent: number;
    swapTotal: number;
    swapUsed: number;
  };
  disk: { total: number; used: number; free: number; percent: number; mount: string };
  network: { interfaces: { name: string; rx: number; tx: number }[]; rx: number; tx: number };
  processes: { pid: number; name: string; memory: number; state: string }[];
  timestamp: number;
}
export interface Session {
  app: string;
  version: string;
  preview: boolean;
  dataDir: string;
  tokenReady: boolean;
}
export interface Capabilities {
  clipboard: ClipboardStatus;
  pacman: boolean;
  browser: string | null;
  preview: boolean;
}
export interface Package {
  name: string;
  version: string;
  description: string;
}
export interface CommandResult {
  command: string;
  argv: string[];
  description: string;
  privileged: boolean;
  executed: boolean;
}
