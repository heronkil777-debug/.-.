import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Info,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { api, copyText } from '../api';
import type { CommandResult, Package as Pkg } from '../types';
import { Badge, Button, EmptyState, Loading, SectionHeading } from './UI';

type Action = 'update' | 'search' | 'info' | 'install' | 'remove' | 'orphans';
const ACTIONS: { id: Action; label: string; icon: typeof Package; needsPackage: boolean }[] = [
  { id: 'update', label: 'Atualizar sistema', icon: RefreshCw, needsPackage: false },
  { id: 'install', label: 'Instalar pacote', icon: Package, needsPackage: true },
  { id: 'search', label: 'Buscar pacote', icon: Search, needsPackage: true },
  { id: 'info', label: 'Ver informações', icon: Info, needsPackage: true },
  { id: 'remove', label: 'Remover pacote', icon: Trash2, needsPackage: true },
  { id: 'orphans', label: 'Listar órfãos', icon: Search, needsPackage: false },
];
export function Pacman({
  initialPackage = '',
  notify,
}: {
  initialPackage?: string;
  notify: (m: string) => void;
}) {
  const [action, setAction] = useState<Action>(initialPackage ? 'info' : 'update');
  const [pkg, setPkg] = useState(initialPackage);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const timer = setTimeout(
      async () => {
        setLoading(true);
        try {
          const data = await api.packages(query);
          setPackages(data.packages);
          setAvailable(data.available);
          setMessage(data.message);
          setTotal(data.total);
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setLoading(false);
        }
      },
      query ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    setResult(null);
    setError('');
  }, [action, pkg]);
  const selected = ACTIONS.find((a) => a.id === action)!;
  const generate = async () => {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      setResult(await api.command(action, pkg));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page pacman-page">
      <SectionHeading
        eyebrow="SEU TERMINAL, COM UM POUCO DE CLAREZA"
        title="Assistente pacman."
        description="Escolha a intenção. Entenda o comando. Você decide quando executar."
        action={
          <Badge tone="sage">
            <ShieldCheck size={13} /> Nunca executa por você
          </Badge>
        }
      />
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
                  placeholder="ex.: firefox, git, wl-clipboard"
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
              Gerar comando <ArrowRight size={16} />
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
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await copyText(result.command);
                      setCopied(true);
                      notify('Comando copiado. Cole no terminal e revise antes de executar.');
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
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
                      <button
                        className="package-name"
                        onClick={() => {
                          setPkg(p.name);
                          setAction('info');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="mono">{p.version}</td>
                    <td className="package-description">{p.description || 'Pacote instalado'}</td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setPkg(p.name);
                          setAction('info');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Info <ArrowRight size={13} />
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
    </div>
  );
}
