import { useEffect, useRef, useState } from 'react';
import { Check, Download, NotebookPen, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import type { Note, NoteColor } from '../types';
import { api } from '../api';
import { relativeDate } from '../format';
import { Button, EmptyState, IconButton, Modal, SectionHeading } from './UI';

const COLORS: { id: NoteColor; label: string }[] = [
  { id: 'sage', label: 'Verde' },
  { id: 'sand', label: 'Areia' },
  { id: 'blue', label: 'Azul' },
  { id: 'rose', label: 'Rosa' },
  { id: 'plain', label: 'Neutra' },
];
interface Props {
  notes: Note[];
  query: string;
  onQuery: (q: string) => void;
  onChange: () => Promise<void>;
  onNew: () => void;
  editing: Note | 'new' | null;
  onEdit: (note: Note | 'new' | null) => void;
  notify: (message: string) => void;
}
export function Notes({ notes, query, onQuery, onChange, onNew, editing, onEdit, notify }: Props) {
  const [filter, setFilter] = useState<'all' | 'pinned'>('all');
  const visible = filter === 'pinned' ? notes.filter((n) => n.pinned) : notes;
  return (
    <div className="page notes-page">
      <SectionHeading
        eyebrow="IDEIAS QUE MERECEM FICAR"
        title="Notas rápidas."
        description="Sem pastas obrigatórias. Sem cerimônia. Só o que você precisa lembrar."
        action={
          <Button onClick={onNew}>
            <Plus size={17} /> Nova nota
          </Button>
        }
      />
      <div className="list-toolbar">
        <div className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar notas"
            placeholder="Buscar nas suas notas…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
          {query && (
            <IconButton icon={X} label="Limpar busca de notas" onClick={() => onQuery('')} />
          )}
        </div>
        <div className="segmented-control">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            Todas <span>{notes.length}</span>
          </button>
          <button
            className={filter === 'pinned' ? 'active' : ''}
            onClick={() => setFilter('pinned')}
          >
            <Pin size={13} /> Fixadas
          </button>
        </div>
      </div>
      {visible.length ? (
        <div className="notes-grid">
          {visible.map((note) => (
            <article key={note.id} className={`note-card color-${note.color}`}>
              <div className="note-card-top">
                <span className="note-card-date">{relativeDate(note.updated)}</span>
                <IconButton
                  icon={Pin}
                  label={note.pinned ? `Desafixar ${note.title}` : `Fixar ${note.title}`}
                  className={note.pinned ? 'pinned' : ''}
                  onClick={async () => {
                    try {
                      await api.updateNote(note.id, { pinned: !note.pinned });
                      await onChange();
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                />
              </div>
              <button className="note-card-content" onClick={() => onEdit(note)}>
                <h2>{note.title}</h2>
                <p>{note.body || 'Abrir para escrever…'}</p>
              </button>
              <div className="note-card-footer">
                <span>{note.body.length.toLocaleString('pt-BR')} caracteres</span>
                <button className="text-link" onClick={() => onEdit(note)}>
                  Abrir nota <NotebookPen size={14} />
                </button>
              </div>
            </article>
          ))}
          <button className="new-note-card" onClick={onNew}>
            <Plus size={25} strokeWidth={1.3} />
            <strong>Qual é a próxima ideia?</strong>
            <span>Criar uma nota em branco</span>
          </button>
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            icon={NotebookPen}
            title={
              query
                ? 'Nenhuma nota por aqui.'
                : filter === 'pinned'
                  ? 'Nada fixado ainda.'
                  : 'Uma página em branco é um bom começo.'
            }
            action={
              !query && (
                <Button onClick={onNew}>
                  <Plus size={16} /> Criar nota
                </Button>
              )
            }
          >
            {query
              ? `Não encontramos “${query}”. Tente outra palavra.`
              : filter === 'pinned'
                ? 'Use o alfinete em uma nota para mantê-la no topo.'
                : 'Guarde um comando, escreva um lembrete ou comece aquele rascunho. Fica tudo no seu Linux.'}
          </EmptyState>
        </div>
      )}
      <div className="page-footnote">
        <Check size={14} /> SQLite local · salvamento automático · exportação quando você quiser
      </div>
      {editing && (
        <NoteEditor
          key={editing === 'new' ? 'new' : editing.id}
          note={editing === 'new' ? null : editing}
          onClose={() => onEdit(null)}
          onChange={onChange}
          notify={notify}
        />
      )}
    </div>
  );
}

function NoteEditor({
  note,
  onClose,
  onChange,
  notify,
}: {
  note: Note | null;
  onClose: () => void;
  onChange: () => Promise<void>;
  notify: (m: string) => void;
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [color, setColor] = useState<NoteColor>(note?.color || 'sage');
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    note ? 'saved' : 'idle',
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const currentId = useRef(note?.id || '');
  const editVersion = useRef(0);
  const dirty = useRef(false);
  const deleted = useRef(false);
  const markDirty = () => {
    dirty.current = true;
    editVersion.current += 1;
  };
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const snapshot = useRef({ title, body, color, pinned });
  snapshot.current = { title, body, color, pinned };
  const save = async (): Promise<boolean> => {
    const requested = editVersion.current;
    if (deleted.current) return true;
    const data = { ...snapshot.current };
    if (!data.title.trim() && !data.body.trim()) return true;
    setStatus('saving');
    setError('');
    const task = saveQueue.current.then(async () => {
      try {
        if (currentId.current) await api.updateNote(currentId.current, data);
        else {
          const result = await api.createNote(data);
          currentId.current = result.note.id;
        }
        await onChange();
        if (requested === editVersion.current) {
          setStatus('saved');
          dirty.current = false;
        }
        return true;
      } catch (e) {
        setStatus('error');
        setError((e as Error).message);
        return false;
      }
    });
    saveQueue.current = task.catch(() => undefined);
    return await task;
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if ((!title.trim() && !body.trim()) || !dirty.current) return;
    const timer = setTimeout(() => void saveRef.current(), 650);
    return () => clearTimeout(timer);
  }, [title, body, color, pinned]);
  const close = async () => {
    await saveQueue.current;
    if (dirty.current || (!currentId.current && (title.trim() || body.trim()))) {
      const saved = await saveRef.current();
      await saveQueue.current;
      if (!saved) return;
    }
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  const exportNote = () => {
    const url = URL.createObjectURL(
      new Blob([`# ${title || 'Sem título'}\n\n${body}\n`], {
        type: 'text/markdown;charset=utf-8',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'nota').replace(/[^a-zA-Z0-9À-ÿ_-]/g, '-').slice(0, 60)}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Modal
      title={note ? 'Sua nota.' : 'Uma nova ideia.'}
      subtitle="O texto é salvo automaticamente no seu computador."
      onClose={() => void closeRef.current()}
      wide
    >
      <div className={`note-editor color-${color}`}>
        <input
          className="note-title-input"
          aria-label="Título da nota"
          placeholder="Dê um nome para essa ideia…"
          maxLength={160}
          value={title}
          onChange={(e) => {
            markDirty();
            setTitle(e.target.value);
          }}
        />
        <textarea
          aria-label="Texto da nota"
          placeholder="Pode começar de qualquer lugar…"
          maxLength={20000}
          value={body}
          onChange={(e) => {
            markDirty();
            setBody(e.target.value);
          }}
        />
      </div>
      <div className="editor-options">
        <div className="color-picker" role="group" aria-label="Cor da nota">
          {COLORS.map((c) => (
            <button
              key={c.id}
              className={`color-swatch color-${c.id} ${color === c.id ? 'selected' : ''}`}
              aria-label={`Cor ${c.label}`}
              aria-pressed={color === c.id}
              onClick={() => {
                markDirty();
                setColor(c.id);
              }}
            >
              {color === c.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            markDirty();
            setPinned(!pinned);
          }}
        >
          <Pin size={15} />
          {pinned ? 'Fixada' : 'Fixar nota'}
        </Button>
        <span className={`save-status ${status}`} role="status">
          {status === 'saving'
            ? 'Salvando…'
            : status === 'saved'
              ? 'Salvo localmente'
              : status === 'error'
                ? 'Falha ao salvar'
                : 'Pronto para escrever'}
        </span>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
          <button className="text-link" onClick={() => void save()}>
            Tentar novamente
          </button>
        </div>
      )}
      <div className="editor-footer">
        <div>
          {note && (
            <IconButton
              icon={Trash2}
              label="Excluir nota"
              className="danger"
              onClick={() => setConfirmDelete(true)}
            />
          )}
          <IconButton icon={Download} label="Exportar nota em Markdown" onClick={exportNote} />
        </div>
        <Button onClick={() => void close()}>
          Concluir <Check size={16} />
        </Button>
      </div>
      {confirmDelete && (
        <div className="delete-confirm" role="alert">
          <span>Excluir esta nota? Isso não pode ser desfeito.</span>
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await saveQueue.current;
                deleted.current = true;
                await api.deleteNote(currentId.current);
                await onChange();
                dirty.current = false;
                onClose();
                notify('Nota excluída.');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Excluir
          </Button>
        </div>
      )}
    </Modal>
  );
}
