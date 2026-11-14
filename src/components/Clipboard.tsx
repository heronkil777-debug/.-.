import { useEffect, useState } from 'react';
import { Check, Clipboard, Copy, Info, Pin, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { api, copyText } from '../api';
import type { Clip, ClipboardStatus } from '../types';
import { relativeDate } from '../format';
import { Badge, Button, EmptyState, IconButton, Modal, SectionHeading, Toggle } from './UI';

export function ClipboardPage({
  clips,
  status,
  query,
  onQuery,
  onChange,
  notify,
}: {
  clips: Clip[];
  status: ClipboardStatus | null;
  query: string;
  onQuery: (q: string) => void;
  onChange: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [copied, setCopied] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const visible = pinnedOnly ? clips.filter((c) => c.pinned) : clips;
  const copy = async (clip: Clip) => {
    try {
      const mode = await copyText(clip.text);
      setCopied(clip.id);
      notify(
        mode === 'native'
          ? 'Copiado para a área de transferência do Linux.'
          : 'Copiado pela permissão do navegador.',
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(''), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  const toggleCapture = async () => {
    try {
      await api.setClipboard(!status?.enabled);
      await onChange();
      notify(
        status?.enabled
          ? 'Captura automática desativada.'
          : 'Captura de texto ativada neste desktop.',
      );
    } catch (e) {
      notify((e as Error).message);
    }
  };
  return (
    <div className="page clipboard-page">
      <SectionHeading
        eyebrow="NÃO PERCA AQUELE TRECHO"
        title="Área de transferência."
        description="Até 200 textos recentes, guardados apenas quando você quiser."
        action={
          <Button
            onClick={() => {
              setText('');
              setError('');
              setAdding(true);
            }}
          >
            <Plus size={16} /> Guardar texto
          </Button>
        }
      />
      <div className={`capture-banner ${status?.enabled ? 'enabled' : ''}`}>
        <span className="capture-symbol">
          <Clipboard size={23} strokeWidth={1.5} />
        </span>
        <div>
          <strong>{status?.enabled ? 'Captura automática ativa' : 'Você está no controle'}</strong>
          <p>
            {status?.available
              ? `Desktop ${status.backend === 'wayland' ? 'Wayland · wl-clipboard' : 'X11 · xclip'} detectado. Apenas texto, nunca imagens ou arquivos.`
              : 'Integração com o desktop não detectada neste ambiente. Você ainda pode guardar e copiar textos pelo navegador.'}
          </p>
        </div>
        <div className="capture-switch">
          <span>{status?.enabled ? 'Ativada' : 'Desativada'}</span>
          <Toggle
            checked={!!status?.enabled}
            disabled={!status?.available || !status}
            onChange={() => void toggleCapture()}
            label="Captura automática da área de transferência"
          />
        </div>
      </div>
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar no histórico"
            placeholder="Buscar um texto, comando ou link…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
        <Button
          variant={pinnedOnly ? 'primary' : 'secondary'}
          onClick={() => setPinnedOnly(!pinnedOnly)}
        >
          <Pin size={15} /> Fixados
        </Button>
        <Button
          variant="ghost"
          disabled={!clips.some((c) => !c.pinned)}
          onClick={() => setConfirmClear(true)}
        >
          <Trash2 size={15} /> Limpar histórico
        </Button>
      </div>
      {visible.length ? (
        <div className="clips-list">
          {visible.map((clip) => (
            <article key={clip.id} className={`clip-card ${clip.pinned ? 'is-pinned' : ''}`}>
              <div className="clip-content">
                <div className="clip-meta">
                  <Badge tone={clip.source === 'clipboard' ? 'sage' : 'neutral'}>
                    {clip.source === 'clipboard' ? 'Área de transferência' : 'Guardado por você'}
                  </Badge>
                  <time>{relativeDate(clip.created)}</time>
                  {clip.pinned && (
                    <span className="clip-pinned">
                      <Pin size={12} /> Fixado
                    </span>
                  )}
                </div>
                <p>{clip.text}</p>
              </div>
              <div className="clip-actions">
                <Button variant="secondary" onClick={() => void copy(clip)}>
                  {copied === clip.id ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copied === clip.id ? 'Copiado' : 'Copiar'}</span>
                </Button>
                <IconButton
                  icon={Pin}
                  label={clip.pinned ? 'Desafixar texto' : 'Fixar texto'}
                  className={clip.pinned ? 'pinned' : ''}
                  onClick={async () => {
                    try {
                      await api.pinClip(clip.id, !clip.pinned);
                      await onChange();
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                />
                <IconButton
                  icon={Trash2}
                  label="Excluir texto do histórico"
                  onClick={async () => {
                    try {
                      await api.deleteClip(clip.id);
                      await onChange();
                      notify('Texto excluído.');
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Clipboard}
            title={
              query
                ? 'Nenhum texto encontrado.'
                : pinnedOnly
                  ? 'Seus favoritos ficam aqui.'
                  : 'Aquilo que você copia pode ficar por perto.'
            }
            action={
              !query &&
              !pinnedOnly && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={15} /> Guardar primeiro texto
                </Button>
              )
            }
          >
            {query
              ? `Nada corresponde a “${query}”.`
              : pinnedOnly
                ? 'Fixe textos importantes para que não sejam removidos na limpeza.'
                : 'Guarde comandos, trechos e links. A captura do sistema é opcional e começa desligada.'}
          </EmptyState>
        </div>
      )}
      <div className="privacy-note">
        <ShieldCheck size={17} />
        <p>
          Textos que parecem conter senhas ou chaves são ignorados na captura automática. O filtro é
          heurístico, não uma garantia. O histórico fica em SQLite local, sem criptografia; evite
          guardar segredos.
        </p>
      </div>
      {adding && (
        <Modal
          title="Guarde esse trecho."
          subtitle="Fica disponível no seu histórico, mesmo com a captura desligada."
          onClose={() => setAdding(false)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await api.addClip(text);
                await onChange();
                setAdding(false);
                notify('Texto guardado localmente.');
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field-label" htmlFor="clip-text">
              Texto
            </label>
            <textarea
              id="clip-text"
              className="text-area"
              rows={7}
              autoFocus
              maxLength={20000}
              required
              placeholder="Cole aqui o que vale guardar…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="form-meta">
              <span>
                <Info size={13} /> Não guarde senhas ou chaves privadas.
              </span>
              <span>{text.length}/20.000</span>
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || !text.trim()}>
                <Check size={16} />
                {busy ? 'Guardando…' : 'Guardar texto'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {confirmClear && (
        <Modal
          title="Limpar o histórico?"
          subtitle="Textos fixados serão mantidos. Os demais serão excluídos permanentemente."
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
                  notify('Histórico limpo. Itens fixados foram mantidos.');
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              <Trash2 size={16} /> Limpar histórico
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
