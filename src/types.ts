export type Page = 'overview' | 'pacman' | 'settings';

export interface ProcessInfo {
  pid: number;
  name: string;
  memory: number;
  cpu: number;
  state: string;
  user: string;
}
export interface DiskInfo {
  mount: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}
export interface SystemInfo {
  hostname: string;
  os: string;
  isArch: boolean;
  kernel: string;
  architecture: string;
  uptimeSeconds: number;
  cpu: {
    percent: number;
    cores: number;
    model: string;
    load: number[];
    perCore: { name: string; percent: number }[];
  };
  memory: {
    total: number;
    available: number;
    used: number;
    percent: number;
    cached: number;
    buffers: number;
    swapTotal: number;
    swapUsed: number;
    swapPercent: number;
  };
  disk: { total: number; used: number; free: number; percent: number; mount: string };
  disks: DiskInfo[];
  network: { interfaces: { name: string; rx: number; tx: number }[]; rx: number; tx: number };
  temperatures: { label: string; celsius: number }[];
  batteries: { name: string; percent: number; status: string }[];
  processes: ProcessInfo[];
  timestamp: number;
}
export interface Session {
  app: string;
  version: string;
  preview: boolean;
  focus: string;
  tokenReady: boolean;
}
export interface Capabilities {
  pacman: boolean;
  browser: string | null;
  preview: boolean;
}
export interface Package {
  name: string;
  version: string;
  description: string;
}
export interface PackageUpdate {
  name: string;
  from: string;
  to: string;
}
export interface PacmanInsights {
  available: boolean;
  message: string;
  installed?: number;
  orphans?: string[];
  orphanCount?: number;
  foreignCount?: number;
  updates?: PackageUpdate[];
  updateCount?: number;
  cacheBytes?: number;
  cacheFiles?: number;
  lastSync?: number;
}
export interface PackageInfo {
  available: boolean;
  found: boolean;
  name?: string;
  fields?: Record<string, string>;
  message: string;
}
export interface CommandResult {
  command: string;
  argv: string[];
  description: string;
  privileged: boolean;
  executed: boolean;
}
