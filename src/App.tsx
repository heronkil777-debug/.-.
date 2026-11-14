import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Command,
  Keyboard,
  LayoutDashboard,
  Menu,
  Monitor,
  NotebookPen,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from './api';
import type { Capabilities, ClipboardStatus, Clip, Note, Page, Session, SystemInfo } from './types';
import { Logo, Button, IconButton, Modal } from './components/UI';
import { Overview } from './components/Overview';
import { Notes } from './components/Notes';
import { ClipboardPage } from './components/Clipboard';
import { Pacman } from './components/Pacman';
import { Settings } from './components/Settings';

const NAV: { id: Page; label: string; icon: typeof Activity; key: string }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard, key: '1' },
  { id: 'notes', label: 'Notas rápidas', icon: NotebookPen, key: '2' },
  { id: 'clipboard', label: 'Área de transferência', icon: Clipboard, key: '3' },
  { id: 'pacman', label: 'Assistente pacman', icon: Terminal, key: '4' },
];
const PAGE_NAMES: Record<Page, string> = {
  overview: 'Visão geral',
  notes: 'Notas rápidas',
  clipboard: 'Área de transferência',
  pacman: 'Assistente pacman',
  settings: 'Preferências',
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteQuery, setNoteQuery] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [clipQuery, setClipQuery] = useState('');
  const [clipboardStatus, setClipboardStatus] = useState<ClipboardStatus | null>(null);
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [packageSeed, setPackageSeed] = useState('');
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
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [clipsLoaded, setClipsLoaded] = useState(false);
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
  const newNote = useCallback(() => {
    navigate('notes');
    setEditing('new');
  }, [navigate]);
  const refreshNotes = useCallback(async () => {
    const result = await api.notes(noteQuery);
    setNotes(result.notes);
    setNotesLoaded(true);
  }, [noteQuery]);
  const refreshClips = useCallback(async () => {
    const result = await api.clips(clipQuery);
    setClips(result.clips);
    setClipboardStatus(result.status);
    setClipsLoaded(true);
  }, [clipQuery]);
  const refreshContext = useCallback(async () => {
    await Promise.all([refreshNotes(), refreshClips()]);
  }, [refreshNotes, refreshClips]);
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
    if (!connected) return;
    const timer = setTimeout(
      () => {
        void refreshNotes().catch((e) => notify(e.message));
      },
      noteQuery ? 200 : 0,
    );
    return () => clearTimeout(timer);
  }, [connected, refreshNotes, noteQuery, notify]);
  useEffect(() => {
    if (!connected) return;
    const timer = setTimeout(
      () => {
        void refreshClips().catch((e) => notify(e.message));
      },
      clipQuery ? 200 : 0,
    );
    return () => clearTimeout(timer);
  }, [connected, refreshClips, clipQuery, notify]);
  useEffect(() => {
    if (!connected || page !== 'clipboard' || !clipboardStatus?.enabled) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refreshClips().catch(() => undefined);
    }, 3500);
    return () => clearInterval(timer);
  }, [connected, page, clipboardStatus?.enabled, refreshClips]);
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
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        newNote();
      }
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
  }, [navigate, newNote]);
  useEffect(() => {
    document.title = `${PAGE_NAMES[page]} · NEXO`;
  }, [page]);
  const openNote = (note: Note) => {
    navigate('notes');
    setEditing(note);
  };
  const commandItems = [
    ...NAV.map((n) => ({
      id: n.id,
      label: n.label,
      detail: `Abrir página · ${n.key}`,
      icon: n.icon,
      action: () => navigate(n.id),
    })),
    {
      id: 'new',
      label: 'Criar uma nota',
      detail: 'Uma ideia nova · N',
      icon: NotebookPen,
      action: newNote,
    },
    {
      id: 'settings',
      label: 'Preferências e privacidade',
      detail: 'Dados, permissões e instalação',
      icon: Settings2,
      action: () => navigate('settings'),
    },
    {
      id: 'update',
      label: 'Preparar atualização do sistema',
      detail: 'Assistente pacman · apenas sugestão',
      icon: Package,
      action: () => {
        setPackageSeed('');
        navigate('pacman');
      },
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
            <strong>{session?.preview ? 'Prévia do NEXO' : 'Meu espaço'}</strong>
            <span>{session?.preview ? 'Ambiente de demonstração' : 'Pessoal · local'}</span>
          </div>
          <ShieldCheck size={15} />
        </div>
        <div className="nav-section-label">ESPAÇO PESSOAL</div>
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
              {item.id === 'notes' && notes.length > 0 ? (
                <span className="nav-count">{notes.length}</span>
              ) : (
                <kbd>{item.key}</kbd>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-promise">
            <span className="local-promise-icon">
              <ShieldCheck size={19} strokeWidth={1.5} />
            </span>
            <strong>100% no seu espaço.</strong>
            <p>
              O que é seu fica com você.
              <br />
              Sem conta. Sem nuvem.
            </p>
            <span className="local-promise-line" />
          </div>
          <button
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            aria-current={page === 'settings' ? 'page' : undefined}
          >
            <Settings2 size={18} strokeWidth={1.7} />
            <span>Preferências</span>
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
            <span>v2.0</span>
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
            <span className="breadcrumb-root">Meu espaço</span>
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
              notes={notes}
              clips={clips}
              onNavigate={navigate}
              onNewNote={newNote}
              onOpenNote={openNote}
              onRefresh={() => void manualRefresh()}
              onCommand={() => {
                setPackageSeed('');
                navigate('pacman');
              }}
            />
          )}
          {page === 'notes' &&
            (notesLoaded ? (
              <Notes
                notes={notes}
                query={noteQuery}
                onQuery={setNoteQuery}
                onChange={refreshNotes}
                onNew={newNote}
                editing={editing}
                onEdit={setEditing}
                notify={notify}
              />
            ) : (
              <div className="page loading-page" role="status">
                Abrindo suas notas…
              </div>
            ))}
          {page === 'clipboard' &&
            (clipsLoaded ? (
              <ClipboardPage
                clips={clips}
                status={clipboardStatus}
                query={clipQuery}
                onQuery={setClipQuery}
                onChange={refreshClips}
                notify={notify}
              />
            ) : (
              <div className="page loading-page" role="status">
                Abrindo seu histórico…
              </div>
            ))}
          {page === 'pacman' && connected && (
            <Pacman key={packageSeed} initialPackage={packageSeed} notify={notify} />
          )}
          {page === 'settings' && (
            <Settings
              session={session}
              capabilities={capabilities}
              system={system}
              status={clipboardStatus}
              onChange={refreshContext}
              notify={notify}
              onShortcuts={() => setShortcutsOpen(true)}
            />
          )}
        </main>
        <footer className="main-footer">
          <span>
            <Logo small /> Feito para o seu ritmo.
          </span>
          <span>
            <ShieldCheck size={12} /> Sem trackers. Sem surpresas com seus dados.
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
          subtitle="Navegue ou comece algo novo."
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
              placeholder="Notas, pacman, privacidade…"
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
                Nenhuma ação encontrada. Tente “nota” ou “pacman”.
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
          title="Menos cliques. Mais fluxo."
          subtitle="Atalhos funcionam fora dos campos de texto."
          onClose={() => setShortcutsOpen(false)}
        >
          <div className="shortcut-list">
            {[
              ['Ctrl / ⌘ + K', 'Buscar ações'],
              ['N', 'Criar uma nota'],
              ['1', 'Visão geral'],
              ['2', 'Notas rápidas'],
              ['3', 'Área de transferência'],
              ['4', 'Assistente pacman'],
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
            <p>No editor, o salvamento é automático. Use “Concluir” para fechar com segurança.</p>
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
