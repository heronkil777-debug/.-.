import { useState } from 'react';
import {
  Check,
  ChevronRight,
  Download,
  HardDrive,
  Keyboard,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { api, downloadJson } from '../api';
import type { Capabilities, Session, SystemInfo } from '../types';
import { bytes } from '../format';
import { Badge, Button, Modal, SectionHeading } from './UI';

export function Settings({
  session,
  capabilities,
  system,
  notify,
  onShortcuts,
}: {
  session: Session | null;
  capabilities: Capabilities | null;
  system: SystemInfo | null;
  notify: (m: string) => void;
  onShortcuts: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [about, setAbout] = useState(false);
  const exportSnapshot = async () => {
    setExporting(true);
    try {
      downloadJson(
        await api.snapshotExport(),
        `nexo-diagnostico-${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify(
        'Diagnóstico exportado. Ele contém hostname, processos e dados de pacotes; revise antes de compartilhar.',
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="page settings-page">
      <SectionHeading
        eyebrow="TRANSPARÊNCIA, POR PADRÃO"
        title="Do seu jeito. No seu Linux."
        description="Sistema e pacman. Tudo o que o NEXO faz — e tudo o que ele não faz."
        action={
          <Badge tone="sage">
            <LockKeyhole size={13} /> Local por natureza
          </Badge>
        }
      />
      {session?.preview && (
        <div className="environment-notice">
          <Monitor size={20} />
          <div>
            <strong>Você está explorando uma prévia hospedada.</strong>
            <p>
              Os sensores mostram a máquina Debian do sandbox, não o seu Arch. Na instalação local,
              o serviço usa somente 127.0.0.1 e lê os sensores do seu computador.
            </p>
          </div>
        </div>
      )}
      <div className="settings-grid">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>
              <ShieldCheck size={18} /> Privacidade e permissões
            </h2>
          </div>
          <div className="setting-row">
            <div>
              <strong>Sem conta. Sem telemetria.</strong>
              <p>
                Nenhuma fonte, imagem ou API externa é carregada pelo aplicativo. O serviço não
                executa atualizações nem comandos de instalação.
              </p>
            </div>
            <Check className="setting-check" size={19} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Leitura de sistema, não controle</strong>
              <p>
                CPU, memória, disco, rede, sensores e processos são consultados em /proc e /sys. O
                NEXO não mata processos, não altera configurações e não pede root.
              </p>
            </div>
            <Check className="setting-check" size={19} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Sem banco de dados pessoal</strong>
              <p>
                Esta versão não tem notas nem histórico de clipboard. Não cria banco SQLite, não
                captura a área de transferência e não grava preferências no servidor. Uma cópia só é
                gravada quando você exporta o diagnóstico.
              </p>
            </div>
            <LockKeyhole size={18} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Sessão local protegida</strong>
              <p>
                O launcher cria uma chave em arquivo 0600 e um cookie HttpOnly/SameSite=Strict. A
                API valida Host/Origin. A chave de bootstrap não é incluída no diagnóstico.
              </p>
            </div>
            <Check className="setting-check" size={19} />
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>
              <Download size={18} /> Diagnóstico e atalhos
            </h2>
          </div>
          <p className="settings-description">
            Exporte um retrato JSON dos sensores e do banco pacman para conferir ou compartilhar com
            cuidado. Não é um backup de dados pessoais: não há notas nem textos armazenados.
          </p>
          <Button variant="secondary" onClick={() => void exportSnapshot()} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Exportando…' : 'Exportar diagnóstico JSON'}
          </Button>
          <div className="settings-divider" />
          <div className="setting-row">
            <div>
              <strong>Atalhos de teclado</strong>
              <p>1 abre o monitor; 2 abre o pacman. Ctrl/⌘+K busca ações.</p>
            </div>
            <Button variant="ghost" onClick={onShortcuts}>
              <Keyboard size={16} /> Ver atalhos
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Cópia pelo navegador</strong>
              <p>
                “Copiar comando” usa a Clipboard API somente após seu clique. Se o navegador
                bloquear, o NEXO mostra o texto para seleção manual. Não há ponte nativa de
                clipboard.
              </p>
            </div>
            <Check className="setting-check" size={19} />
          </div>
        </section>
        <section className="panel settings-panel system-details">
          <div className="panel-heading">
            <h2>
              <HardDrive size={18} /> Neste ambiente
            </h2>
            <Badge tone="neutral">{session?.preview ? 'Sandbox' : 'Local'}</Badge>
          </div>
          <dl>
            <div>
              <dt>Sistema</dt>
              <dd>{system?.os || 'Detectando…'}</dd>
            </div>
            <div>
              <dt>Kernel</dt>
              <dd>{system?.kernel || '—'}</dd>
            </div>
            <div>
              <dt>Arquitetura</dt>
              <dd>{system?.architecture || '—'}</dd>
            </div>
            <div>
              <dt>Memória total</dt>
              <dd>{system ? bytes(system.memory.total) : '—'}</dd>
            </div>
            <div>
              <dt>pacman</dt>
              <dd>{capabilities?.pacman ? 'Disponível' : 'Não detectado'}</dd>
            </div>
            <div>
              <dt>Versão</dt>
              <dd>{session?.version || '—'}</dd>
            </div>
          </dl>
          <p className="input-help">
            A prévia roda em Debian. Consultas pacman reais precisam ser conferidas no seu Arch;
            aqui são testadas com mocks e degradação explícita.
          </p>
        </section>
        <section className="panel settings-panel install-guide">
          <div className="panel-heading">
            <h2>
              <Terminal size={18} /> Leve para o seu Arch
            </h2>
          </div>
          <p className="settings-description">
            O instalador de usuário compila a interface, instala em{' '}
            <code>~/.local/share/nexo/app</code> e cria um atalho no menu. Sem serviço root. Veja o
            README para o clone completo.
          </p>
          <div className="install-command">
            <code>
              cd "$HOME/nexo"
              <br />
              ./packaging/install.sh
            </code>
          </div>
          <ol className="install-steps">
            <li>Requisitos: Git, Python 3.10+, Node.js 22+ e npm.</li>
            <li>
              Clone o repositório em <code>~/nexo</code> e entre na pasta.
            </li>
            <li>
              Execute o instalador e procure <strong>NEXO</strong> no menu.
            </li>
            <li>
              Atualize com <code>git pull --ff-only</code> e reinstale.
            </li>
          </ol>
          <button className="text-link" onClick={() => setAbout(true)}>
            Como o app abre no desktop <ChevronRight size={15} />
          </button>
        </section>
      </div>
      {about && (
        <Modal
          title="Uma janela para o seu Linux."
          subtitle="Sem Electron, sem navegador externo obrigatório."
          onClose={() => setAbout(false)}
        >
          <div className="about-content">
            <p>
              O launcher usa Chromium/Chrome em modo aplicativo, se disponível, ou Firefox. O
              backend Python serve a interface e a API na mesma porta loopback.
            </p>
            <p>
              O atalho inicia o backend quando necessário. Se nenhum navegador for encontrado, o
              launcher tenta o navegador padrão. Nenhuma dependência é instalada silenciosamente.
            </p>
            <p>
              Para desinstalar, execute <code>./packaging/uninstall.sh</code> na pasta do projeto. O
              instalador substitui apenas a pasta marcada do app; dados antigos de versões
              anteriores não são apagados automaticamente.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
