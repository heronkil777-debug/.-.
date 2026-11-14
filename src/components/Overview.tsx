import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Clipboard,
  Cpu,
  HardDrive,
  MemoryStick,
  Monitor,
  NotebookPen,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Wifi,
} from 'lucide-react';
import type { Clip, Note, Page, SystemInfo } from '../types';
import { bytes, duration, greeting, relativeDate } from '../format';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Loading,
  Ring,
  SectionHeading,
  Sparkline,
  TextLink,
} from './UI';

interface Props {
  system: SystemInfo | null;
  history: number[];
  networkHistory: number[];
  uploadHistory: number[];
  notes: Note[];
  clips: Clip[];
  onNavigate: (page: Page) => void;
  onNewNote: () => void;
  onOpenNote: (note: Note) => void;
  onRefresh: () => void;
  onCommand: () => void;
}
export function Overview({
  system,
  history,
  networkHistory,
  uploadHistory,
  notes,
  clips,
  onNavigate,
  onNewNote,
  onOpenNote,
  onRefresh,
  onCommand,
}: Props) {
  return (
    <div className="page overview-page">
      <SectionHeading
        eyebrow="SEU ESPAÇO, SEM RUÍDO"
        title={`${greeting()}.`}
        description="Um olhar para a máquina. Um lugar para as suas ideias."
        action={
          <Button variant="secondary" onClick={onNewNote}>
            <Plus size={16} /> Nova nota <kbd>N</kbd>
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
                <span className="metric-live">AO VIVO</span>
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
                <span>agora</span>
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
                  <span>{bytes(system.disk.free, 0)} livres para você</span>
                </div>
                <div className="disk-visual">
                  <HardDrive size={44} strokeWidth={1} />
                </div>
              </div>
              <div className="meter-track">
                <span style={{ width: `${system.disk.percent}%` }} />
              </div>
              <div className="metric-footer">
                <span>Partição pessoal</span>
                <span>{bytes(system.disk.total, 0)}</span>
              </div>
            </article>
          </div>
          <div className="overview-middle">
            <section className="panel recent-notes">
              <div className="panel-heading">
                <h2>
                  <NotebookPen size={17} /> À mão
                </h2>
                <TextLink onClick={() => onNavigate('notes')}>Todas as notas</TextLink>
              </div>
              {notes.length ? (
                <div className="recent-note-list">
                  {notes.slice(0, 3).map((note) => (
                    <button className="recent-note" key={note.id} onClick={() => onOpenNote(note)}>
                      <span className={`note-dot color-${note.color}`} />
                      <span>
                        <strong>{note.title}</strong>
                        <span>{note.body.slice(0, 90) || 'Uma ideia esperando para crescer.'}</span>
                      </span>
                      <time>{relativeDate(note.updated)}</time>
                      <ArrowUpRight size={15} />
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={NotebookPen}
                  title="Tire uma ideia da cabeça."
                  action={
                    <Button variant="secondary" onClick={onNewNote}>
                      <Plus size={15} /> Criar primeira nota
                    </Button>
                  }
                >
                  Comandos, lembretes, aquele trecho de código. Tudo fica aqui, no seu computador.
                </EmptyState>
              )}
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
                  {system.network.interfaces.map((i) => i.name).join(', ') || 'Nenhuma ativa'}
                </strong>
              </div>
            </section>
          </div>
          <div className="overview-bottom">
            <section className="panel quick-actions">
              <div className="panel-heading">
                <h2>
                  <Activity size={17} /> Menos cliques, mais fluxo
                </h2>
              </div>
              <div className="quick-action-grid">
                <button onClick={onCommand}>
                  <span className="quick-icon">
                    <Terminal size={20} />
                  </span>
                  <span>
                    <strong>Assistente pacman</strong>
                    <span>O comando certo, sem executar nada.</span>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => onNavigate('clipboard')}>
                  <span className="quick-icon blue">
                    <Clipboard size={20} />
                  </span>
                  <span>
                    <strong>Área de transferência</strong>
                    <span>
                      {clips.length
                        ? `${clips.length} textos guardados localmente.`
                        : 'Seu histórico, somente quando você permitir.'}
                    </span>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
                <button onClick={() => onNavigate('pacman')}>
                  <span className="quick-icon sand">
                    <Package size={20} />
                  </span>
                  <span>
                    <strong>Explorar pacotes</strong>
                    <span>Encontre o que já está instalado.</span>
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
            <section className="privacy-card">
              <ShieldCheck size={25} strokeWidth={1.4} />
              <h2>
                Seu computador.
                <br />
                Seus dados. Só isso.
              </h2>
              <p>Sem conta, sem nuvem, sem analytics. O NEXO fala apenas com o serviço local.</p>
              <button className="text-link" onClick={() => onNavigate('settings')}>
                Ver privacidade <ChevronRightSmall />
              </button>
            </section>
          </div>
          <section className="panel process-panel">
            <div className="panel-heading">
              <h2>
                <Cpu size={17} /> Quem está usando memória
              </h2>
              <span className="muted small">Leitura de /proc · sem permissões elevadas</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Processo</th>
                    <th>PID</th>
                    <th>Estado</th>
                    <th>Memória residente</th>
                  </tr>
                </thead>
                <tbody>
                  {system.processes.slice(0, 5).map((process) => (
                    <tr key={process.pid}>
                      <td>
                        <span className="process-dot" />
                        {process.name}
                      </td>
                      <td className="mono">{process.pid}</td>
                      <td>
                        <Badge tone="neutral">
                          {(
                            {
                              R: 'Executando',
                              S: 'Em espera',
                              I: 'Ocioso',
                              D: 'I/O',
                              Z: 'Zumbi',
                              T: 'Pausado',
                            } as Record<string, string>
                          )[process.state] || process.state}
                        </Badge>
                      </td>
                      <td className="mono">{bytes(process.memory)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function ChevronRightSmall() {
  return <ArrowUpRight size={14} />;
}
