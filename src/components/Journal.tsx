import { BookOpen, Check, Download, FileText, Lightbulb, LockKeyhole, Radio } from 'lucide-react';
import { ENDINGS, MODULES, formatTime, type GameState } from '../game';

export function downloadReport(state: GameState) {
  const lines = [
    'ÚLTIMO SINAL — DIÁRIO DA ÍRIS-9',
    '================================',
    `Turno: ${formatTime(state.seconds)} · Sistemas: ${state.solved.length}/5 · Modo: ${state.guided ? 'apresentação assistida' : 'investigação'}`,
    `Desfecho: ${state.ending ? ENDINGS[state.ending].title : 'Em andamento'}`,
    '',
    'EVIDÊNCIAS RECUPERADAS',
    ...MODULES.filter((m) => state.solved.includes(m.id)).flatMap((m) => [
      '',
      `${m.number}. ${m.evidenceTitle}`,
      m.evidence,
    ]),
    '',
    'REGISTRO DE OPERAÇÕES',
    ...state.log.map((entry) => `[${formatTime(entry.time)}] ${entry.text}`),
    '',
    state.ending ? ENDINGS[state.ending].transmission : 'A investigação continua.',
    '',
    'Uma experiência orbital. Feito para explorar, não para ter pressa.',
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ultimo-sinal-diario.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Journal({ state }: { state: GameState }) {
  const module = MODULES.find((m) => m.id === state.selected);
  return (
    <div className="journal-content">
      <div className="section-label">
        <BookOpen size={15} />
        <span>DIÁRIO DE BORDO</span>
        <span>{state.solved.length}/5</span>
      </div>
      <div className="current-clue">
        <span className="eyebrow">
          <Lightbulb size={13} />{' '}
          {state.selected === 'decision' ? 'O ÚLTIMO REGISTRO' : 'PISTA ATUAL'}
        </span>
        <p>
          {module?.clue ??
            'A origem é humana. A tripulação está viva. O canal está aberto. Você pode responder, manter a quarentena ou acordar os outros. Desta vez, a decisão é sua.'}
        </p>
      </div>
      <div className="journal-section-heading">
        <span>EVIDÊNCIAS</span>
        <span>{state.solved.length} RECUPERADAS</span>
      </div>
      {state.solved.length === 0 ? (
        <div className="journal-empty">
          <LockKeyhole size={22} strokeWidth={1.2} />
          <p>O silêncio guarda respostas.</p>
          <span>Restaure a rede de escuta para recuperar seu primeiro registro.</span>
        </div>
      ) : (
        <div className="evidence-list">
          {MODULES.filter((m) => state.solved.includes(m.id)).map((m) => (
            <details key={m.id} open={m.id === state.solved.at(-1)}>
              <summary>
                <span className="evidence-number">{m.number}</span>
                <span>{m.evidenceTitle}</span>
                <Check size={13} />
              </summary>
              <p>{m.evidence}</p>
            </details>
          ))}
        </div>
      )}
      <div className="journal-section-heading">
        <span>ATIVIDADE RECENTE</span>
        <ActivityDot />
      </div>
      <ol className="mission-log">
        {state.log
          .slice(-5)
          .reverse()
          .map((entry) => (
            <li key={entry.id} className={entry.kind}>
              <time>{formatTime(entry.time)}</time>
              <p>{entry.text}</p>
            </li>
          ))}
      </ol>
      <button className="text-button export-button" onClick={() => downloadReport(state)}>
        <Download size={14} /> Baixar diário da missão
      </button>
      <div className="journal-footer">
        <FileText size={12} /> ÍRIS–9 / REGISTRO LOCAL / OPERADOR 01
      </div>
    </div>
  );
}
function ActivityDot() {
  return <span className="status-dot" />;
}

export function Decision({
  onChoose,
}: {
  onChoose: (choice: 'reply' | 'silence' | 'together') => void;
}) {
  return (
    <section className="decision-panel" aria-labelledby="puzzle-title">
      <div className="puzzle-heading">
        <div className="puzzle-kw">
          <span className="eyebrow text-amber">CANAL DE RESPOSTA</span>
          <span>ORIGEM HUMANA CONFIRMADA</span>
        </div>
        <h2 id="puzzle-title" tabIndex={-1}>
          O sinal era seu.
          <br />A escolha também.
        </h2>
        <p>
          Você recuperou a verdade. Vinte e três pessoas continuam dormindo. Uma equipe de resgate
          espera do outro lado. Não há resposta perfeita — só a resposta que você escolhe dar.
        </p>
      </div>
      <div className="decision-transmission">
        <Radio size={20} />
        <div>
          <span className="eyebrow">ARTEMIS-3 → ÍRIS-9</span>
          <p>“Se alguém estiver ouvindo, nós ainda estamos aqui. Qual é a situação a bordo?”</p>
        </div>
      </div>
      <fieldset className="decision-options">
        <legend className="eyebrow">COMO VOCÊ ENCERRA ESTE TURNO?</legend>
        <label className="decision-option">
          <input type="radio" name="ending" value="reply" onChange={() => onChoose('reply')} />
          <Radio size={23} strokeWidth={1.3} />
          <span>
            <strong>Responder ao resgate</strong>
            <span>Enviar as coordenadas e confiar na voz do outro lado.</span>
          </span>
          <span className="choice-number">01</span>
        </label>
        <label className="decision-option">
          <input type="radio" name="ending" value="silence" onChange={() => onChoose('silence')} />
          <LockKeyhole size={23} strokeWidth={1.3} />
          <span>
            <strong>Manter o silêncio</strong>
            <span>Proteger a tripulação e verificar a origem por outro enlace.</span>
          </span>
          <span className="choice-number">02</span>
        </label>
        <label className="decision-option">
          <input
            type="radio"
            name="ending"
            value="together"
            onChange={() => onChoose('together')}
          />
          <BookOpen size={23} strokeWidth={1.3} />
          <span>
            <strong>Acordar a tripulação</strong>
            <span>Dividir a verdade. Decidir o futuro em conjunto.</span>
          </span>
          <span className="choice-number">03</span>
        </label>
      </fieldset>
      <p className="decision-footnote">
        Sua escolha encerra a história, não a curiosidade. Depois, você pode voltar e explorar os
        outros desfechos.
      </p>
    </section>
  );
}
