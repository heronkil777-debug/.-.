import { useEffect, useRef } from 'react';
import {
  Check,
  LockKeyhole,
  Radio,
  Zap,
  Database,
  Fingerprint,
  Orbit,
  ArrowUpRight,
} from 'lucide-react';
import { MODULES, isUnlocked, type GameState, type ModuleId, type ViewId } from '../game';

export const MODULE_ICONS = {
  signal: Radio,
  power: Zap,
  archive: Database,
  pulse: Fingerprint,
  nav: Orbit,
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <Orbit strokeWidth={1.25} />
      </span>
      <span>
        ÚLTIMO SINAL<span className="brand-sub">UMA EXPERIÊNCIA ORBITAL</span>
      </span>
    </span>
  );
}

export function Waveform({
  quality,
  reducedMotion,
  large = false,
}: {
  quality: number;
  reducedMotion: boolean;
  large?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let frame = 0;
    let width = 600,
      height = 160;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(123,163,180,.09)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const noise = 1 - quality / 100;
      const t = reducedMotion ? 0 : time / 1100;
      const color = quality > 90 ? '#87d6bc' : '#efb16c';
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = color;
      ctx.shadowBlur = reducedMotion ? 0 : 9;
      ctx.shadowColor = color;
      for (let x = 0; x <= width; x += 1.5) {
        const envelope = Math.sin((x / width) * Math.PI) ** 0.45;
        const coherent = Math.sin(x * 0.077 + t * 3) * (12 + quality * 0.24);
        const staticWave =
          (Math.sin(x * 1.73 + t * 7) +
            Math.sin(x * 0.91 - t * 5) * 0.6 +
            Math.cos(x * 2.93 + t * 11) * 0.5) *
          noise *
          height *
          0.2;
        const y = height / 2 + (coherent * (0.3 + quality / 140) + staticWave) * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!reducedMotion) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(0);
    });
    observer.observe(canvas);
    resize();
    draw(0);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [quality, reducedMotion]);
  return (
    <canvas
      ref={ref}
      className={`waveform ${large ? 'waveform-large' : ''}`}
      role="img"
      aria-label={`Forma de onda da transmissão. Coerência do sinal: ${quality} por cento.`}
    />
  );
}

const nodePositions: Record<ModuleId, [number, number]> = {
  signal: [21, 27],
  power: [76, 23],
  archive: [84, 53],
  pulse: [24, 73],
  nav: [72, 76],
};

export function StationMap({
  state,
  onSelect,
  reducedMotion,
}: {
  state: GameState;
  onSelect: (id: ViewId) => void;
  reducedMotion: boolean;
}) {
  return (
    <div className={`station-map ${reducedMotion ? 'still' : ''}`}>
      <div className="map-grid" />
      <svg className="station-blueprint" viewBox="0 0 320 290" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="coreGlow">
            <stop stopColor="#edb373" stopOpacity=".18" />
            <stop offset="1" stopColor="#edb373" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="160" cy="143" r="110" fill="url(#coreGlow)" />
        <circle cx="160" cy="143" r="105" stroke="#344957" strokeDasharray="2 8" />
        <circle cx="160" cy="143" r="76" stroke="#344957" strokeWidth="9" opacity=".3" />
        <circle cx="160" cy="143" r="76" stroke="#617d8c" strokeWidth="1" />
        <circle cx="160" cy="143" r="65" stroke="#456170" strokeWidth=".5" />
        <g className="station-ring">
          <circle
            cx="160"
            cy="143"
            r="92"
            stroke="#bc956a"
            strokeWidth="1.5"
            strokeDasharray="65 230 20 263"
          />
          <circle cx="160" cy="51" r="3" fill="#edb373" />
        </g>
        <path
          d="M68 78L115 110M242 66L202 110M268 154H211M76 211L121 175M231 220L195 183"
          stroke="#647e8a"
          strokeWidth="2"
        />
        <path d="M160 67V115M160 171V219M84 143H132M188 143H236" stroke="#8095a0" strokeWidth="5" />
        <path
          d="M125 115L143 101H177L195 119V165L177 184H143L125 166Z"
          fill="#11232e"
          stroke="#91a3ab"
        />
        <rect x="140" y="120" width="40" height="44" rx="3" fill="#1b303b" stroke="#b49774" />
        <path
          d="M151 130H169M151 136H169M151 142H169M151 154H161"
          stroke="#d9b283"
          strokeWidth="1.5"
        />
        <path d="M135 45H185V61H135ZM135 225H185V241H135Z" fill="#142a38" stroke="#537383" />
        <path
          d="M145 45V61M155 45V61M165 45V61M175 45V61M145 225V241M155 225V241M165 225V241M175 225V241"
          stroke="#537383"
        />
        <path d="M14 143H34M286 143H306M160 5V25M160 264V284" stroke="#668493" />
        <circle cx="160" cy="143" r="3" fill="#efb16c" />
      </svg>
      {MODULES.map((module) => {
        const Icon = MODULE_ICONS[module.id];
        const done = state.solved.includes(module.id),
          unlocked = isUnlocked(state, module.id);
        const [left, top] = nodePositions[module.id];
        return (
          <button
            key={module.id}
            className={`map-node ${done ? 'done' : ''} ${state.selected === module.id ? 'selected' : ''}`}
            style={{ left: `${left}%`, top: `${top}%` }}
            onClick={() => onSelect(module.id)}
            aria-label={`${module.name}: ${done ? 'restaurado' : unlocked ? 'disponível' : 'bloqueado'}`}
            title={
              unlocked
                ? module.name
                : `Restaure ${MODULES[state.solved.length]?.short ?? 'a estação'} primeiro`
            }
          >
            {done ? <Check size={15} /> : unlocked ? <Icon size={15} /> : <LockKeyhole size={12} />}
          </button>
        );
      })}
      <span className="map-coordinate coord-a">AZ 132.00</span>
      <span className="map-coordinate coord-b">ALT 408 KM</span>
      <div className="map-core-label">
        ÍRIS–9<span>{state.solved.length === 5 ? 'SISTEMAS ONLINE' : 'MODO EMERGÊNCIA'}</span>
      </div>
    </div>
  );
}

export function EarthView({
  state,
  onSelect,
  reducedMotion,
}: {
  state: GameState;
  onSelect: (id: ViewId) => void;
  reducedMotion: boolean;
}) {
  return (
    <div className="earth-view">
      <img
        src="/assets/orbital-earth.webp"
        alt="A estação Íris orbita a Terra, iluminada pelo nascer do sol."
      />
      <div className="earth-vignette" />
      <div className="earth-crosshair">
        <span />
        <span />
      </div>
      <div className="earth-telemetry">
        <span className="eyebrow">TELEMETRIA · TEMPO REAL</span>
        <strong>
          408<span> km</span>
        </strong>
        <span>ALTITUDE ORBITAL</span>
      </div>
      <div className="earth-station-label">
        <span className="status-dot" /> ÍRIS–9 <span>46°21′ N / 03°17′ E</span>
      </div>
      <button
        className="earth-decision"
        onClick={() => onSelect('decision')}
        disabled={!isUnlocked(state, 'decision')}
      >
        {isUnlocked(state, 'decision') ? <Radio size={16} /> : <LockKeyhole size={15} />} Canal de
        resposta <ArrowUpRight size={15} />
      </button>
      <div className={`orbital-scan ${reducedMotion ? 'still' : ''}`} />
    </div>
  );
}
