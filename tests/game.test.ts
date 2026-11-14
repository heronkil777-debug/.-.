import { describe, expect, it } from 'vitest';
import {
  BIO_SEQUENCE,
  CIPHER_PARTS,
  ENDINGS,
  INITIAL_ROTATIONS,
  MODULE_IDS,
  STORAGE_KEY,
  canSolve,
  connectedTiles,
  decodedParts,
  formatTime,
  freshState,
  gameReducer,
  isUnlocked,
  nextModule,
  parseSavedState,
  portsFor,
  powerSolved,
  shiftText,
  signalQuality,
  type GameState,
  type ModuleId,
} from '../src/game';

function solve(state: GameState, id: ModuleId): GameState {
  const patches = {
    signal: { frequency: 96.4, gain: 70 },
    power: { rotations: Array(9).fill(0) as number[] },
    archive: { rotors: [-3, 1, -4] },
    pulse: { pads: [...BIO_SEQUENCE] },
    nav: { azimuth: 132, elevation: 24 },
  };
  if (!state.started) state = gameReducer(state, { type: 'START', guided: false });
  return gameReducer(gameReducer(state, { type: 'INPUT', patch: patches[id] }), {
    type: 'SOLVE',
    id,
  });
}
function complete() {
  return MODULE_IDS.reduce(
    (state, id) => solve(state, id),
    gameReducer(freshState(), { type: 'START', guided: false }),
  );
}

describe('mission progression', () => {
  it('starts with only the listening array available', () => {
    const state = freshState();
    expect(state.started).toBe(false);
    expect(state.solved).toEqual([]);
    expect(isUnlocked(state, 'signal')).toBe(true);
    for (const id of [...MODULE_IDS.slice(1), 'decision' as const])
      expect(isUnlocked(state, id)).toBe(false);
    expect(nextModule(state)).toBe('signal');
  });
  it('does not allow solving before starting or skipping a system', () => {
    let state = freshState();
    state = gameReducer(state, { type: 'INPUT', patch: { frequency: 96.4, gain: 70 } });
    expect(gameReducer(state, { type: 'SOLVE', id: 'signal' })).toBe(state);
    state = gameReducer(state, { type: 'START', guided: false });
    expect(gameReducer(state, { type: 'SOLVE', id: 'nav' })).toBe(state);
    expect(gameReducer(state, { type: 'SELECT', id: 'archive' })).toBe(state);
  });
  it('reveals exactly one new system per solution, without duplicates', () => {
    let state = gameReducer(freshState(), { type: 'START', guided: false });
    for (const [index, id] of MODULE_IDS.entries()) {
      state = solve(state, id);
      expect(state.solved).toHaveLength(index + 1);
      expect(gameReducer(state, { type: 'SOLVE', id })).toBe(state);
      expect(state.log.at(-1)?.kind).toBe('success');
      expect(nextModule(state)).toBe(MODULE_IDS[index + 1] ?? 'decision');
    }
    expect(isUnlocked(state, 'decision')).toBe(true);
  });
  it('records failed attempts without resetting progress', () => {
    const state = gameReducer(freshState(), { type: 'START', guided: false });
    const next = gameReducer(state, { type: 'ATTEMPT', id: 'signal', message: 'Ainda é ruído.' });
    expect(next.attempts).toBe(1);
    expect(next.solved).toEqual([]);
    expect(next.log.at(-1)?.kind).toBe('warning');
  });
  it('caps hints at two and keeps them per module', () => {
    let state = freshState();
    for (let i = 0; i < 5; i++) state = gameReducer(state, { type: 'HINT', id: 'signal' });
    expect(state.hints.signal).toBe(2);
    expect(state.hints.archive).toBeUndefined();
  });
  it('pauses the elapsed clock before start and after an ending', () => {
    let state = freshState();
    expect(gameReducer(state, { type: 'TICK' }).seconds).toBe(0);
    state = gameReducer(state, { type: 'START', guided: true });
    state = gameReducer(state, { type: 'TICK' });
    expect(state.seconds).toBe(1);
    state = complete();
    state = gameReducer(state, { type: 'ENDING', id: 'reply' });
    expect(gameReducer(state, { type: 'TICK' }).seconds).toBe(state.seconds);
  });
  it('bounds controls and ignores puzzle changes after the ending', () => {
    const state = gameReducer(freshState(), {
      type: 'INPUT',
      patch: { frequency: 999, gain: -4, azimuth: -10, elevation: 90 },
    });
    expect(state.inputs).toMatchObject({ frequency: 108, gain: 0, azimuth: 0, elevation: 60 });
    const ended = gameReducer(complete(), { type: 'ENDING', id: 'together' });
    expect(gameReducer(ended, { type: 'INPUT', patch: { frequency: 90 } })).toBe(ended);
  });
  it('resets the mission cleanly', () =>
    expect(gameReducer(complete(), { type: 'RESET' })).toEqual(freshState()));
  it('formats mission time without a countdown', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(3601)).toBe('60:01');
  });
});

describe('frequency receiver', () => {
  it('requires both the correct carrier and usable gain', () => {
    let state = gameReducer(freshState(), { type: 'START', guided: false });
    expect(canSolve(state, 'signal')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { frequency: 96.4, gain: 10 } });
    expect(canSolve(state, 'signal')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { frequency: 103.7, gain: 70 } });
    expect(canSolve(state, 'signal')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { frequency: 96.4, gain: 70 } });
    expect(canSolve(state, 'signal')).toBe(true);
  });
  it('gives continuous feedback and rejects the decoy carrier', () => {
    expect(signalQuality(96.4, 70)).toBe(100);
    expect(signalQuality(96.4, 70)).toBeGreaterThan(signalQuality(96.8, 70));
    expect(signalQuality(103.7, 70)).toBeLessThan(30);
    expect(signalQuality(87, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('emergency power routing', () => {
  it('starts disconnected and has a real eight-tile solution', () => {
    expect(powerSolved(INITIAL_ROTATIONS)).toBe(false);
    expect(powerSolved(Array(9).fill(0))).toBe(true);
    expect(connectedTiles(Array(9).fill(0)).size).toBe(8);
  });
  it('rotates ports cyclically and never connects through the heat sink', () => {
    expect(portsFor(0, 1)).toEqual([2, 3]);
    expect(portsFor(0, 4)).toEqual([1, 2]);
    expect(connectedTiles(Array(9).fill(0)).has(4)).toBe(false);
  });
  it('requires a closed output, not just illuminated pieces', () => {
    const rotations = Array(9).fill(0);
    rotations[2] = 1;
    expect(powerSolved(rotations)).toBe(false);
  });
  it('does not power disconnected islands', () => {
    const rotations = Array(9).fill(0);
    rotations[1] = 2;
    expect(connectedTiles(rotations).size).toBe(0);
  });
});

describe('personal archive cipher', () => {
  it('handles positive and negative shifts with alphabetic wrap', () => {
    expect(shiftText('ZEBRA', 1)).toBe('AFCSB');
    expect(shiftText('AFCSB', -1)).toBe('ZEBRA');
    expect(shiftText('ABC', 26)).toBe('ABC');
  });
  it('encrypts the evidence with the three independent rotors', () => {
    expect(['ELES', 'ESTAO', 'VIVOS'].map((word, i) => shiftText(word, [3, -1, 4][i]))).toEqual(
      CIPHER_PARTS,
    );
    expect(decodedParts([-3, 1, -4]).join(' ')).toBe('ELES ESTAO VIVOS');
    expect(decodedParts([0, 0, 0]).join(' ')).not.toBe('ELES ESTAO VIVOS');
  });
});

describe('biometric and orbital authentication', () => {
  it('checks the complete ordered biometric sequence', () => {
    let state = solve(solve(solve(freshState(), 'signal'), 'power'), 'archive');
    expect(canSolve(state, 'pulse')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { pads: [0, 2, 1] } });
    expect(canSolve(state, 'pulse')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { pads: [...BIO_SEQUENCE].reverse() } });
    expect(canSolve(state, 'pulse')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { pads: [...BIO_SEQUENCE] } });
    expect(canSolve(state, 'pulse')).toBe(true);
  });
  it('accepts the two-degree orbital window but not nearby false targets', () => {
    let state = solve(solve(solve(solve(freshState(), 'signal'), 'power'), 'archive'), 'pulse');
    state = gameReducer(state, { type: 'INPUT', patch: { azimuth: 134, elevation: 22 } });
    expect(canSolve(state, 'nav')).toBe(true);
    state = gameReducer(state, { type: 'INPUT', patch: { azimuth: 135, elevation: 24 } });
    expect(canSolve(state, 'nav')).toBe(false);
    state = gameReducer(state, { type: 'INPUT', patch: { azimuth: 132, elevation: 27 } });
    expect(canSolve(state, 'nav')).toBe(false);
  });
});

describe('choices and epilogues', () => {
  it('does not allow an early ending', () => {
    const state = freshState();
    expect(gameReducer(state, { type: 'ENDING', id: 'reply' })).toBe(state);
  });
  for (const id of ['reply', 'silence', 'together'] as const) {
    it(`has a complete, distinct ${id} epilogue`, () => {
      const state = gameReducer(complete(), { type: 'ENDING', id });
      expect(state.ending).toBe(id);
      expect(ENDINGS[id].paragraphs).toHaveLength(3);
      expect(ENDINGS[id].transmission.length).toBeGreaterThan(30);
      expect(state.solved).toHaveLength(5);
      const reopened = gameReducer(state, { type: 'REOPEN' });
      expect(reopened.ending).toBeNull();
      expect(reopened.selected).toBe('decision');
      expect(reopened.solved).toHaveLength(5);
    });
  }
});

describe('resilient local saves', () => {
  it('round-trips an in-progress mission including controls and hints', () => {
    const state = gameReducer(solve(freshState(), 'signal'), { type: 'HINT', id: 'power' });
    expect(parseSavedState(JSON.stringify(state))).toEqual(state);
    expect(STORAGE_KEY).toContain('v1');
  });
  it('round-trips every ending', () => {
    for (const id of ['reply', 'silence', 'together'] as const) {
      const state = gameReducer(complete(), { type: 'ENDING', id });
      expect(parseSavedState(JSON.stringify(state))).toEqual(state);
    }
  });
  it('rejects malformed, absent, and incompatible saves', () => {
    for (const raw of [
      null,
      '',
      '{broken',
      'null',
      '[]',
      '{}',
      JSON.stringify({ ...freshState(), version: 2 }),
    ])
      expect(parseSavedState(raw)).toBeNull();
  });
  it('rejects impossible progression and invalid controls', () => {
    const mutations: Array<(s: GameState) => void> = [
      (s) => {
        s.solved = ['nav'];
      },
      (s) => {
        s.solved = ['signal', 'signal'];
      },
      (s) => {
        s.selected = 'decision';
      },
      (s) => {
        s.inputs.frequency = NaN;
      },
      (s) => {
        s.inputs.rotors = [99, 0, 0];
      },
      (s) => {
        s.inputs.rotations = [99];
      },
      (s) => {
        s.inputs.pads = [9];
      },
      (s) => {
        s.ending = 'reply';
      },
      (s) => {
        s.seconds = -1;
      },
      (s) => {
        s.hints = { signal: 8 };
      },
      (s) => {
        s.log = [];
        s.log.push({ id: 0, time: 0, text: '<script>', kind: 'info' });
        s.log[0].kind = 'bad' as 'info';
      },
    ];
    for (const mutate of mutations) {
      const state = freshState();
      mutate(state);
      expect(parseSavedState(JSON.stringify(state))).toBeNull();
    }
  });
  it('keeps the event journal bounded', () => {
    let state = freshState();
    for (let i = 0; i < 60; i++)
      state = gameReducer(state, {
        type: 'ATTEMPT',
        id: 'signal',
        message: 'Tentativa registrada.',
      });
    expect(state.log).toHaveLength(40);
    expect(state.log.at(-1)?.id).toBe(60);
  });
});
