import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Headphones,
  Layers3,
  LockKeyhole,
  Map,
  Orbit,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ENDINGS,
  MODULES,
  STORAGE_KEY,
  formatTime,
  freshState,
  gameReducer,
  isUnlocked,
  parseSavedState,
  type EndingId,
  type GameState,
  type ViewId,
} from './game';
import { Soundscape } from './audio';
import { Brand, EarthView, MODULE_ICONS, StationMap, Waveform } from './components/Visuals';
import { ActivePuzzle } from './components/Puzzles';
import { Decision, Journal, downloadReport } from './components/Journal';
import { Modal } from './components/Modal';

type ModalName = 'help' | 'journal' | 'map' | 'reset' | 'guided-reset' | 'confirm-ending' | null;
const ENDINGS_KEY = 'ultimo-sinal:desfechos';
function loadGame() {
  try {
    return parseSavedState(localStorage.getItem(STORAGE_KEY)) ?? freshState();
  } catch {
    return freshState();
  }
}
function loadEndings(): EndingId[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ENDINGS_KEY) ?? '[]');
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is EndingId => typeof id === 'string' && Object.hasOwn(ENDINGS, id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
function loadMotion(): boolean | null {
  try {
    const value = localStorage.getItem('ultimo-sinal:motion');
    return value === 'reduced' ? true : value === 'full' ? false : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadGame);
  const [modal, setModal] = useState<ModalName>(null);
  const [choice, setChoice] = useState<EndingId | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(loadMotion);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const [discovered, setDiscovered] = useState<EndingId[]>(loadEndings);
  const sound = useRef<Soundscape | null>(null);
  if (!sound.current) sound.current = new Soundscape();
  const reducedMotion = motionOverride ?? systemReducedMotion;
  const notify = useCallback((text: string) => setToast({ text, id: Date.now() }), []);
  const playSound = useCallback(
    (kind: 'click' | 'success' | 'error' | 'pad', pad?: number) => sound.current?.play(kind, pad),
    [],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
  }, [reducedMotion]);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
    }
  }, [state]);
  useEffect(() => {
    if (!state.started || state.ending) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(timer);
  }, [state.started, state.ending]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => () => sound.current?.dispose(), []);
  useEffect(() => {
    if (!state.ending) return;
    setDiscovered((previous) => {
      const next = previous.includes(state.ending!) ? previous : [...previous, state.ending!];
      try {
        localStorage.setItem(ENDINGS_KEY, JSON.stringify(next));
      } catch {
        /* The ending remains available in memory. */
      }
      return next;
    });
  }, [state.ending]);
  useEffect(() => {
    if (!state.started || state.ending) return;
    const timer = setTimeout(
      () => document.getElementById('puzzle-title')?.focus({ preventScroll: true }),
      60,
    );
    return () => clearTimeout(timer);
  }, [state.selected, state.solved.length, state.started, state.ending]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        document.querySelector('dialog[open]')
      )
        return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === '?') {
        event.preventDefault();
        setModal('help');
      }
      if (!state.started || state.ending) return;
      if (event.key.toLowerCase() === 'j') {
        event.preventDefault();
        setModal('journal');
      }
      if (event.key.toLowerCase() === 'm') {
        event.preventDefault();
        setModal('map');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.started, state.ending]);

  const toggleAudio = async () => {
    if (audioBusy) return;
    setAudioBusy(true);
    const enabled = await sound.current!.setEnabled(!audioEnabled);
    setAudioEnabled(enabled);
    setAudioBusy(false);
    if (!enabled && !audioEnabled)
      notify('O áudio não está disponível neste navegador. Toda a experiência funciona sem som.');
    else if (enabled) playSound('click');
  };
  const toggleMotion = () => {
    const next = !reducedMotion;
    setMotionOverride(next);
    try {
      localStorage.setItem('ultimo-sinal:motion', next ? 'reduced' : 'full');
    } catch {
      /* Preference is kept for this session. */
    }
  };
  const select = (id: ViewId) => {
    if (!isUnlocked(state, id)) {
      notify(
        `Ainda bloqueado. Restaure ${MODULES[state.solved.length]?.name ?? 'o sistema anterior'} primeiro.`,
      );
      playSound('error');
      return;
    }
    dispatch({ type: 'SELECT', id });
    playSound('click');
    setModal(null);
    if (window.innerWidth < 800)
      setTimeout(
        () =>
          document
            .getElementById('workbench')
            ?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }),
        80,
      );
  };
  const start = (guided: boolean) => {
    if (guided && state.started && (state.solved.length > 0 || state.ending)) {
      setModal('guided-reset');
      return;
    }
    dispatch({ type: 'START', guided });
    playSound('click');
  };
  const reset = () => {
    dispatch({ type: 'RESET' });
    setChoice(null);
    setModal(null);
    playSound('click');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const audioButton = (
    <button
      className={`icon-button audio-button ${audioEnabled ? 'enabled' : ''}`}
      onClick={() => void toggleAudio()}
      disabled={audioBusy}
      aria-label={audioEnabled ? 'Desligar áudio' : 'Ligar áudio'}
      aria-pressed={audioEnabled}
      title={audioEnabled ? 'Desligar áudio' : 'Ligar áudio — recomendado usar fones'}
    >
      {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );

  return (
    <div className={`app ${state.started ? 'in-mission' : ''}`}>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      {!state.started ? (
        <main id="main-content" className="landing">
          <img
            className="landing-image"
            src="/assets/orbital-earth.webp"
            alt=""
            fetchPriority="high"
          />
          <div className="landing-shade" />
          <div className="film-grain" />
          <header className="landing-header">
            <Brand />
            <div className="landing-header-right">
              <span className="connection-status">
                <span className="status-dot" /> UPLINK INTERROMPIDO
              </span>
              {audioButton}
              <button
                className="icon-button"
                onClick={() => setModal('help')}
                aria-label="Como jogar"
              >
                <CircleHelp size={19} />
              </button>
            </div>
          </header>
          <div className="landing-content">
            <div className="mission-tag">
              <span /> ESTAÇÃO ÍRIS–9 <i /> 04:17 UTC
            </div>
            <h1>
              ÚLTIMO
              <br />
              <span>
                SINAL<span className="title-period">.</span>
              </span>
            </h1>
            <h2>
              O silêncio não significa
              <br />
              que você está sozinho.
            </h2>
            <p className="landing-description">
              A Terra parou de responder. Você é a última pessoa
              <br className="desktop-break" /> acordada. E uma transmissão acaba de chegar.
            </p>
            <div className="landing-actions">
              <button
                className="button button-primary button-launch"
                onClick={() => start(state.guided)}
              >
                {state.started ? 'Continuar turno' : 'Assumir o turno'}
                <ArrowUpRight size={20} />
              </button>
              <button className="button button-ghost" onClick={() => start(true)}>
                <Play size={15} />
                <span>Modo apresentação</span>
              </button>
            </div>
            {state.started && (
              <button className="text-button resume-reset" onClick={() => setModal('reset')}>
                <RotateCcw size={13} /> {state.solved.length}/5 sistemas restaurados · Começar de
                novo
              </button>
            )}
            <div className="landing-advisory">
              <Headphones size={14} />
              <span>Use fones. Vá com calma. Confie nos sinais.</span>
            </div>
          </div>
          <div className="landing-annotation">
            <span className="annotation-cross">+</span>
            <div>
              <span>ÍRIS–9</span>
              <span>ÓRBITA TERRESTRE BAIXA</span>
            </div>
            <i />
          </div>
          <div className="incoming-card">
            <div className="incoming-heading">
              <span className="status-dot" />
              <span>SINAL NÃO IDENTIFICADO</span>
              <ArrowDownRight size={16} />
            </div>
            <Waveform quality={38} reducedMotion={reducedMotion} />
            <div className="incoming-footer">
              <span>96.4 MHz</span>
              <span>ORIGEM: DESCONHECIDA</span>
            </div>
          </div>
          <footer className="landing-footer">
            <div className="experience-facts">
              <span>
                <b>05</b> SISTEMAS
              </span>
              <i />
              <span>
                <b>03</b> DESFECHOS
              </span>
              <i />
              <span>
                <Clock3 size={13} /> 10–15 MIN
              </span>
            </div>
            <span className="landing-footer-note">
              UMA EXPERIÊNCIA DE INVESTIGAÇÃO. NO SEU RITMO.
            </span>
            <span className="build-number">V.01 / PT-BR</span>
          </footer>
        </main>
      ) : state.ending ? (
        <EndingScreen
          state={state}
          discovered={discovered}
          audioButton={audioButton}
          onReopen={() => {
            dispatch({ type: 'REOPEN' });
            setChoice(null);
            playSound('click');
          }}
          onReset={() => setModal('reset')}
          onJournal={() => setModal('journal')}
        />
      ) : (
        <div className="mission-shell">
          <header className="mission-header">
            <button
              className="brand-home"
              onClick={() => setModal('help')}
              title="Informações da missão"
            >
              <Brand compact />
            </button>
            <div className="mission-header-status">
              <span className="status-dot" />
              <span>ÍRIS–9</span>
              <i />
              <span>TURNO 01</span>
            </div>
            <div className="mission-header-actions">
              <span className="mission-clock">
                <Clock3 size={14} />
                {formatTime(state.seconds)}
              </span>
              <button
                className="header-text-button mobile-map-button"
                onClick={() => setModal('map')}
              >
                <Map size={16} />
                <span>Estação</span>
              </button>
              <button
                className="header-text-button journal-toggle"
                onClick={() => setModal('journal')}
              >
                <BookOpen size={16} />
                <span>Diário</span>
                <b>{state.solved.length}</b>
              </button>
              {audioButton}
              <button
                className="icon-button"
                onClick={() => setModal('help')}
                aria-label="Ajuda e opções"
              >
                <CircleHelp size={19} />
              </button>
            </div>
          </header>
          <div className="mission-progress">
            <div className="progress-label">
              <span className="eyebrow">PROTOCOLO DE RECUPERAÇÃO</span>
              <span>
                {state.solved.length}
                <i>/05</i>
              </span>
            </div>
            <nav aria-label="Sistemas da estação">
              {MODULES.map((module) => {
                const Icon = MODULE_ICONS[module.id];
                const done = state.solved.includes(module.id),
                  unlocked = isUnlocked(state, module.id);
                return (
                  <button
                    key={module.id}
                    className={`progress-step ${done ? 'done' : ''} ${state.selected === module.id ? 'active' : ''}`}
                    onClick={() => select(module.id)}
                    aria-current={state.selected === module.id ? 'step' : undefined}
                    aria-disabled={!unlocked}
                  >
                    <span className="step-icon">
                      {done ? (
                        <Check size={15} />
                      ) : unlocked ? (
                        <Icon size={15} />
                      ) : (
                        <LockKeyhole size={13} />
                      )}
                    </span>
                    <span className="step-number">{module.number}</span>
                    <span>{module.short}</span>
                    <ChevronRight className="step-chevron" size={13} />
                  </button>
                );
              })}
            </nav>
            <div className="progress-total">
              <span style={{ width: `${state.solved.length * 20}%` }} />
            </div>
          </div>
          {state.guided && (
            <div className="guided-banner">
              <Sparkles size={14} />
              <span>
                <strong>MODO APRESENTAÇÃO</strong> Os mesmos puzzles, com assistência quando você
                quiser.
              </span>
              <button className="text-button" onClick={() => setModal('help')}>
                Como funciona <ArrowUpRight size={12} />
              </button>
            </div>
          )}
          <main id="main-content" className="mission-layout">
            <aside className="station-sidebar" aria-label="Mapa e sistemas da Íris">
              <div className="section-label">
                <Orbit size={15} />
                <span>ESTAÇÃO ÍRIS–9</span>
                <span className="status-dot" />
              </div>
              <StationMap state={state} onSelect={select} reducedMotion={reducedMotion} />
              <div className="station-health">
                <span>
                  <i className={state.solved.length >= 2 ? 'healthy' : ''} />
                  {state.solved.length >= 2 ? 'ENERGIA ESTÁVEL' : 'ENERGIA DE EMERGÊNCIA'}
                </span>
                <span>{Math.max(12, state.solved.length * 20)}%</span>
              </div>
              <nav className="module-list" aria-label="Módulos da estação">
                {MODULES.map((module) => {
                  const Icon = MODULE_ICONS[module.id],
                    done = state.solved.includes(module.id),
                    unlocked = isUnlocked(state, module.id);
                  return (
                    <button
                      key={module.id}
                      className={`module-button ${state.selected === module.id ? 'active' : ''} ${done ? 'done' : ''}`}
                      onClick={() => select(module.id)}
                      aria-disabled={!unlocked}
                    >
                      <Icon size={17} strokeWidth={1.4} />
                      <span>
                        <strong>{module.name}</strong>
                        <span>
                          {done ? 'RESTAURADO' : unlocked ? 'AGUARDANDO VOCÊ' : 'BLOQUEADO'}
                        </span>
                      </span>
                      {done ? (
                        <Check size={14} />
                      ) : unlocked ? (
                        <ChevronRight size={14} />
                      ) : (
                        <LockKeyhole size={12} />
                      )}
                    </button>
                  );
                })}
              </nav>
              <div className="crew-status">
                <div className="crew-icon">
                  <Heartline />
                </div>
                <div>
                  <strong>24 sinais vitais</strong>
                  <span>Você + 23 em criossono</span>
                </div>
                <span className="status-dot" />
              </div>
            </aside>
            <div id="workbench" className="workbench">
              <EarthView state={state} onSelect={select} reducedMotion={reducedMotion} />
              {state.selected === 'decision' ? (
                <Decision onChoose={setChoice} />
              ) : (
                <ActivePuzzle
                  key={state.selected}
                  state={state}
                  dispatch={dispatch}
                  playSound={playSound}
                  reducedMotion={reducedMotion}
                />
              )}{' '}
              {state.selected === 'decision' && (
                <div className="decision-confirm">
                  <span>
                    <ShieldCheck size={15} /> Todos os registros recuperados
                  </span>
                  <button
                    className="button button-primary"
                    disabled={!choice}
                    onClick={() => setModal('confirm-ending')}
                  >
                    Confirmar decisão <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </div>
            <aside className="journal-sidebar" aria-label="Diário de bordo">
              <Journal state={state} />
            </aside>
          </main>
          <footer className="mission-footer">
            <span className={storageAvailable ? '' : 'text-amber'}>
              {storageAvailable ? <CheckCheck size={13} /> : <CircleHelp size={13} />}{' '}
              {storageAvailable
                ? 'PROGRESSO SALVO NESTE NAVEGADOR'
                : 'SALVAMENTO INDISPONÍVEL · MANTENHA ESTA ABA ABERTA'}
            </span>
            <span className="footer-motto">O RUÍDO TAMBÉM CONTA UMA HISTÓRIA.</span>
            <button className="text-button" onClick={() => setModal('reset')}>
              <RotateCcw size={12} /> Reiniciar turno
            </button>
          </footer>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <Radio size={17} />
          <span>{toast.text}</span>
          <button
            className="icon-button"
            onClick={() => setToast(null)}
            aria-label="Dispensar aviso"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === 'help' && (
        <Modal
          title={state.started ? 'Você não está sozinho.' : 'Antes de assumir o turno.'}
          eyebrow="MANUAL DO OPERADOR"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            Explore a Íris, restaure cinco sistemas e descubra por que a Terra ficou em silêncio.
            Cada sistema recuperado revela uma parte da história.
          </p>
          <div className="help-steps">
            <div>
              <span>01</span>
              <p>
                <strong>Observe a pista.</strong> O diário guarda informações para cada puzzle. No
                celular, abra “Diário” no topo.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Experimente sem medo.</strong> Não há cronômetro regressivo, vidas ou
                penalidade. Duas pistas opcionais ajudam em cada sistema.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Escolha o desfecho.</strong> Restaure os cinco módulos e abra o canal de
                resposta. Há três finais para explorar.
              </p>
            </div>
          </div>
          <div className="help-mode">
            <Sparkles size={19} />
            <div>
              <strong>Modo apresentação</strong>
              <p>
                Um percurso assistido para conhecer a experiência em poucos minutos. A assistência
                restaura cada sistema; a escolha final continua sua.
              </p>
            </div>
          </div>
          <div className="settings-list">
            <div>
              <span>
                <Volume2 size={17} />
                <span>
                  <strong>Paisagem sonora</strong>
                  <small>Ambiência e sinais sintetizados. Sem vozes gravadas.</small>
                </span>
              </span>
              <button
                className={`toggle ${audioEnabled ? 'on' : ''}`}
                role="switch"
                aria-checked={audioEnabled}
                aria-label="Paisagem sonora"
                onClick={() => void toggleAudio()}
                disabled={audioBusy}
              >
                <i />
              </button>
            </div>
            <div>
              <span>
                <Layers3 size={17} />
                <span>
                  <strong>Reduzir movimento</strong>
                  <small>Desativa animações decorativas e o movimento das ondas.</small>
                </span>
              </span>
              <button
                className={`toggle ${reducedMotion ? 'on' : ''}`}
                role="switch"
                aria-checked={reducedMotion}
                aria-label="Reduzir movimento"
                onClick={toggleMotion}
              >
                <i />
              </button>
            </div>
          </div>
          <div className="keyboard-help">
            <span>
              <kbd>M</kbd> Mapa
            </span>
            <span>
              <kbd>J</kbd> Diário
            </span>
            <span>
              <kbd>?</kbd> Ajuda
            </span>
            <span>
              <kbd>Esc</kbd> Fechar
            </span>
          </div>
          <p className="credits">
            Ficção interativa em português. Cenário criado com IA; interface, história, música e
            efeitos originais. Nenhum dado é enviado a servidores.{' '}
            {discovered.length > 0 && `${discovered.length}/3 desfechos descobertos.`}
          </p>
          <button
            className="button button-primary modal-full-button"
            onClick={() => setModal(null)}
          >
            {state.started ? 'Voltar à estação' : 'Entendido'}
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === 'journal' && (
        <Modal
          title="O que sabemos até aqui."
          eyebrow="ARQUIVO DO OPERADOR"
          onClose={() => setModal(null)}
          wide
        >
          <Journal state={state} />
        </Modal>
      )}
      {modal === 'map' && (
        <Modal title="Estação Íris–9." eyebrow="MAPA DE SISTEMAS" onClose={() => setModal(null)}>
          <StationMap state={state} onSelect={select} reducedMotion={reducedMotion} />
          <div className="map-modal-list">
            {MODULES.map((module) => {
              const Icon = MODULE_ICONS[module.id];
              return (
                <button
                  className="module-button"
                  key={module.id}
                  onClick={() => select(module.id)}
                  aria-disabled={!isUnlocked(state, module.id)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{module.name}</strong>
                    <span>
                      {state.solved.includes(module.id)
                        ? 'RESTAURADO'
                        : isUnlocked(state, module.id)
                          ? 'DISPONÍVEL'
                          : 'BLOQUEADO'}
                    </span>
                  </span>
                  {state.solved.includes(module.id) ? (
                    <Check size={15} />
                  ) : isUnlocked(state, module.id) ? (
                    <ChevronRight size={15} />
                  ) : (
                    <LockKeyhole size={13} />
                  )}
                </button>
              );
            })}
          </div>
          {state.solved.length === 5 && (
            <button
              className="button button-primary modal-full-button"
              onClick={() => select('decision')}
            >
              Abrir canal de resposta <Radio size={16} />
            </button>
          )}
          {toast && (
            <div className="inline-feedback" role="status">
              <LockKeyhole size={15} />
              <span>{toast.text}</span>
            </div>
          )}
        </Modal>
      )}
      {(modal === 'reset' || modal === 'guided-reset') && (
        <Modal
          title={modal === 'guided-reset' ? 'Começar uma apresentação?' : 'Começar outro turno?'}
          eyebrow="REINICIAR INVESTIGAÇÃO"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            O progresso atual será apagado deste navegador. Os desfechos que você já descobriu
            continuam guardados. Você pode baixar o diário antes de recomeçar.
          </p>
          <button className="text-button" onClick={() => downloadReport(state)}>
            <Download size={15} /> Baixar diário atual
          </button>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={() => setModal(null)}>
              Continuar este turno
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                if (modal === 'guided-reset') {
                  dispatch({ type: 'RESET' });
                  dispatch({ type: 'START', guided: true });
                  setChoice(null);
                  setModal(null);
                  window.scrollTo({ top: 0, behavior: 'instant' });
                } else reset();
              }}
            >
              {modal === 'guided-reset' ? 'Iniciar apresentação' : 'Recomeçar'}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === 'confirm-ending' && choice && (
        <Modal
          title="Esta é a sua resposta?"
          eyebrow="ENCERRAR O TURNO"
          onClose={() => setModal(null)}
        >
          <div className="confirmation-choice">
            <Radio size={24} />
            <strong>{ENDINGS[choice].label}</strong>
          </div>
          <p className="modal-intro">
            Sua decisão será registrada no diário. Depois de conhecer o desfecho, você pode voltar à
            estação e escolher outro caminho.
          </p>
          <div className="modal-actions">
            <button className="button button-secondary" onClick={() => setModal(null)}>
              Pensar mais um pouco
            </button>
            <button
              className="button button-primary"
              onClick={() => {
                dispatch({ type: 'ENDING', id: choice });
                setModal(null);
                playSound('success');
                window.scrollTo({ top: 0, behavior: 'instant' });
              }}
            >
              Encerrar turno <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Heartline() {
  return (
    <svg viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <path d="M1 13H8L11 6L15 20L19 3L23 13H31" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function EndingScreen({
  state,
  discovered,
  audioButton,
  onReopen,
  onReset,
  onJournal,
}: {
  state: GameState;
  discovered: EndingId[];
  audioButton: React.ReactNode;
  onReopen: () => void;
  onReset: () => void;
  onJournal: () => void;
}) {
  const ending = ENDINGS[state.ending!];
  return (
    <main id="main-content" className={`ending-screen ending-${ending.color}`}>
      <img
        className="ending-image"
        src="/assets/orbital-earth.webp"
        alt="O nascer do sol visto da órbita da Terra"
      />
      <div className="ending-shade" />
      <header className="landing-header">
        <Brand />
        {audioButton}
      </header>
      <div className="ending-content">
        <div className="ending-index">
          <span className="status-dot" /> DESFECHO {ending.number} / III <i /> {discovered.length}{' '}
          DE 3 DESCOBERTOS
        </div>
        <span className="eyebrow ending-subtitle">{ending.subtitle}</span>
        <h1>{ending.title}</h1>
        <div className="ending-prose">
          {ending.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className="final-transmission">
          <Radio size={17} />
          <p>{ending.transmission}</p>
        </div>
        <div className="ending-stats">
          <span>
            <CheckCheck size={16} />
            <strong>5/5</strong> SISTEMAS
          </span>
          <span>
            <Clock3 size={16} />
            <strong>{formatTime(state.seconds)}</strong> DE TURNO
          </span>
          <span>
            <BookOpen size={16} />
            <strong>5</strong> REGISTROS
          </span>
        </div>
        <div className="ending-actions">
          <button className="button button-primary" onClick={onReopen}>
            Explorar outro desfecho <ArrowUpRight size={18} />
          </button>
          <button className="button button-ghost" onClick={onJournal}>
            <BookOpen size={16} /> Ler o diário
          </button>
        </div>
        <div className="ending-bottom-actions">
          <button className="text-button" onClick={() => downloadReport(state)}>
            <Download size={14} /> Guardar esta história
          </button>
          <button className="text-button" onClick={onReset}>
            <RotateCcw size={14} /> Novo turno
          </button>
        </div>
      </div>
      <div className="ending-signoff">
        <Orbit size={29} strokeWidth={1} />
        <span>
          FIM DA TRANSMISSÃO.
          <br />
          <strong>NÃO DA HISTÓRIA.</strong>
        </span>
      </div>
      <footer className="landing-footer">
        <span className="landing-footer-note">ÚLTIMO SINAL · UMA EXPERIÊNCIA ORBITAL</span>
        <span className="build-number">OBRIGADO POR ESCUTAR.</span>
      </footer>
    </main>
  );
}
