import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Battery,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  RefreshCw,
  Search,
  Terminal,
  Thermometer,
  Wifi,
} from 'lucide-react';
import type { Page, SystemInfo } from '../types';
import { bytes, duration, greeting } from '../format';
import { Badge, Button, IconButton, Loading, Ring, SectionHeading, Sparkline } from './UI';

interface Props {
  system: SystemInfo | null;
  history: number[];
  networkHistory: number[];
  uploadHistory: number[];
  onNavigate: (page: Page) => void;
  onRefresh: () => void;
}
const STATES: Record<string, string> = {
  R: 'Executando',
  S: 'Em espera',
  I: 'Ocioso',
  D: 'I/O',
  Z: 'Zumbi',
  T: 'Pausado',
};
export function Overview({
  system,
  history,
  networkHistory,
  uploadHistory,
  onNavigate,
  onRefresh,
}: Props) {
  const [processQuery, setProcessQuery] = useState('');
  const [sortBy, setSortBy] = useState<'memory' | 'cpu'>('memory');
  const [showAll, setShowAll] = useState(false);
  const processes = useMemo(() => {
    if (!system) return [];
    const q = processQuery.trim().toLowerCase();
    return system.processes
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          String(p.pid).includes(q) ||
          p.user.toLowerCase().includes(q),
      )
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [system, processQuery, sortBy]);
  const visibleProcesses = showAll || processQuery ? processes : processes.slice(0, 8);
  return (
    <div className="page overview-page">
      <SectionHeading
        eyebrow="MONITOR DO SISTEMA"
        title={`${greeting()}.`}
        description="Seu Linux em tempo real. Sem root, sem ruído, sem controle remoto."
        action={
          <Button variant="secondary" onClick={() => onNavigate('pacman')}>
            <Terminal size={16} /> Assistente pacman
          </Button>
        }
      />
      {!system ? (
        <Loading label="Lendo os sensores do Linux…" />
      ) : (
        <>
          <div className="machine-banner">
            <div className="machine-icon">
              <Monitor size={24} strokeWidth={1.5} />
            </div>
            <div className="machine-name">
              <strong>{system.hostname}</strong>
              <span>
                {system.os} <i /> Kernel {system.kernel}
              </span>
            </div>
            <Badge tone={system.isArch ? 'sage' : 'neutral'}>
              {system.isArch ? 'Arch Linux' : 'Linux'}
            </Badge>
            <div className="machine-uptime">
              <span className="status-dot" /> Online há {duration(system.uptimeSeconds)}
            </div>
            <IconButton icon={RefreshCw} label="Atualizar sistema" onClick={onRefresh} />
          </div>
          <div className="metrics-grid">
            <article className="metric-card cpu-card">
              <div className="metric-label">
                <Cpu size={17} />
                <span>Processador</span>
                <span className="metric-live">3 EM 3 S</span>
              </div>
              <div className="metric-main">
                <div>
                  <strong>
                    {system.cpu.percent.toFixed(0)}
                    <small>%</small>
                  </strong>
                  <span>{system.cpu.cores} núcleos disponíveis</span>
                </div>
                <Ring percent={system.cpu.percent} label="Uso do processador" />
              </div>
              <Sparkline values={history} label="Histórico de CPU" />
              <div className="metric-footer">
                <span title={system.cpu.model}>
                  {system.cpu.model.split(' ').slice(0, 4).join(' ')}
                </span>
                <span>últimos {history.length} pontos</span>
              </div>
            </article>
            <article className="metric-card memory-card">
              <div className="metric-label">
                <MemoryStick size={17} />
                <span>Memória</span>
              </div>
              <div className="metric-main">
                <div>
                  <strong>
                    {bytes(system.memory.used, 1).split(' ')[0]}
                    <small>{bytes(system.memory.used).split(' ')[1]}</small>
                  </strong>
                  <span>de {bytes(system.memory.total, 0)} instalados</span>
                </div>
                <Ring percent={system.memory.percent} label="Uso de memória" />
              </div>
              <div className="segmented-meter">
                {Array.from({ length: 28 }, (_, i) => (
                  <i key={i} className={(i / 28) * 100 < system.memory.percent ? 'filled' : ''} />
                ))}
              </div>
              <div className="metric-footer">
                <span>{bytes(system.memory.available)} disponíveis</span>
                <span>{system.memory.percent.toFixed(0)}%</span>
              </div>
            </article>
            <article className="metric-card disk-card">
              <div className="metric-label">
                <HardDrive size={17} />
                <span>Armazenamento</span>
              </div>
              <div className="metric-main">
                <div>
                  <strong>
                    {system.disk.percent.toFixed(0)}
                    <small>%</small>
                  </strong>
                  <span>{bytes(system.disk.free, 0)} livres na partição pessoal</span>
                </div>
                <div className="disk-visual">
                  <HardDrive size={44} strokeWidth={1} />
                </div>
              </div>
              <div className="meter-track">
                <span style={{ width: `${system.disk.percent}%` }} />
              </div>
              <div className="metric-footer">
                <span title={system.disk.mount}>Partição pessoal</span>
                <span>{bytes(system.disk.total, 0)}</span>
              </div>
            </article>
          </div>

          <div className="monitor-details">
            <section className="panel core-panel">
              <div className="panel-heading">
                <h2>
                  <Cpu size={17} /> Núcleos e carga
                </h2>
                <Badge tone="neutral">/proc/stat</Badge>
              </div>
              {system.cpu.perCore.length ? (
                <div className="core-grid">
                  {system.cpu.perCore.map((core, i) => (
                    <div className="core-item" key={core.name}>
                      <div>
                        <span>CPU {i}</span>
                        <strong>{core.percent.toFixed(0)}%</strong>
                      </div>
                      <div className="meter-track">
                        <span style={{ width: `${core.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">
                  Este kernel não expôs núcleos individuais em /proc/stat.
                </p>
              )}
              <div className="load-row">
                <span>Carga média</span>
                {system.cpu.load.length ? (
                  <strong>
                    {system.cpu.load.map((v) => v.toFixed(2).replace('.', ',')).join(' · ')}
                  </strong>
                ) : (
                  <strong>Indisponível</strong>
                )}
                <small>1 · 5 · 15 min</small>
              </div>
              <div className="memory-extra">
                <span>
                  Swap:{' '}
                  {system.memory.swapTotal
                    ? `${bytes(system.memory.swapUsed)} / ${bytes(system.memory.swapTotal)} (${system.memory.swapPercent.toFixed(0)}%)`
                    : 'não configurado'}
                </span>
                <span>Cache + buffers: {bytes(system.memory.cached + system.memory.buffers)}</span>
              </div>
            </section>
            <section className="panel network-card">
              <div className="panel-heading">
                <h2>
                  <Wifi size={17} /> Rede
                </h2>
                <Badge tone="neutral">Sessão atual</Badge>
              </div>
              <div className="network-rates">
                <div>
                  <ArrowDown size={16} />
                  <strong>{bytes(networkHistory.at(-1) || 0)}/s</strong>
                  <span>download</span>
                </div>
                <div>
                  <ArrowUp size={16} />
                  <strong>{bytes(uploadHistory.at(-1) || 0)}/s</strong>
                  <span>upload</span>
                </div>
              </div>
              <Sparkline
                values={networkHistory}
                max={Math.max(1024, ...networkHistory) * 1.2}
                label="Histórico de download"
              />
              <div className="network-total">
                <span>Total recebido</span>
                <strong>{bytes(system.network.rx)}</strong>
              </div>
              <div className="network-total">
                <span>Interfaces</span>
                <strong>
                  {system.network.interfaces.map((i) => i.name).join(', ') || 'Nenhuma detectada'}
                </strong>
              </div>
            </section>
          </div>

          {(system.disks.length > 0 ||
            system.temperatures.length > 0 ||
            system.batteries.length > 0) && (
            <div className="sensor-grid">
              {system.disks.length > 0 && (
                <section className="panel sensor-panel">
                  <div className="panel-heading">
                    <h2>
                      <HardDrive size={17} /> Pontos de montagem
                    </h2>
                  </div>
                  <div className="disk-list">
                    {system.disks.map((disk) => (
                      <div key={disk.mount}>
                        <div className="disk-list-label">
                          <code title={disk.mount}>{disk.mount}</code>
                          <span>
                            {disk.fstype} · {bytes(disk.free)} livres
                          </span>
                        </div>
                        <div className="meter-track">
                          <span style={{ width: `${disk.percent}%` }} />
                        </div>
                        <small>
                          {disk.percent.toFixed(0)}% de {bytes(disk.total, 0)}
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {system.temperatures.length > 0 && (
                <section className="panel sensor-panel">
                  <div className="panel-heading">
                    <h2>
                      <Thermometer size={17} /> Temperatura
                    </h2>
                  </div>
                  <div className="sensor-list">
                    {system.temperatures.map((sensor, i) => (
                      <div key={`${sensor.label}-${i}`}>
                        <span>{sensor.label}</span>
                        <strong>{sensor.celsius.toFixed(1).replace('.', ',')} °C</strong>
                      </div>
                    ))}
                  </div>
                  <p className="input-help">
                    Sensores expostos pelo kernel; a disponibilidade varia conforme o hardware.
                  </p>
                </section>
              )}
              {system.batteries.length > 0 && (
                <section className="panel sensor-panel">
                  <div className="panel-heading">
                    <h2>
                      <Battery size={17} /> Bateria
                    </h2>
                  </div>
                  <div className="sensor-list">
                    {system.batteries.map((battery) => (
                      <div key={battery.name}>
                        <span>
                          {battery.name} · {battery.status || 'estado não informado'}
                        </span>
                        <strong>{battery.percent}%</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          <section className="panel process-panel">
            <div className="panel-heading">
              <div>
                <h2>
                  <Activity size={17} /> Processos
                </h2>
                <p>Até 80 processos lidos de /proc. O NEXO observa; não encerra processos.</p>
              </div>
              <div className="process-sort" role="group" aria-label="Ordenar processos">
                <button
                  aria-pressed={sortBy === 'memory'}
                  className={sortBy === 'memory' ? 'selected' : ''}
                  onClick={() => setSortBy('memory')}
                >
                  Memória
                </button>
                <button
                  aria-pressed={sortBy === 'cpu'}
                  className={sortBy === 'cpu' ? 'selected' : ''}
                  onClick={() => setSortBy('cpu')}
                >
                  CPU
                </button>
              </div>
            </div>
            <div className="search-field process-search">
              <Search size={16} />
              <input
                aria-label="Buscar processos"
                placeholder="Nome, PID ou usuário…"
                value={processQuery}
                onChange={(e) => setProcessQuery(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Processo</th>
                    <th>PID</th>
                    <th>Usuário</th>
                    <th>Estado</th>
                    <th>CPU*</th>
                    <th>Memória residente</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProcesses.map((process) => (
                    <tr key={process.pid}>
                      <td>
                        <span className="process-dot" />
                        {process.name}
                      </td>
                      <td className="mono">{process.pid}</td>
                      <td>{process.user || '—'}</td>
                      <td>
                        <Badge tone="neutral">{STATES[process.state] || process.state}</Badge>
                      </td>
                      <td className="mono">{process.cpu.toFixed(1).replace('.', ',')}%</td>
                      <td className="mono">{bytes(process.memory)}</td>
                    </tr>
                  ))}
                  {!visibleProcesses.length && (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        Nenhum processo corresponde à busca.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="process-footer">
              <small>
                * CPU por processo pode passar de 100% em múltiplos núcleos. A primeira leitura não
                tem intervalo de comparação.
              </small>
              {!processQuery && processes.length > 8 && (
                <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Mostrar menos' : `Ver todos (${processes.length})`}{' '}
                  <ArrowUpRight size={13} />
                </Button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
