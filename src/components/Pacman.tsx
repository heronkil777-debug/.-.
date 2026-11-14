import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileSearch,
  Info,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../api';
import type { CommandResult, Package as Pkg, PackageInfo, PacmanInsights } from '../types';
import { bytes, relativeDate } from '../format';
import { Badge, Button, EmptyState, Loading, Modal, SectionHeading } from './UI';

type Action =
  | 'update'
  | 'search'
  | 'info'
  | 'install'
  | 'remove'
  | 'orphans'
  | 'updates'
  | 'files'
  | 'clean-cache';
const ACTIONS: { id: Action; label: string; icon: typeof Package; needsPackage: boolean }[] = [
  { id: 'update', label: 'Atualizar sistema', icon: RefreshCw, needsPackage: false },
  { id: 'install', label: 'Instalar pacote', icon: Package, needsPackage: true },
  { id: 'search', label: 'Buscar pacote', icon: Search, needsPackage: true },
  { id: 'info', label: 'Ver informações', icon: Info, needsPackage: true },
  { id: 'remove', label: 'Remover pacote', icon: Trash2, needsPackage: true },
  { id: 'orphans', label: 'Listar órfãos', icon: FileSearch, needsPackage: false },
  { id: 'updates', label: 'Listar atualizações', icon: Download, needsPackage: false },
  { id: 'files', label: 'Arquivos do pacote', icon: FileSearch, needsPackage: true },
  { id: 'clean-cache', label: 'Limpar cache', icon: Trash2, needsPackage: false },
];
const FIELD_LABELS: Record<string, string> = {
  Name: 'Nome',
  Version: 'Versão',
  Description: 'Descrição',
  Architecture: 'Arquitetura',
  URL: 'Site',
  Licenses: 'Licenças',
  'Installed Size': 'Tamanho instalado',
  'Install Date': 'Data de instalação',
  'Install Reason': 'Motivo da instalação',
  'Required By': 'Necessário para',
  'Depends On': 'Dependências',
  Packager: 'Empacotador',
};
export function Pacman({ notify }: { notify: (m: string) => void }) {
  const [action, setAction] = useState<Action>('update');
  const [pkg, setPkg] = useState('');
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [total, setTotal] = useState(0);
  const [insights, setInsights] = useState<PacmanInsights | null>(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const [details, setDetails] = useState<PackageInfo | null>(null);
  const [detailsBusy, setDetailsBusy] = useState('');
  const [showUpdates, setShowUpdates] = useState(false);
  const refreshInsights = useCallback(async () => {
    setInsightsBusy(true);
    try {
      setInsights(await api.pacmanInsights());
    } catch (e) {
      setInsights({ available: false, message: (e as Error).message });
    } finally {
      setInsightsBusy(false);
    }
  }, []);
  useEffect(() => {
    void refreshInsights();
  }, [refreshInsights]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const data = await api.packages(query);
          if (!active) return;
          setPackages(data.packages);
          setAvailable(data.available);
          setMessage(data.message);
          setTotal(data.total);
        } catch (e) {
          if (active) setMessage((e as Error).message);
        } finally {
          if (active) setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);
  useEffect(() => {
    setResult(null);
    setError('');
    setManualCopy(false);
    setCopied(false);
  }, [action, pkg]);
  const selected = ACTIONS.find((a) => a.id === action)!;
  const generate = async () => {
    setBusy(true);
    setError('');
    setCopied(false);
    setManualCopy(false);
    try {
      setResult(await api.command(action, pkg));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choosePackage = (name: string, nextAction: Action = 'info') => {
    setPkg(name);
    setAction(nextAction);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openDetails = async (name: string) => {
    setDetailsBusy(name);
    try {
      setDetails(await api.pacmanPackage(name));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setDetailsBusy('');
    }
  };
  const copyCommand = async () => {
    if (!result) return;
    const mode = await api.copyText(result.command);
    if (mode === 'clipboard') {
      setCopied(true);
      notify('Comando copiado. Cole no terminal e revise antes de executar.');
    } else {
      setManualCopy(true);
      notify('O navegador bloqueou a cópia. Selecione o comando no campo e copie manualmente.');
    }
  };
  return (
    <div className="page pacman-page">
      <SectionHeading
        eyebrow="ASSISTENTE PACMAN"
        title="Assistente pacman."
        description="Escolha a intenção. Entenda o comando. Você decide quando executar."
        action={
          <Badge tone="sage">
            <ShieldCheck size={13} /> Nunca executa por você
          </Badge>
        }
      />

      {insights?.available && (
        <section className="pacman-insights" aria-label="Diagnóstico do pacman">
          <div className="insight-card">
            <span>Instalados</span>
            <strong>{insights.installed?.toLocaleString('pt-BR') ?? '—'}</strong>
            <small>pacman -Q</small>
          </div>
          <div className="insight-card">
            <span>Atualizações*</span>
            <strong>{insights.updateCount?.toLocaleString('pt-BR') ?? '—'}</strong>
            <button className="text-link" onClick={() => setShowUpdates(!showUpdates)}>
              {showUpdates ? 'Ocultar lista' : 'Ver lista'} <ArrowRight size={12} />
            </button>
          </div>
          <div className="insight-card">
            <span>Órfãos</span>
            <strong>{insights.orphanCount?.toLocaleString('pt-BR') ?? '—'}</strong>
            <button className="text-link" onClick={() => choosePackage('', 'orphans')}>
              Preparar consulta <ArrowRight size={12} />
            </button>
          </div>
          <div className="insight-card">
            <span>Cache de pacotes</span>
            <strong>{bytes(insights.cacheBytes || 0)}</strong>
            <small>{insights.cacheFiles || 0} arquivos · /var/cache/pacman/pkg</small>
          </div>
          <div className="insights-footer">
            <span>
              * Banco local sincronizado
              {insights.lastSync ? ` ${relativeDate(insights.lastSync)}` : ''}; não é uma consulta
              aos repositórios.{' '}
              {insights.foreignCount != null && `${insights.foreignCount} pacotes foreign/AUR.`}
            </span>
            <Button variant="ghost" disabled={insightsBusy} onClick={() => void refreshInsights()}>
              <RefreshCw size={14} /> {insightsBusy ? 'Consultando…' : 'Atualizar diagnóstico'}
            </Button>
          </div>
          {insights.message && (
            <p className="inline-error" role="alert">
              {insights.message}
            </p>
          )}
          {showUpdates && (
            <div className="update-list">
              {insights.updates?.length ? (
                insights.updates.map((u) => (
                  <div key={u.name}>
                    <button className="package-name" onClick={() => choosePackage(u.name)}>
                      {u.name}
                    </button>
                    <code>
                      {u.from} → {u.to}
                    </code>
                  </div>
                ))
              ) : (
                <p className="muted small">
                  Nenhuma atualização listada no banco local. Para sincronizar, prepare o comando de
                  atualização completa abaixo.
                </p>
              )}
              {insights.updateCount != null && insights.updateCount > 100 && (
                <small>Exibindo 100 de {insights.updateCount}.</small>
              )}
            </div>
          )}
          {!!insights.orphans?.length && (
            <details className="orphan-details">
              <summary>Ver nomes dos {insights.orphans.length} órfãos</summary>
              <div className="orphan-list">
                {insights.orphans.map((name) => (
                  <button
                    key={name}
                    className="package-name"
                    onClick={() => void openDetails(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="input-help">
                Órfão não significa lixo. Confira se ainda precisa do pacote antes de remover.
              </p>
            </details>
          )}
        </section>
      )}
      {insights && !insights.available && insights.message && (
        <p className="pacman-unavailable">
          <Info size={16} /> {insights.message} O assistente abaixo continua disponível.
        </p>
      )}

      <div className="pacman-workspace">
        <section className="panel command-builder">
          <div className="panel-heading">
            <h2>
              <Terminal size={18} /> O que você quer fazer?
            </h2>
            <span className="step-label">01</span>
          </div>
          <div className="action-options" role="group" aria-label="Ação do pacman">
            {ACTIONS.map((a) => (
              <button
                key={a.id}
                className={action === a.id ? 'selected' : ''}
                aria-pressed={action === a.id}
                onClick={() => setAction(a.id)}
              >
                <a.icon size={17} />
                {a.label}
                {action === a.id && <Check size={14} />}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
          >
            {selected.needsPackage && (
              <div className="package-input-wrap">
                <label className="field-label" htmlFor="package-name">
                  Nome exato do pacote
                </label>
                <input
                  id="package-name"
                  className="text-input mono"
                  placeholder="ex.: firefox, git, linux-lts"
                  maxLength={200}
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                />
                <p className="input-help">
                  Somente letras, números e @ . _ + -. Sem opções de terminal.
                </p>
              </div>
            )}
            <Button type="submit" disabled={busy || (selected.needsPackage && !pkg.trim())}>
              {busy ? 'Preparando…' : 'Gerar comando'} <ArrowRight size={16} />
            </Button>
          </form>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className={`command-output ${result ? 'has-result' : ''}`} aria-live="polite">
            <div className="terminal-top">
              <span className="terminal-dots">
                <i />
                <i />
                <i />
              </span>
              <span>seu-terminal</span>
              <Badge tone="neutral">Prévia</Badge>
            </div>
            {result ? (
              <>
                <code>
                  <span className="terminal-prompt">$ </span>
                  {result.command}
                </code>
                <div className="command-explanation">
                  <Info size={16} />
                  <p>{result.description}</p>
                </div>
                {result.privileged && (
                  <div className="sudo-note">
                    <TriangleAlert size={14} /> Pede senha de administrador no terminal.
                  </div>
                )}
                {manualCopy && (
                  <textarea
                    className="manual-copy mono"
                    aria-label="Comando para copiar manualmente"
                    readOnly
                    value={result.command}
                    onFocus={(e) => e.target.select()}
                    autoFocus
                  />
                )}
                <Button variant="secondary" onClick={() => void copyCommand()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied ? 'Comando copiado' : 'Copiar comando'}
                </Button>
              </>
            ) : (
              <div className="terminal-placeholder">
                <Terminal size={29} strokeWidth={1} />
                <span>O comando aparece aqui.</span>
                <small>Nada é executado no seu sistema.</small>
              </div>
            )}
          </div>
        </section>
        <aside className="pacman-guide">
          <span className="guide-icon">
            <ShieldCheck size={28} strokeWidth={1.4} />
          </span>
          <span className="eyebrow">CONFIANÇA COM CONTROLE</span>
          <h2>
            Uma ponte para o terminal.
            <br />
            Não um piloto automático.
          </h2>
          <p>
            O NEXO monta comandos com argumentos separados e valida o nome do pacote. Não existe
            endpoint para executar comandos arbitrários.
          </p>
          <ol>
            <li>
              <span>1</span>
              <div>
                <strong>Escolha e revise</strong>
                <p>Confira o pacote e o efeito do comando.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Copie para o terminal</strong>
                <p>Seu terminal continua sendo seu.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Leia antes de confirmar</strong>
                <p>Especialmente ao atualizar ou remover.</p>
              </div>
            </li>
          </ol>
          <div className="guide-warning">
            <TriangleAlert size={17} />
            <p>
              Atualizações parciais não são suportadas pelo Arch. Prefira <code>pacman -Syu</code> e
              confira as notícias do Arch antes de grandes atualizações.
            </p>
          </div>
        </aside>
      </div>

      <section className="panel installed-packages">
        <div className="panel-heading">
          <div>
            <h2>
              <Package size={18} />{' '}
              {available ? 'Já instalado na sua máquina' : 'Banco de pacotes local'}
            </h2>
            {available && (
              <p>{total.toLocaleString('pt-BR')} pacotes encontrados · exibindo até 100</p>
            )}
          </div>
          <Badge tone={available ? 'sage' : 'neutral'}>
            {available ? 'pacman disponível' : 'Fora do Arch'}
          </Badge>
        </div>
        <div className="package-search search-field">
          <Search size={16} />
          <input
            aria-label="Buscar pacotes instalados"
            placeholder="Buscar por nome ou descrição…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {loading ? (
          <Loading label="Consultando banco local…" />
        ) : !available ? (
          <EmptyState icon={Package} title="O pacman mora no seu Arch.">
            {message} O assistente de comandos acima continua disponível para você copiar e usar na
            sua máquina.
          </EmptyState>
        ) : packages.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pacote</th>
                  <th>Versão</th>
                  <th>Descrição</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.name}>
                    <td>
                      <button className="package-name" onClick={() => void openDetails(p.name)}>
                        {p.name}
                      </button>
                    </td>
                    <td className="mono">{p.version}</td>
                    <td className="package-description">{p.description || 'Pacote instalado'}</td>
                    <td>
                      <Button variant="ghost" onClick={() => choosePackage(p.name)}>
                        Usar <ArrowRight size={13} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Search} title="Nenhum pacote encontrado.">
            Tente outro nome ou parte da descrição.
          </EmptyState>
        )}
      </section>

      {details && (
        <Modal
          title={details.name || 'Detalhes do pacote'}
          subtitle="Consulta local · pacman -Qi · somente leitura"
          onClose={() => setDetails(null)}
          wide
        >
          {details.found && details.fields ? (
            <dl className="package-detail-list">
              {Object.entries(details.fields).map(([key, value]) => (
                <div key={key}>
                  <dt>{FIELD_LABELS[key] || key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">{details.message}</p>
          )}
          {detailsBusy && <Loading label="Consultando…" />}
        </Modal>
      )}
    </div>
  );
}
