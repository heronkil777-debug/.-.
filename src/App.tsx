import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  Info,
  Keyboard,
  Menu,
  Monitor,
  Package,
  Search,
  ShieldCheck,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from './api';
import type { Capabilities, Page, Session, SystemInfo } from './types';
import { Logo, Button, IconButton, Modal } from './components/UI';
import { Overview } from './components/Overview';
import { Pacman } from './components/Pacman';
import { Settings } from './components/Settings';

const NAV: { id: Page; label: string; icon: typeof Activity; key: string }[] = [
  { id: 'overview', label: 'Monitor do sistema', icon: Activity, key: '1' },
  { id: 'pacman', label: 'Assistente pacman', icon: Terminal, key: '2' },
];
const PAGE_NAMES: Record<Page, string> = {
  overview: 'Monitor do sistema',
  pacman: 'Assistente pacman',
  settings: 'Sobre e instalação',
};
function initialPage(): Page {
  const value = window.location.hash.slice(1);
  return Object.hasOwn(PAGE_NAMES, value) ? (value as Page) : 'overview';
}
export default function App() {
  const [page, setPage] = useState<Page>(initialPage);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [networkHistory, setNetworkHistory] = useState<number[]>([]);
  const [uploadHistory, setUploadHistory] = useState<number[]>([]);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [commandIndex, setCommandIndex] = useState(0);
  const [live, setLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const systemRef = useRef<SystemInfo | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  const navigate = useCallback((next: Page) => {
    setPage(next);
    window.location.hash = next;
    setMobileMenu(false);
    setCommandOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const refreshSystem = useCallback(async () => {
    const info = await api.system();
    const previous = systemRef.current;
    systemRef.current = info;
    setSystem(info);
    if (previous) {
      const elapsed = Math.max(0.5, info.timestamp - previous.timestamp);
      setNetworkHistory((h) => [
        ...h.slice(-29),
        Math.max(0, (info.network.rx - previous.network.rx) / elapsed),
      ]);
      setUploadHistory((h) => [
        ...h.slice(-29),
        Math.max(0, (info.network.tx - previous.network.tx) / elapsed),
      ]);
    } else {
      setNetworkHistory([0]);
      setUploadHistory([0]);
    }
    setHistory((h) => [...h.slice(-29), info.cpu.percent]);
    setConnected(true);
    setConnectionError('');
    return info;
  }, []);
  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSystem();
      notify('Leitura do sistema atualizada.');
    } catch (e) {
      setConnected(false);
      setConnectionError((e as Error).message);
      notify('Não foi possível falar com o serviço local.');
    } finally {
      setRefreshing(false);
    }
  };
  const connect = useCallback(async () => {
    setConnectionError('');
    try {
      const s = await api.session();
      setSession(s);
      const [caps] = await Promise.all([api.capabilities(), refreshSystem()]);
      setCapabilities(caps);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setConnectionError((e as Error).message || 'Serviço local indisponível.');
    }
  }, [refreshSystem]);
  useEffect(() => {
    void connect();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [connect]);
  useEffect(() => {
    if (!connected || !live) return;
    const timer = setInterval(() => {
      if (!document.hidden)
        void refreshSystem().catch(() => {
          setConnected(false);
          setConnectionError('O serviço local parou de responder.');
        });
    }, 3000);
    return () => clearInterval(timer);
  }, [connected, live, refreshSystem]);
  useEffect(() => {
    const handler = () => setPage(initialPage());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!document.querySelector('dialog[open]')) {
          setSearch('');
          setCommandIndex(0);
          setCommandOpen(true);
        }
        return;
      }
      if (
        typing ||
        document.querySelector('dialog[open]') ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const nav = NAV.find((item) => item.key === event.key);
      if (nav) {
        event.preventDefault();
        navigate(nav.id);
      }
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (event.key === 'Escape') setMobileMenu(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);
  useEffect(() => {
    document.title = `${PAGE_NAMES[page]} · NEXO`;
  }, [page]);
  const commandItems = [
    ...NAV.map((n) => ({
      id: n.id,
      label: n.label,
      detail: `Abrir página · ${n.key}`,
      icon: n.icon,
      action: () => navigate(n.id),
    })),
    {
      id: 'settings',
      label: 'Sobre, privacidade e instalação',
      detail: 'Como o NEXO funciona no seu Arch',
      icon: Info,
      action: () => navigate('settings'),
    },
    {
      id: 'update',
      label: 'Preparar atualização do sistema',
      detail: 'Assistente pacman · apenas sugestão',
      icon: Package,
      action: () => navigate('pacman'),
    },
  ].filter((item) =>
    `${item.label} ${item.detail}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Pular para o conteúdo
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`} aria-label="Navegação principal">
        <a
          className="brand-link"
          href="#overview"
          aria-label="NEXO — início"
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
        >
          <Logo />
        </a>
        <span className="brand-caption">SEU LINUX, MAIS PERTO.</span>
        <div className="workspace-label">
          <span className="workspace-avatar">
            <Monitor size={16} />
          </span>
          <div>
            <strong>{session?.preview ? 'Prévia do NEXO' : 'Meu computador'}</strong>
            <span>{session?.preview ? 'Ambiente de demonstração' : 'Pessoal · local'}</span>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-section-label">DUAS FERRAMENTAS. UM FOCO.</div>
        <nav>
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(item.id);
              }}
            >
              <item.icon size={18} strokeWidth={1.7} />
              <span>{item.label}</span>
              <kbd>{item.key}</kbd>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
          >
            <Info size={18} strokeWidth={1.7} />
            <span>Sobre e instalação</span>
            <ChevronRight size={14} />
          </button>
          <button className="nav-item" onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={18} strokeWidth={1.7} />
            <span>Atalhos de teclado</span>
            <kbd>?</kbd>
          </button>
          <div className="sidebar-footer">
            <span className={`status-dot ${!connected ? 'offline' : ''}`} />
            <span>{connected ? 'Serviço local conectado' : 'Serviço desconectado'}</span>
            <span>v{session?.version?.split('.')[0] || '3'}.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              icon={Menu}
              label="Abrir navegação"
              className="mobile-menu-toggle"
              onClick={() => setMobileMenu(!mobileMenu)}
            />
            <span className="breadcrumb-root">Meu computador</span>
            <ChevronRight size={13} />
            <span>{PAGE_NAMES[page]}</span>
          </div>
          <div className="topbar-right">
            <button
              className="command-trigger"
              onClick={() => {
                setSearch('');
                setCommandIndex(0);
                setCommandOpen(true);
              }}
            >
              <Search size={15} />
              <span>Encontre seu próximo passo…</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className={`live-indicator ${live ? 'is-live' : ''}`}
              onClick={() => {
                setLive(!live);
                notify(
                  live ? 'Atualização automática pausada.' : 'Atualização automática retomada.',
                );
              }}
              title={live ? 'Pausar atualização automática' : 'Retomar atualização automática'}
            >
              <span className={`status-dot ${!connected ? 'offline' : !live ? 'paused' : ''}`} />
              <span>{!connected ? 'Offline' : live ? 'Ao vivo' : 'Pausado'}</span>
            </button>
            <button
              className="help-button"
              aria-label="Ajuda e atalhos"
              onClick={() => setShortcutsOpen(true)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        {!connected && (
          <div className="connection-banner" role="alert">
            <WifiOff size={19} />
            <div>
              <strong>O serviço local não está respondendo.</strong>
              <span>
                {connectionError || 'Conectando ao backend Python…'} Inicie com{' '}
                <code>./nexo start</code> ou confira a prévia.
              </span>
            </div>
            <Button variant="secondary" onClick={() => void connect()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {session?.preview && (
          <div className="preview-strip">
            <Monitor size={13} />
            <span>Prévia interativa · sensores do sandbox Debian, não do seu computador.</span>
            <button onClick={() => navigate('settings')}>
              Como usar no Arch <ArrowUpRight size={12} />
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {page === 'overview' && (
            <Overview
              system={system}
              history={history}
              networkHistory={networkHistory}
              uploadHistory={uploadHistory}
              onNavigate={navigate}
              onRefresh={() => void manualRefresh()}
            />
          )}
          {page === 'pacman' && connected && <Pacman notify={notify} />}
          {page === 'settings' && (
            <Settings
              session={session}
              capabilities={capabilities}
              system={system}
              notify={notify}
              onShortcuts={() => setShortcutsOpen(true)}
            />
          )}
        </main>
        <footer className="main-footer">
          <span>
            <Logo small /> Sistema e pacman. Sem ruído.
          </span>
          <span>
            <ShieldCheck size={12} /> Sem trackers. Sem execução de comandos.
          </span>
        </footer>
      </div>
      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">
        {toast && (
          <>
            <span>
              <Check size={16} />
            </span>
            <p>{toast}</p>
            <IconButton icon={X} label="Dispensar mensagem" onClick={() => setToast('')} />
          </>
        )}
      </div>
      {commandOpen && (
        <Modal
          title="Seu próximo passo."
          subtitle="Monitor, pacman ou informações do app."
          onClose={() => setCommandOpen(false)}
        >
          <div className="command-search search-field">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Buscar ações"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-results"
              aria-activedescendant={
                commandItems.length
                  ? `command-${commandItems[Math.min(commandIndex, commandItems.length - 1)].id}`
                  : undefined
              }
              placeholder="Monitor, pacman, privacidade…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCommandIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setCommandIndex((i) => Math.min(commandItems.length - 1, i + 1));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setCommandIndex((i) => Math.max(0, i - 1));
                }
                if (e.key === 'Enter' && commandItems.length) {
                  e.preventDefault();
                  commandItems[Math.min(commandIndex, commandItems.length - 1)]?.action();
                }
              }}
            />
          </div>
          <div
            id="command-results"
            className="command-results"
            role="listbox"
            aria-label="Ações disponíveis"
          >
            {commandItems.length ? (
              commandItems.map((item, i) => (
                <button
                  key={item.id}
                  id={`command-${item.id}`}
                  role="option"
                  aria-selected={i === commandIndex}
                  className={i === commandIndex ? 'selected' : ''}
                  onClick={item.action}
                  onMouseEnter={() => setCommandIndex(i)}
                >
                  <item.icon size={18} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p className="command-no-results">
                Nenhuma ação encontrada. Tente “monitor” ou “pacman”.
              </p>
            )}
          </div>
          <div className="command-hint">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> navegar
            </span>
            <span>
              <kbd>enter</kbd> abrir
            </span>
            <span>
              <kbd>esc</kbd> fechar
            </span>
          </div>
        </Modal>
      )}
      {shortcutsOpen && (
        <Modal
          title="Menos cliques. Mais foco."
          subtitle="Atalhos funcionam fora dos campos de texto."
          onClose={() => setShortcutsOpen(false)}
        >
          <div className="shortcut-list">
            {[
              ['Ctrl / ⌘ + K', 'Buscar ações'],
              ['1', 'Monitor do sistema'],
              ['2', 'Assistente pacman'],
              ['?', 'Mostrar estes atalhos'],
              ['Esc', 'Fechar janela'],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <p>O NEXO não executa comandos. Copie a sugestão e revise no seu terminal.</p>
          </div>
        </Modal>
      )}
      {refreshing && (
        <span className="sr-only" role="status">
          Atualizando sistema
        </span>
      )}
    </div>
  );
}
