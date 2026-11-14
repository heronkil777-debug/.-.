export const MODULE_IDS = ['signal', 'power', 'archive', 'pulse', 'nav'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export type ViewId = ModuleId | 'decision';
export type EndingId = 'reply' | 'silence' | 'together';
export const STORAGE_KEY = 'ultimo-sinal:mission:v1';

export interface ModuleInfo {
  id: ModuleId;
  number: string;
  name: string;
  short: string;
  title: string;
  description: string;
  location: string;
  clue: string;
  hints: string[];
  evidenceTitle: string;
  evidence: string;
  demo: string;
}

export const MODULES: ModuleInfo[] = [
  {
    id: 'signal',
    number: '01',
    name: 'Rede de escuta',
    short: 'Escuta',
    title: 'Há alguém no ruído.',
    description:
      'Uma portadora atravessa a estática a cada 11 segundos. Sintonize a frequência e amplifique o sinal para recuperar a mensagem.',
    location: 'ANTENA EXTERNA · SETOR A',
    clue: 'Anotação no receiver: “Portadora reserva: 96,4 MHz. Ganho de leitura: 70%. Não confundir com o eco de 103,7.”',
    hints: [
      'A frequência correta está anotada no receiver. Aproxime-se de 96 MHz e observe a coerência.',
      'Use 96,4 MHz e 70% de ganho. Os botões − e + permitem ajustes finos.',
    ],
    evidenceTitle: 'Uma voz familiar',
    evidence:
      '“Não os acorde. Ainda não. Ouça até o fim.” A impressão vocal é sua. A mensagem saiu da própria Íris, ricocheteou no relé lunar e voltou seis horas depois. Você não se lembra de tê-la gravado.',
    demo: 'Sintonizar 96,4 MHz, amplificar em 70% e capturar a portadora.',
  },
  {
    id: 'power',
    number: '02',
    name: 'Barramento de energia',
    short: 'Energia',
    title: 'Reacenda a Íris.',
    description:
      'Oito segmentos precisam formar um caminho contínuo. Gire as conexões e leve a energia da entrada, à esquerda, até a saída, no alto à direita.',
    location: 'ENGENHARIA · SETOR B',
    clue: 'Diagrama de emergência: “Percurso em serpentina. Contorne o dissipador central. Todos os oito segmentos devem receber energia.”',
    hints: [
      'Comece na entrada da linha do meio. Desça até a base, atravesse para a direita e suba.',
      'O caminho passa pelas peças: meio-esquerda → cima-esquerda → baixo-esquerda → baixo-meio → baixo-direita → meio-direita → cima-direita → cima-meio.',
    ],
    evidenceTitle: 'Vinte e três corações',
    evidence:
      'O suporte vital não falhou. Vinte e três tripulantes estão em cápsulas de emergência, com sinais estáveis. O protocolo os protegeu da tempestade solar. O silêncio da Terra é uma falha de comunicação — não uma sentença.',
    demo: 'Alinhar os oito segmentos do circuito de emergência em serpentina.',
  },
  {
    id: 'archive',
    number: '03',
    name: 'Arquivo cifrado',
    short: 'Arquivo',
    title: 'O que você esqueceu.',
    description:
      'Seu diário foi cifrado antes do bloqueio de memória. Três rotores independentes guardam a última anotação. Ajuste-os e acompanhe a decodificação.',
    location: 'NÚCLEO DE DADOS · SETOR C',
    clue: 'No verso de uma foto: “Três para trás. Um para frente. Quatro para trás. Nessa ordem, você volta a lembrar.”',
    hints: [
      'Cada rotor desloca as letras de um trecho. Negativo volta no alfabeto; positivo avança. A prévia mostra o resultado.',
      'Ajuste os rotores para −3, +1 e −4. O deslocamento é cíclico: depois do Z, volta ao A.',
    ],
    evidenceTitle: 'Seu último registro',
    evidence:
      'ELES ESTÃO VIVOS. O gás de emergência afetou sua memória recente. Você gravou a mensagem e confiou a si mesmo o próximo turno. Uma nota da capitana: “Não responda até confirmar a origem. Nosso destino não cabe numa decisão automática.”',
    demo: 'Aplicar os deslocamentos −3, +1 e −4 aos três rotores.',
  },
  {
    id: 'pulse',
    number: '04',
    name: 'Autenticação biométrica',
    short: 'Biometria',
    title: 'Seu corpo se lembra.',
    description:
      'O acesso ao navegar está bloqueado. Reproduza o eco biométrico na ordem correta para confirmar que você ainda é você.',
    location: 'CÁPSULAS DE EMERGÊNCIA · SETOR D',
    clue: 'Um protocolo de seis pulsos foi gravado nas cápsulas. Ouça e observe o eco; depois repita os seis sensores. Você pode reproduzir quantas vezes quiser.',
    hints: [
      'Ative “Reproduzir eco” e espere terminar. A leitura textual oferece a mesma sequência sem depender de som ou memória.',
      'Sequência: Pulso → Voz → Íris → Neural → Voz → Pulso. Ative a leitura textual para consultar enquanto responde.',
    ],
    evidenceTitle: 'Não foi um acidente',
    evidence:
      'Acessos anteriores confirmam: você iniciou o protocolo voluntariamente. A perda de memória era um efeito temporário previsto. Às 04:17, você deixou uma mensagem para o seu próximo eu: “Confie neles. Mas confira os dados antes de confiar em mim.”',
    demo: 'Restaurar a assinatura biométrica de seis pulsos do operador.',
  },
  {
    id: 'nav',
    number: '05',
    name: 'Alinhamento orbital',
    short: 'Órbita',
    title: 'Nem toda luz é uma estrela.',
    description:
      'A tempestade deixou um único corredor de comunicação. Mova a mira no mapa ou ajuste as coordenadas para fixar a antena no relé lunar.',
    location: 'OBSERVATÓRIO · SETOR E',
    clue: 'Telemetria recuperada: “ARTEMIS-3 · azimute 132° · elevação +24°. Origem humana confirmada. Não mirar no Sol.”',
    hints: [
      'A origem está no quadrante inferior direito do mapa: azimute entre 90° e 180°, elevação positiva.',
      'Mire em 132° de azimute e +24° de elevação. Uma tolerância de até 2° é aceita em cada eixo.',
    ],
    evidenceTitle: 'Alguém está esperando',
    evidence:
      'ARTEMIS-3 não é uma estrela. É uma equipe de resgate no relé lunar. A Terra perdeu a enlace direto na tempestade, mas nunca deixou de procurar a Íris. Há uma janela segura. Pela primeira vez em seis horas, o canal está aberto.',
    demo: 'Alinhar a antena ao relé ARTEMIS-3 em 132°, +24°.',
  },
];

export const ENDINGS: Record<
  EndingId,
  {
    number: string;
    label: string;
    title: string;
    subtitle: string;
    paragraphs: string[];
    transmission: string;
    color: string;
  }
> = {
  reply: {
    number: 'I',
    label: 'Responder',
    title: 'A manhã voltou.',
    subtitle: 'VOCÊ ESCOLHEU A CONFIANÇA',
    paragraphs: [
      'Você envia as coordenadas. Por quatro segundos, nada. Então uma voz atravessa o ruído: “Íris, aqui é Artemis. Estamos vendo vocês.”',
      'As cápsulas se abrem uma a uma. Vinte e três pessoas voltam a respirar o mesmo ar. Ninguém precisa explicar o silêncio. Lá embaixo, a Terra começa a amanhecer.',
      'Você não salvou o mundo. Salvou as pessoas que cabiam nele.',
    ],
    transmission: 'ARTEMIS-3, AQUI É ÍRIS-9. VINTE E QUATRO A BORDO. ESTAMOS PRONTOS PARA VOLTAR.',
    color: 'amber',
  },
  silence: {
    number: 'II',
    label: 'Manter silêncio',
    title: 'O último guardião.',
    subtitle: 'VOCÊ ESCOLHEU A CAUTELA',
    paragraphs: [
      'Você fecha o canal. Antes, deixa um farol anônimo com os sinais vitais da tripulação e um pedido de confirmação por outro enlace.',
      'A Íris continua sua órbita silenciosa. Você programa o despertar para doze horas depois, quando uma segunda janela permitir verificar a origem do resgate.',
      'No diário, escreve uma única linha para quem acordar: “Eu esperei porque vocês ainda estavam aqui.”',
    ],
    transmission:
      'FAROL ANÔNIMO ATIVO. TRIPULAÇÃO ESTÁVEL. CANAL EM QUARENTENA. NOVA VERIFICAÇÃO EM 12 H.',
    color: 'blue',
  },
  together: {
    number: 'III',
    label: 'Acordar a tripulação',
    title: 'Ninguém decide sozinho.',
    subtitle: 'VOCÊ ESCOLHEU COMPARTILHAR',
    paragraphs: [
      'Você interrompe a sedação. Primeiro a capitana. Depois os outros. Em poucos minutos, a ponte deixa de parecer o lugar mais vazio do universo.',
      'Você mostra tudo: a própria voz, os registros, a janela de resgate. Há medo, perguntas e um longo abraço. Então vinte e quatro pessoas decidem o próximo passo.',
      'A primeira ordem da capitana é simples: “Faça café. Hoje ninguém fica de vigia sozinho.”',
    ],
    transmission: 'TRIPULAÇÃO DESPERTADA. DECISÃO EM CONSELHO. ÍRIS-9 VOLTOU A SER UMA CASA.',
    color: 'green',
  },
};

export interface PuzzleInputs {
  frequency: number;
  gain: number;
  rotations: number[];
  rotors: number[];
  pads: number[];
  azimuth: number;
  elevation: number;
}
export interface LogEntry {
  id: number;
  time: number;
  text: string;
  kind: 'info' | 'success' | 'warning';
}
export interface GameState {
  version: 1;
  started: boolean;
  guided: boolean;
  selected: ViewId;
  solved: ModuleId[];
  inputs: PuzzleInputs;
  hints: Partial<Record<ModuleId, number>>;
  attempts: number;
  seconds: number;
  ending: EndingId | null;
  log: LogEntry[];
}

// Base connections describe the solved emergency serpentine. The center is a heat sink.
export const BASE_PORTS: number[][] = [
  [1, 2],
  [3, 2],
  [2, 1],
  [0, 2],
  [],
  [0, 2],
  [0, 1],
  [3, 1],
  [3, 0],
];
export const INITIAL_ROTATIONS = [1, 2, 1, 1, 0, 3, 2, 1, 3];
export const BIO_SEQUENCE = [0, 2, 1, 3, 2, 0];
export const PAD_NAMES = ['Pulso', 'Íris', 'Voz', 'Neural'];
export const CIPHER_PARTS = ['HOHV', 'DRSZN', 'ZMZSW'];

export function freshState(): GameState {
  return {
    version: 1,
    started: false,
    guided: false,
    selected: 'signal',
    solved: [],
    inputs: {
      frequency: 91.2,
      gain: 35,
      rotations: [...INITIAL_ROTATIONS],
      rotors: [0, 0, 0],
      pads: [],
      azimuth: 48,
      elevation: -12,
    },
    hints: {},
    attempts: 0,
    seconds: 0,
    ending: null,
    log: [
      {
        id: 0,
        time: 0,
        text: 'Turno assumido. Nenhuma resposta da Terra. Há uma transmissão esperando na rede de escuta.',
        kind: 'info',
      },
    ],
  };
}
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const portsFor = (index: number, rotation: number) =>
  BASE_PORTS[index].map((p) => (p + rotation) % 4);
export function connectedTiles(rotations: number[]): Set<number> {
  const powered = new Set<number>();
  if (!portsFor(1, rotations[1]).includes(3)) return powered;
  const queue = [1];
  while (queue.length) {
    const current = queue.shift()!;
    if (powered.has(current)) continue;
    powered.add(current);
    for (const direction of portsFor(current, rotations[current])) {
      const row = Math.floor(current / 3),
        col = current % 3;
      const nr = row + [-1, 0, 1, 0][direction],
        nc = col + [0, 1, 0, -1][direction];
      if (nr < 0 || nr > 2 || nc < 0 || nc > 2) continue;
      const next = nr * 3 + nc;
      if (!powered.has(next) && portsFor(next, rotations[next]).includes((direction + 2) % 4))
        queue.push(next);
    }
  }
  return powered;
}
export const powerSolved = (rotations: number[]) => {
  const powered = connectedTiles(rotations);
  return powered.size === 8 && portsFor(2, rotations[2]).includes(1);
};
export function shiftText(text: string, shift: number): string {
  return text.replace(/[A-Z]/g, (letter) =>
    String.fromCharCode(((((letter.charCodeAt(0) - 65 + shift) % 26) + 26) % 26) + 65),
  );
}
export const decodedParts = (rotors: number[]) =>
  CIPHER_PARTS.map((part, i) => shiftText(part, rotors[i]));
export const signalQuality = (frequency: number, gain: number) =>
  Math.round(clamp(100 - Math.abs(frequency - 96.4) * 11 - Math.abs(gain - 70) * 1.4, 0, 100));
export const isModuleId = (value: unknown): value is ModuleId =>
  MODULE_IDS.includes(value as ModuleId);
export const isUnlocked = (state: GameState, id: ViewId) =>
  id === 'decision' ? state.solved.length === 5 : MODULE_IDS.indexOf(id) <= state.solved.length;
export const nextModule = (state: GameState): ViewId =>
  MODULE_IDS.find((id) => !state.solved.includes(id)) ?? 'decision';
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

export type GameAction =
  | { type: 'START'; guided: boolean }
  | { type: 'SELECT'; id: ViewId }
  | { type: 'INPUT'; patch: Partial<PuzzleInputs> }
  | { type: 'SOLVE'; id: ModuleId }
  | { type: 'ATTEMPT'; id: ModuleId; message: string }
  | { type: 'HINT'; id: ModuleId }
  | { type: 'ENDING'; id: EndingId }
  | { type: 'REOPEN' }
  | { type: 'TICK' }
  | { type: 'RESET' }
  | { type: 'RESTORE'; state: GameState };

function appendLog(state: GameState, text: string, kind: LogEntry['kind'] = 'info'): LogEntry[] {
  return [
    ...state.log,
    { id: (state.log.at(-1)?.id ?? 0) + 1, time: state.seconds, text, kind },
  ].slice(-40);
}
export function canSolve(state: GameState, id: ModuleId): boolean {
  if (!state.started || state.ending || !isUnlocked(state, id) || state.solved.includes(id))
    return false;
  const { frequency, gain, rotations, rotors, azimuth, elevation } = state.inputs;
  switch (id) {
    case 'signal':
      return Math.abs(frequency - 96.4) < 0.15 && Math.abs(gain - 70) <= 5;
    case 'power':
      return powerSolved(rotations);
    case 'archive':
      return decodedParts(rotors).join(' ') === 'ELES ESTAO VIVOS';
    case 'pulse':
      return (
        state.inputs.pads.length === BIO_SEQUENCE.length &&
        state.inputs.pads.every((pad, index) => pad === BIO_SEQUENCE[index])
      );
    case 'nav':
      return Math.abs(azimuth - 132) <= 2 && Math.abs(elevation - 24) <= 2;
  }
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return { ...state, started: true, guided: action.guided, selected: nextModule(state) };
    case 'SELECT':
      return isUnlocked(state, action.id) ? { ...state, selected: action.id } : state;
    case 'INPUT': {
      if (state.ending) return state;
      const inputs = { ...state.inputs, ...action.patch };
      inputs.frequency = clamp(inputs.frequency, 87, 108);
      inputs.gain = clamp(inputs.gain, 0, 100);
      inputs.azimuth = clamp(inputs.azimuth, 0, 359);
      inputs.elevation = clamp(inputs.elevation, -60, 60);
      return { ...state, inputs };
    }
    case 'SOLVE': {
      if (!canSolve(state, action.id)) return state;
      const info = MODULES.find((m) => m.id === action.id)!;
      return {
        ...state,
        solved: [...state.solved, action.id],
        log: appendLog(state, `${info.name} restaurado. ${info.evidenceTitle}.`, 'success'),
      };
    }
    case 'ATTEMPT':
      return {
        ...state,
        attempts: state.attempts + 1,
        log: appendLog(state, action.message, 'warning'),
      };
    case 'HINT':
      return {
        ...state,
        hints: { ...state.hints, [action.id]: clamp((state.hints[action.id] ?? 0) + 1, 0, 2) },
      };
    case 'ENDING':
      return state.solved.length === 5 && state.started
        ? {
            ...state,
            ending: action.id,
            log: appendLog(
              state,
              `Decisão registrada: ${ENDINGS[action.id].label}. Turno encerrado.`,
              'success',
            ),
          }
        : state;
    case 'REOPEN':
      return { ...state, ending: null, selected: 'decision' };
    case 'TICK':
      return state.started && !state.ending ? { ...state, seconds: state.seconds + 1 } : state;
    case 'RESET':
      return freshState();
    case 'RESTORE':
      return action.state;
    default:
      return state;
  }
}

function integerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function numberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
export function parseSavedState(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    if (!s || s.version !== 1 || typeof s.started !== 'boolean' || typeof s.guided !== 'boolean')
      return null;
    if (
      !Array.isArray(s.solved) ||
      s.solved.length > 5 ||
      new Set(s.solved).size !== s.solved.length
    )
      return null;
    if (!s.solved.every((id, index) => id === MODULE_IDS[index])) return null;
    if (
      ![...MODULE_IDS, 'decision'].includes(s.selected) ||
      (s.selected === 'decision'
        ? s.solved.length !== 5
        : MODULE_IDS.indexOf(s.selected) > s.solved.length)
    )
      return null;
    if (s.ending !== null && (!Object.hasOwn(ENDINGS, s.ending) || s.solved.length !== 5))
      return null;
    const i = s.inputs;
    if (
      !i ||
      !numberInRange(i.frequency, 87, 108) ||
      !numberInRange(i.gain, 0, 100) ||
      !numberInRange(i.azimuth, 0, 359) ||
      !numberInRange(i.elevation, -60, 60)
    )
      return null;
    if (
      !Array.isArray(i.rotations) ||
      i.rotations.length !== 9 ||
      !i.rotations.every((n) => integerInRange(n, 0, 3))
    )
      return null;
    if (
      !Array.isArray(i.rotors) ||
      i.rotors.length !== 3 ||
      !i.rotors.every((n) => integerInRange(n, -9, 9))
    )
      return null;
    if (
      !Array.isArray(i.pads) ||
      i.pads.length > 6 ||
      !i.pads.every((n) => integerInRange(n, 0, 3))
    )
      return null;
    if (!integerInRange(s.seconds, 0, 31536000) || !integerInRange(s.attempts, 0, 1000000))
      return null;
    if (
      !s.hints ||
      typeof s.hints !== 'object' ||
      Array.isArray(s.hints) ||
      !Object.entries(s.hints).every(
        ([key, value]) => isModuleId(key) && integerInRange(value, 0, 2),
      )
    )
      return null;
    if (
      !Array.isArray(s.log) ||
      s.log.length > 40 ||
      !s.log.every(
        (e) =>
          e &&
          integerInRange(e.id, 0, 1000000) &&
          integerInRange(e.time, 0, 31536000) &&
          typeof e.text === 'string' &&
          e.text.length < 2000 &&
          ['info', 'success', 'warning'].includes(e.kind),
      )
    )
      return null;
    return s;
  } catch {
    return null;
  }
}
