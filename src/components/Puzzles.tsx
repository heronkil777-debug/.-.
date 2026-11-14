import { useEffect, useRef, useState, type Dispatch, type PointerEvent } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AudioLines,
  Brain,
  Check,
  CheckCheck,
  CircleHelp,
  Eye,
  Fingerprint,
  HeartPulse,
  LockKeyhole,
  Minus,
  Play,
  Plus,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  BASE_PORTS,
  BIO_SEQUENCE,
  CIPHER_PARTS,
  INITIAL_ROTATIONS,
  MODULES,
  PAD_NAMES,
  clamp,
  connectedTiles,
  decodedParts,
  nextModule,
  powerSolved,
  signalQuality,
  type GameAction,
  type GameState,
  type ModuleId,
} from '../game';
import { Waveform } from './Visuals';

export type Notify = (message: string) => void;
export type PlaySound = (sound: 'click' | 'success' | 'error' | 'pad', pad?: number) => void;
interface PuzzleProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  playSound: PlaySound;
  reducedMotion: boolean;
}
interface ControlsProps extends PuzzleProps {
  id: ModuleId;
  error: string;
  setError: (value: string) => void;
}

function PuzzleControls({
  state,
  dispatch,
  playSound,
  id,
  error,
  setError,
  children,
}: ControlsProps & { children: React.ReactNode }) {
  const module = MODULES.find((m) => m.id === id)!;
  const hintCount = state.hints[id] ?? 0;
  const submit = () => {
    const { frequency, gain, rotations, rotors, azimuth, elevation } = state.inputs;
    let valid = false;
    let message = 'Os parâmetros ainda não coincidem. Confira a pista no diário de bordo.';
    if (id === 'signal') {
      valid = Math.abs(frequency - 96.4) < 0.15 && Math.abs(gain - 70) <= 5;
      message =
        Math.abs(frequency - 96.4) >= 0.15
          ? 'Ainda é ruído. A portadora está em 96,4 MHz; ajuste a frequência.'
          : 'Frequência encontrada. Ajuste o ganho para aproximadamente 70%.';
    }
    if (id === 'power') {
      valid = powerSolved(rotations);
      message = `Circuito aberto: ${connectedTiles(rotations).size} de 8 segmentos recebem energia. Confira as conexões na entrada e na saída.`;
    }
    if (id === 'archive') {
      valid = decodedParts(rotors).join(' ') === 'ELES ESTAO VIVOS';
      message =
        'O texto ainda está corrompido. Cada trecho tem seu próprio deslocamento. Observe a prévia.';
    }
    if (id === 'nav') {
      valid = Math.abs(azimuth - 132) <= 2 && Math.abs(elevation - 24) <= 2;
      message = 'Fora da janela de comunicação. O relé está em 132° de azimute e +24° de elevação.';
    }
    if (id === 'pulse') {
      valid =
        state.inputs.pads.length === BIO_SEQUENCE.length &&
        state.inputs.pads.every((pad, index) => pad === BIO_SEQUENCE[index]);
      message =
        'Complete os seis sensores na ordem do eco. A leitura textual mostra a sequência inteira.';
    }
    if (valid) {
      dispatch({ type: 'SOLVE', id });
      playSound('success');
      setError('');
    } else {
      dispatch({ type: 'ATTEMPT', id, message });
      playSound('error');
      setError(message);
    }
  };
  const assist = () => {
    if (id === 'signal') dispatch({ type: 'INPUT', patch: { frequency: 96.4, gain: 70 } });
    if (id === 'power')
      dispatch({ type: 'INPUT', patch: { rotations: [0, 0, 0, 0, 0, 0, 0, 0, 0] } });
    if (id === 'archive') dispatch({ type: 'INPUT', patch: { rotors: [-3, 1, -4] } });
    if (id === 'pulse') dispatch({ type: 'INPUT', patch: { pads: [...BIO_SEQUENCE] } });
    if (id === 'nav') dispatch({ type: 'INPUT', patch: { azimuth: 132, elevation: 24 } });
    dispatch({ type: 'SOLVE', id });
    playSound('success');
  };
  return (
    <div className="puzzle-controls">
      {children}
      {error && (
        <div className="inline-feedback error" role="alert">
          <Activity size={16} />
          <span>{error}</span>
        </div>
      )}
      {state.guided && (
        <div className="guided-assist">
          <Sparkles size={17} />
          <div>
            <strong>Percurso assistido</strong>
            <p>{module.demo}</p>
          </div>
          <button className="button button-small button-assist" onClick={assist}>
            Restaurar com assistência <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div className="puzzle-actions">
        <button className="button button-primary" onClick={submit}>
          {id === 'signal'
            ? 'Capturar transmissão'
            : id === 'power'
              ? 'Restaurar energia'
              : id === 'archive'
                ? 'Decifrar arquivo'
                : id === 'pulse'
                  ? 'Confirmar assinatura'
                  : 'Fixar alinhamento'}
          <ArrowRight size={17} />
        </button>
        <span className="action-note">
          <ShieldCheck size={13} /> Sem penalidade por tentar
        </span>
      </div>
      <div className="hint-area">
        <button
          className="text-button"
          onClick={() => {
            dispatch({ type: 'HINT', id });
            playSound('click');
          }}
          disabled={hintCount >= 2}
        >
          <CircleHelp size={15} />
          {hintCount === 0
            ? 'Precisa de uma pista?'
            : hintCount === 1
              ? 'Mostrar ajuste exato'
              : 'Todas as pistas reveladas'}
          {hintCount > 0 && <span>{hintCount}/2</span>}
        </button>
        {hintCount > 0 && (
          <div className="hint-content">
            {module.hints.slice(0, hintCount).map((hint, i) => (
              <p key={hint}>
                <span>0{i + 1}</span>
                {hint}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalPuzzle(props: PuzzleProps) {
  const { state, dispatch, playSound, reducedMotion } = props;
  const [error, setError] = useState('');
  const { frequency, gain } = state.inputs;
  const quality = signalQuality(frequency, gain);
  const tune = (delta: number) => {
    dispatch({
      type: 'INPUT',
      patch: { frequency: Math.round(clamp(frequency + delta, 87, 108) * 10) / 10 },
    });
    playSound('click');
  };
  return (
    <PuzzleControls {...props} id="signal" error={error} setError={setError}>
      <div className="receiver">
        <div className="receiver-top">
          <span>
            <span className="status-dot" /> RECEIVER 01 / AO VIVO
          </span>
          <span className={quality >= 95 ? 'text-green' : 'text-amber'}>
            {quality >= 95 ? 'PORTADORA ESTÁVEL' : 'BUSCANDO SINAL'}
          </span>
        </div>
        <Waveform quality={quality} reducedMotion={reducedMotion} large />
        <div className="receiver-readout">
          <div>
            <output data-testid="frequency-value">{frequency.toFixed(1)}</output>
            <span>MHz</span>
          </div>
          <div className="signal-meter">
            <span>
              COERÊNCIA <strong>{quality}%</strong>
            </span>
            <div className="meter-track">
              <i style={{ width: `${quality}%` }} />
            </div>
          </div>
        </div>
        <div className="frequency-ruler">
          {[87, 90, 93, 96, 99, 102, 105, 108].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      <div className="slider-grid">
        <div className="control-group">
          <label htmlFor="frequency">
            Frequência <span>87,0 — 108,0 MHz</span>
          </label>
          <div className="fine-tune">
            <button
              className="icon-button"
              onClick={() => tune(-0.1)}
              disabled={frequency <= 87}
              aria-label="Diminuir frequência em 0,1 MHz"
            >
              <Minus size={16} />
            </button>
            <input
              id="frequency"
              type="range"
              min="87"
              max="108"
              step="0.1"
              value={frequency}
              onChange={(e) => dispatch({ type: 'INPUT', patch: { frequency: +e.target.value } })}
            />
            <button
              className="icon-button"
              onClick={() => tune(0.1)}
              disabled={frequency >= 108}
              aria-label="Aumentar frequência em 0,1 MHz"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div className="control-group">
          <label htmlFor="gain">
            Amplificação <output>{gain}%</output>
          </label>
          <div className="fine-tune gain-slider">
            <AudioLines size={16} />
            <input
              id="gain"
              type="range"
              min="0"
              max="100"
              step="1"
              value={gain}
              onChange={(e) => dispatch({ type: 'INPUT', patch: { gain: +e.target.value } })}
            />
          </div>
        </div>
      </div>
    </PuzzleControls>
  );
}

const DIRECTIONS = ['cima', 'direita', 'baixo', 'esquerda'];
const ENDPOINTS = [
  [50, 0],
  [100, 50],
  [50, 100],
  [0, 50],
];
function PowerPuzzle(props: PuzzleProps) {
  const { state, dispatch, playSound } = props;
  const [error, setError] = useState('');
  const rotations = state.inputs.rotations;
  const powered = connectedTiles(rotations);
  const ready = powerSolved(rotations);
  const rotate = (index: number) => {
    dispatch({
      type: 'INPUT',
      patch: { rotations: rotations.map((r, i) => (i === index ? (r + 1) % 4 : r)) },
    });
    setError('');
    playSound('click');
  };
  return (
    <PuzzleControls {...props} id="power" error={error} setError={setError}>
      <div className="circuit-panel">
        <div className="panel-instrument-label">
          <span>BARRAMENTO / CAMINHO DE EMERGÊNCIA</span>
          <button
            className="text-button"
            onClick={() => {
              dispatch({ type: 'INPUT', patch: { rotations: [...INITIAL_ROTATIONS] } });
              setError('');
              playSound('click');
            }}
          >
            <RotateCcw size={13} /> Reiniciar
          </button>
        </div>
        <div className="circuit-wrap">
          <div className={`circuit-terminal terminal-in ${powered.size ? 'powered' : ''}`}>
            <Zap size={16} />
            <span>ENTRADA</span>
            <ArrowRight size={15} />
          </div>
          <div className="circuit-grid">
            {rotations.map((rotation, index) =>
              index === 4 ? (
                <div className="circuit-tile heat-sink" key={index}>
                  <Brain size={23} strokeWidth={1} />
                  <span>NÚCLEO</span>
                </div>
              ) : (
                <button
                  key={index}
                  className={`circuit-tile ${powered.has(index) ? 'powered' : ''}`}
                  onClick={() => rotate(index)}
                  aria-label={`${String(index + 1).padStart(2, '0')} — Girar peça ${index + 1}, linha ${Math.floor(index / 3) + 1}, coluna ${(index % 3) + 1}. Conexões: ${BASE_PORTS[index].map((p) => DIRECTIONS[(p + rotation) % 4]).join(' e ')}`}
                >
                  <span className="tile-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <svg
                    className="tile-paths"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                    style={{ transform: `rotate(${rotation * 90}deg)` }}
                  >
                    {BASE_PORTS[index].map((direction) => (
                      <path
                        key={direction}
                        d={`M50 50 L${ENDPOINTS[direction][0]} ${ENDPOINTS[direction][1]}`}
                      />
                    ))}
                    <circle cx="50" cy="50" r="6" />
                  </svg>
                  <RotateCcw className="tile-rotate" size={12} />
                </button>
              ),
            )}
          </div>
          <div className={`circuit-terminal terminal-out ${ready ? 'powered' : ''}`}>
            <ArrowRight size={15} />
            <Zap size={16} />
            <span>SAÍDA</span>
          </div>
        </div>
        <div className={`circuit-status ${ready ? 'text-green' : ''}`}>
          {ready ? <CheckCheck size={16} /> : <Activity size={16} />}
          <span>{powered.size} / 8 segmentos energizados</span>
          <span>{ready ? 'CIRCUITO FECHADO' : 'GIRE AS PEÇAS PARA CONECTAR'}</span>
        </div>
      </div>
    </PuzzleControls>
  );
}

function ArchivePuzzle(props: PuzzleProps) {
  const { state, dispatch, playSound } = props;
  const [error, setError] = useState('');
  const rotors = state.inputs.rotors;
  const decoded = decodedParts(rotors);
  const expected = ['ELES', 'ESTAO', 'VIVOS'];
  const change = (index: number, value: number) => {
    dispatch({
      type: 'INPUT',
      patch: { rotors: rotors.map((r, i) => (i === index ? clamp(value, -9, 9) : r)) },
    });
    setError('');
    playSound('click');
  };
  return (
    <PuzzleControls {...props} id="archive" error={error} setError={setError}>
      <div className="cipher-panel">
        <div className="panel-instrument-label">
          <span>
            <LockKeyhole size={12} /> ARQUIVO PESSOAL / OPERADOR 01
          </span>
          <span>CIFRA DE DESLOCAMENTO</span>
        </div>
        <div className="ciphertext">
          {CIPHER_PARTS.map((part) => (
            <span key={part}>{part}</span>
          ))}
        </div>
        <div className="rotors">
          {rotors.map((rotor, index) => (
            <div
              className={`rotor ${decoded[index] === expected[index] ? 'matched' : ''}`}
              key={index}
            >
              <span className="eyebrow">ROTOR 0{index + 1}</span>
              <button
                className="icon-button"
                onClick={() => change(index, rotor + 1)}
                disabled={rotor >= 9}
                aria-label={`Aumentar rotor ${index + 1}`}
              >
                <ArrowUp size={17} />
              </button>
              <output aria-label={`Deslocamento do rotor ${index + 1}`}>
                {rotor > 0 ? '+' : ''}
                {rotor}
              </output>
              <button
                className="icon-button"
                onClick={() => change(index, rotor - 1)}
                disabled={rotor <= -9}
                aria-label={`Diminuir rotor ${index + 1}`}
              >
                <ArrowDown size={17} />
              </button>
              <input
                type="range"
                min="-9"
                max="9"
                step="1"
                value={rotor}
                aria-label={`Ajustar rotor ${index + 1}`}
                onChange={(e) => change(index, +e.target.value)}
              />
              <span className="rotor-direction">
                {rotor < 0 ? '← VOLTA' : rotor > 0 ? 'AVANÇA →' : 'REPOUSO'}
              </span>
            </div>
          ))}
        </div>
        <div className="decryption-preview">
          <span className="eyebrow">PRÉVIA DA DECODIFICAÇÃO</span>
          <div aria-live="polite">
            {decoded.map((part, index) => (
              <span key={index} className={part === expected[index] ? 'text-green' : ''}>
                {part.split('').map((letter, i) => (
                  <span key={i} className={letter === expected[index][i] ? 'letter-matched' : ''}>
                    {letter}
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <p className="instrument-footnote">
          Letras circulares: antes de A vem Z. Os acentos foram perdidos na transmissão.
        </p>
      </div>
    </PuzzleControls>
  );
}

const PAD_ICONS = [HeartPulse, Eye, AudioLines, Brain];
function PulsePuzzle(props: PuzzleProps) {
  const { state, dispatch, playSound } = props;
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [activePad, setActivePad] = useState(-1);
  const [playhead, setPlayhead] = useState(-1);
  const [showSequence, setShowSequence] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const entered = state.inputs.pads;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const reproduce = () => {
    if (playing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    dispatch({ type: 'INPUT', patch: { pads: [] } });
    setError('');
    setPlaying(true);
    setPlayhead(-1);
    BIO_SEQUENCE.forEach((pad, index) => {
      timers.current.push(
        setTimeout(
          () => {
            setActivePad(pad);
            setPlayhead(index);
            playSound('pad', pad);
          },
          350 + index * 750,
        ),
      );
      timers.current.push(setTimeout(() => setActivePad(-1), 850 + index * 750));
    });
    timers.current.push(
      setTimeout(
        () => {
          setPlaying(false);
          setPlayhead(-1);
        },
        350 + BIO_SEQUENCE.length * 750,
      ),
    );
  };
  const press = (pad: number) => {
    if (playing) return;
    if (pad !== BIO_SEQUENCE[entered.length]) {
      dispatch({ type: 'INPUT', patch: { pads: [] } });
      dispatch({
        type: 'ATTEMPT',
        id: 'pulse',
        message: 'Assinatura divergente. Reproduza o eco novamente ou use a leitura textual.',
      });
      setError(
        `Era ${PAD_NAMES[BIO_SEQUENCE[entered.length]]}. A sequência recomeçou — você pode tentar novamente.`,
      );
      playSound('error');
      return;
    }
    const next = [...entered, pad];
    dispatch({ type: 'INPUT', patch: { pads: next } });
    setError('');
    playSound('pad', pad);
    if (next.length === BIO_SEQUENCE.length) {
      dispatch({ type: 'SOLVE', id: 'pulse' });
      playSound('success');
    }
  };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector('dialog[open]')
      )
        return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index !== -1) {
        event.preventDefault();
        press(index);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  return (
    <PuzzleControls {...props} id="pulse" error={error} setError={setError}>
      <div className="biometric-panel">
        <div className="panel-instrument-label">
          <span>
            <Fingerprint size={13} /> IDENTIDADE / ECO DE SEIS PULSOS
          </span>
          <span>{playing ? 'REPRODUZINDO' : 'AGUARDANDO OPERADOR'}</span>
        </div>
        <div className="bio-status" aria-live="polite">
          {playing ? (
            <>
              <span className="status-dot" /> Eco {playhead + 1} de 6{' '}
              {playhead >= 0 && `· ${PAD_NAMES[BIO_SEQUENCE[playhead]]}`}
            </>
          ) : (
            <>
              <ScanLine size={16} />{' '}
              {entered.length
                ? `${entered.length} de 6 pulsos confirmados`
                : 'Reproduza o eco. Depois, repita a sequência.'}
            </>
          )}
        </div>
        <div className="bio-pads">
          {PAD_ICONS.map((Icon, index) => (
            <button
              key={index}
              className={`bio-pad pad-${index} ${activePad === index ? 'active' : ''}`}
              onClick={() => press(index)}
              disabled={playing}
              title={`Tecla ${index + 1}`}
            >
              <kbd>{index + 1}</kbd>
              <Icon size={35} strokeWidth={1.3} />
              <strong>{PAD_NAMES[index]}</strong>
              <span>
                {['SINAL CARDÍACO', 'LEITURA RETINAL', 'ASSINATURA VOCAL', 'ONDA CEREBRAL'][index]}
              </span>
            </button>
          ))}
        </div>
        <div
          className="bio-progress"
          role="img"
          aria-label={`${entered.length} de 6 pulsos corretos`}
        >
          {BIO_SEQUENCE.map((_, index) => (
            <span key={index} className={index < entered.length ? 'filled' : ''}>
              {index < entered.length && <Check size={11} />}
            </span>
          ))}
        </div>
        <div className="bio-tools">
          <button
            className="button button-secondary button-small"
            onClick={reproduce}
            disabled={playing}
          >
            <Play size={14} />
            {playing ? 'Observe o eco…' : 'Reproduzir eco'}
          </button>
          <button
            className="text-button"
            aria-pressed={showSequence}
            onClick={() => setShowSequence(!showSequence)}
          >
            <Eye size={15} />
            {showSequence ? 'Ocultar sequência' : 'Ler sequência'}
          </button>
        </div>
        {showSequence && (
          <ol className="sequence-text" aria-label="Sequência biométrica completa">
            {BIO_SEQUENCE.map((pad, index) => (
              <li key={index}>
                <span>{index + 1}</span>
                {PAD_NAMES[pad]}
              </li>
            ))}
          </ol>
        )}
        <p className="instrument-footnote">
          Clique nos sensores ou use as teclas 1–4. Não há limite de tempo para responder.
        </p>
      </div>
    </PuzzleControls>
  );
}

const STARS = Array.from({ length: 66 }, (_, index) => ({
  x: (index * 137.508 + 23) % 600,
  y: (index * 83.731 + 17) % 300,
  r: index % 7 === 0 ? 1.6 : 0.8,
}));
function NavPuzzle(props: PuzzleProps) {
  const { state, dispatch, playSound } = props;
  const [error, setError] = useState('');
  const { azimuth, elevation } = state.inputs;
  const locked = Math.abs(azimuth - 132) <= 2 && Math.abs(elevation - 24) <= 2;
  const x = (azimuth / 360) * 600,
    y = ((60 - elevation) / 120) * 300;
  const targetX = (132 / 360) * 600,
    targetY = ((60 - 24) / 120) * 300;
  const point = (event: PointerEvent<SVGSVGElement>) => {
    if (event.type === 'pointermove' && event.buttons !== 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const az = Math.round(clamp(((event.clientX - bounds.left) / bounds.width) * 360, 0, 359));
    const el = Math.round(
      clamp(60 - ((event.clientY - bounds.top) / bounds.height) * 120, -60, 60),
    );
    dispatch({ type: 'INPUT', patch: { azimuth: az, elevation: el } });
    setError('');
    if (event.type === 'pointerdown') {
      event.currentTarget.setPointerCapture(event.pointerId);
      playSound('click');
    }
  };
  return (
    <PuzzleControls {...props} id="nav" error={error} setError={setError}>
      <div className="navigation-panel">
        <div className="panel-instrument-label">
          <span>OBSERVATÓRIO / MAPA CELESTE</span>
          <span className={locked ? 'text-green' : 'text-amber'}>
            {locked ? 'ALVO NA JANELA' : 'AJUSTE A MIRA'}
          </span>
        </div>
        <svg
          className="star-chart"
          viewBox="0 0 600 300"
          onPointerDown={point}
          onPointerMove={point}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="skyGlow">
              <stop stopColor="#173548" />
              <stop offset="1" stopColor="#0a1520" />
            </radialGradient>
          </defs>
          <rect width="600" height="300" fill="url(#skyGlow)" />
          {[50, 100, 150, 200, 250].map((yy) => (
            <line key={yy} x1="0" x2="600" y1={yy} y2={yy} stroke="#28404e" strokeWidth=".6" />
          ))}
          {[100, 200, 300, 400, 500].map((xx) => (
            <line key={xx} y1="0" y2="300" x1={xx} x2={xx} stroke="#28404e" strokeWidth=".6" />
          ))}
          {STARS.map((star, index) => (
            <circle
              key={index}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#b8d0df"
              opacity={0.3 + (index % 4) * 0.15}
            />
          ))}
          <path d="M-80 355 Q300 130 690 355" fill="#163344" stroke="#365f73" />
          <circle cx="50" cy="38" r="10" fill="#e8b36e" opacity=".8" />
          <circle cx="50" cy="38" r="18" fill="none" stroke="#e8b36e" opacity=".25" />
          <text x="75" y="42" fill="#c7a479" fontSize="9">
            SOL / INTERFERÊNCIA
          </text>
          <line x1={x} x2={x} y1="0" y2="300" stroke="#eeb373" strokeDasharray="3 5" opacity=".4" />
          <line x1="0" x2="600" y1={y} y2={y} stroke="#eeb373" strokeDasharray="3 5" opacity=".4" />
          <circle cx={targetX} cy={targetY} r="5" fill={locked ? '#91d9bc' : '#a5d7e6'} />
          <circle
            cx={targetX}
            cy={targetY}
            r="12"
            fill="none"
            stroke={locked ? '#91d9bc' : '#a5d7e6'}
            opacity=".5"
          />
          <text x={targetX + 19} y={targetY + 4} fill="#a7c6d4" fontSize="9">
            FONTE 03
          </text>
          <g
            className="chart-reticle"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            stroke={locked ? '#91d9bc' : '#efb16c'}
            fill="none"
            strokeWidth="1.5"
          >
            <circle r="19" />
            <path d="M-28 0H-12M12 0H28M0 -28V-12M0 12V28" />
            <circle r="3" fill={locked ? '#91d9bc' : '#efb16c'} />
          </g>
          <text x="12" y="285" fill="#7893a3" fontSize="9">
            0°
          </text>
          <text x="290" y="285" fill="#7893a3" fontSize="9">
            180°
          </text>
          <text x="570" y="285" fill="#7893a3" fontSize="9">
            360°
          </text>
        </svg>
        <div className="nav-readout">
          <span>
            AZIMUTE <output>{azimuth.toString().padStart(3, '0')}°</output>
          </span>
          <span>
            ELEVAÇÃO{' '}
            <output>
              {elevation >= 0 ? '+' : ''}
              {elevation}°
            </output>
          </span>
          <span className={locked ? 'text-green' : ''}>
            {locked ? <Check size={15} /> : <ScanLine size={15} />}{' '}
            {locked ? 'JANELA LIVRE' : 'SEM ALINHAMENTO'}
          </span>
        </div>
      </div>
      <div className="slider-grid">
        <div className="control-group">
          <label htmlFor="azimuth">
            Azimute <span>0° — 359°</span>
          </label>
          <input
            id="azimuth"
            type="range"
            min="0"
            max="359"
            step="1"
            value={azimuth}
            onChange={(e) => dispatch({ type: 'INPUT', patch: { azimuth: +e.target.value } })}
          />
        </div>
        <div className="control-group">
          <label htmlFor="elevation">
            Elevação <span>−60° — +60°</span>
          </label>
          <input
            id="elevation"
            type="range"
            min="-60"
            max="60"
            step="1"
            value={elevation}
            onChange={(e) => dispatch({ type: 'INPUT', patch: { elevation: +e.target.value } })}
          />
        </div>
      </div>
      <p className="instrument-footnote">
        Arraste a mira ou use os controles. Com o teclado, as setas ajustam o controle selecionado.
      </p>
    </PuzzleControls>
  );
}

export function SuccessPanel({ state, dispatch, playSound }: Omit<PuzzleProps, 'reducedMotion'>) {
  const module = MODULES.find((m) => m.id === state.selected)!;
  const next = nextModule(state);
  const nextInfo = MODULES.find((m) => m.id === next);
  return (
    <div className="success-panel">
      <div className="success-orbit">
        <Check size={31} strokeWidth={1.4} />
      </div>
      <span className="eyebrow text-green">SISTEMA {module.number} / RESTAURADO</span>
      <h3>{module.evidenceTitle}</h3>
      <p className="evidence-prose">{module.evidence}</p>
      <div className="evidence-saved">
        <CheckCheck size={15} /> Registro adicionado ao diário de bordo
      </div>
      <div className="next-system">
        <span className="eyebrow">
          {next === 'decision'
            ? 'TODOS OS SISTEMAS ONLINE'
            : `PRÓXIMO SISTEMA · ${nextInfo?.number}`}
        </span>
        <strong>{next === 'decision' ? 'Uma escolha. Três futuros.' : nextInfo?.name}</strong>
      </div>
      <button
        className="button button-primary"
        onClick={() => {
          dispatch({ type: 'SELECT', id: next });
          playSound('click');
        }}
      >
        {next === 'decision' ? 'Abrir canal de resposta' : 'Continuar a investigação'}
        <ArrowRight size={17} />
      </button>
    </div>
  );
}

export function ActivePuzzle(props: PuzzleProps) {
  const module = MODULES.find((m) => m.id === props.state.selected)!;
  const solved = props.state.solved.includes(module.id);
  return (
    <section className={`puzzle-panel ${solved ? 'is-solved' : ''}`} aria-labelledby="puzzle-title">
      <div className="puzzle-heading">
        <div className="puzzle-kw">
          <span className="eyebrow text-amber">SISTEMA {module.number}</span>
          <span>{module.location}</span>
        </div>
        <h2 id="puzzle-title" tabIndex={-1}>
          {module.title}
        </h2>
        {!solved && <p>{module.description}</p>}
      </div>
      {solved ? (
        <SuccessPanel {...props} />
      ) : (
        <div className="puzzle-body">
          {module.id === 'signal' ? (
            <SignalPuzzle {...props} />
          ) : module.id === 'power' ? (
            <PowerPuzzle {...props} />
          ) : module.id === 'archive' ? (
            <ArchivePuzzle {...props} />
          ) : module.id === 'pulse' ? (
            <PulsePuzzle {...props} />
          ) : (
            <NavPuzzle {...props} />
          )}
        </div>
      )}
    </section>
  );
}
