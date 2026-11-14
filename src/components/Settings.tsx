import { useState } from 'react';
import {
  Check,
  ChevronRight,
  Database,
  Download,
  FolderOpen,
  HardDrive,
  Keyboard,
  LockKeyhole,
  Monitor,
  ShieldCheck,
  Terminal,
  Trash2,
} from 'lucide-react';
import { api, downloadJson } from '../api';
import type { Capabilities, ClipboardStatus, Session, SystemInfo } from '../types';
import { bytes } from '../format';
import { Badge, Button, Modal, SectionHeading, Toggle } from './UI';

export function Settings({
  session,
  capabilities,
  system,
  status,
  onChange,
  notify,
  onShortcuts,
}: {
  session: Session | null;
  capabilities: Capabilities | null;
  system: SystemInfo | null;
  status: ClipboardStatus | null;
  onChange: () => Promise<void>;
  notify: (m: string) => void;
  onShortcuts: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [about, setAbout] = useState(false);
  const exportData = async () => {
    setExporting(true);
    try {
      downloadJson(await api.export(), `nexo-backup-${new Date().toISOString().slice(0, 10)}.json`);
      notify('Backup exportado. Guarde o arquivo em um lugar seguro.');
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
        description="Tudo o que o NEXO faz — e tudo o que ele não faz."
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
              Os sensores mostram a máquina Debian do sandbox, não o seu Arch. Notas desta
              demonstração ficam no sandbox. Na instalação local, o serviço usa somente 127.0.0.1 e
              os dados ficam no seu computador.
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
              <strong>Captura da área de transferência</strong>
              <p>
                {status?.available
                  ? `Detectado: ${status.backend === 'wayland' ? 'Wayland · wl-clipboard' : 'X11 · xclip'}. Somente texto. Padrões comuns de senhas e chaves são ignorados; o filtro não é infalível.`
                  : 'Não disponível neste ambiente. No Arch, instale wl-clipboard (Wayland) ou xclip (X11). A captura começa desligada a cada inicialização.'}
              </p>
            </div>
            <Toggle
              checked={!!status?.enabled}
              disabled={!status?.available}
              label="Ativar captura da área de transferência"
              onChange={async () => {
                try {
                  await api.setClipboard(!status?.enabled);
                  await onChange();
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            />
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
              <strong>Dados locais, sem criptografia</strong>
              <p>
                O banco tem permissão de leitura e escrita apenas para seu usuário (0600). Isso não
                protege contra outros processos desse usuário ou acesso físico. Não use o NEXO como
                gerenciador de senhas.
              </p>
            </div>
            <LockKeyhole size={18} />
          </div>
          <div className="setting-row">
            <div>
              <strong>Leitura de sistema, não controle</strong>
              <p>
                CPU, memória, disco e processos são consultados em /proc. O NEXO não mata processos,
                não altera configurações e não pede root.
              </p>
            </div>
            <Check className="setting-check" size={19} />
          </div>
        </section>
        <section className="panel settings-panel">
          <div className="panel-heading">
            <h2>
              <Database size={18} /> Seus dados
            </h2>
          </div>
          <div className="data-location">
            <FolderOpen size={23} />
            <div>
              <span>Pasta de dados</span>
              <code>{session?.dataDir || 'Conectando…'}</code>
            </div>
          </div>
          <p className="settings-description">
            Notas e textos ficam em um banco SQLite. Exporte uma cópia legível em JSON sempre que
            quiser. O arquivo inclui seus textos; guarde-o com cuidado.
          </p>
          <Button variant="secondary" onClick={() => void exportData()} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Exportando…' : 'Exportar todos os dados'}
          </Button>
          <div className="settings-divider" />
          <div className="setting-row">
            <div>
              <strong>Limpar histórico de textos</strong>
              <p>Apaga textos não fixados. Suas notas não são afetadas.</p>
            </div>
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <Trash2 size={15} /> Limpar
            </Button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Atalhos de teclado</strong>
              <p>Navegue e crie sem tirar as mãos do teclado.</p>
            </div>
            <Button variant="ghost" onClick={onShortcuts}>
              <Keyboard size={16} /> Ver atalhos
            </Button>
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
              <dt>Área de transferência</dt>
              <dd>
                {status?.available
                  ? status.backend === 'wayland'
                    ? 'Wayland'
                    : 'X11'
                  : 'Somente navegador'}
              </dd>
            </div>
          </dl>
          <p className="input-help">
            A prévia foi validada em Debian. A integração real com pacman e com a área de
            transferência precisa ser conferida no seu Arch.
          </p>
        </section>
        <section className="panel settings-panel install-guide">
          <div className="panel-heading">
            <h2>
              <Terminal size={18} /> Leve para o seu Arch
            </h2>
          </div>
          <p className="settings-description">
            O repositório inclui um instalador de usuário: compila a interface, instala em{' '}
            <code>~/.local/share/nexo</code> e cria um atalho no menu de aplicativos. Sem serviço
            root.
          </p>
          <div className="install-command">
            <code>./packaging/install.sh</code>
          </div>
          <ol className="install-steps">
            <li>Instale Python 3, Node.js e npm pelo pacman.</li>
            <li>
              Na pasta do projeto, execute <code>npm ci</code>.
            </li>
            <li>
              Execute o instalador e procure <strong>NEXO</strong> no menu.
            </li>
            <li>
              Opcional: <code>wl-clipboard</code> no Wayland ou <code>xclip</code> no X11.
            </li>
          </ol>
          <button className="text-link" onClick={() => setAbout(true)}>
            Como o app abre no desktop <ChevronRight size={15} />
          </button>
        </section>
      </div>
      {confirmClear && (
        <Modal
          title="Apagar textos não fixados?"
          subtitle="Essa ação não pode ser desfeita. Suas notas e textos fixados serão mantidos."
          onClose={() => setConfirmClear(false)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await api.clearClips();
                  await onChange();
                  setConfirmClear(false);
                  notify('Histórico limpo.');
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              Apagar histórico
            </Button>
          </div>
        </Modal>
      )}
      {about && (
        <Modal
          title="Uma janela para o seu espaço."
          subtitle="Sem Electron, sem navegador externo obrigatório."
          onClose={() => setAbout(false)}
        >
          <div className="about-content">
            <p>
              O instalador usa o Chromium/Chrome em modo aplicativo, se disponível, ou o Firefox. O
              backend Python serve a interface local e a API na mesma porta, acessível apenas por
              127.0.0.1.
            </p>
            <p>
              O atalho inicia o backend quando necessário. Se nenhum navegador for encontrado, o
              instalador explica como abrir no seu navegador padrão. Nenhuma dependência é instalada
              silenciosamente.
            </p>
            <p>
              Para desinstalar: <code>./packaging/uninstall.sh</code>. Por padrão, seus dados são
              preservados.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
