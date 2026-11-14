import { describe, expect, it } from 'vitest';
import { bytes, duration, relativeDate } from '../../src/format';

describe('formatação local pt-BR', () => {
  it('formata bytes sem inventar precisão', () => {
    expect(bytes(0)).toBe('0 B');
    expect(bytes(-1)).toBe('0 B');
    expect(bytes(1024)).toBe('1,0 KB');
    expect(bytes(1536)).toBe('1,5 KB');
    expect(bytes(1024 ** 3, 0)).toBe('1 GB');
  });
  it('formata uptime', () => {
    expect(duration(59)).toBe('0min');
    expect(duration(3660)).toBe('1h 1min');
    expect(duration(90000)).toBe('1d 1h');
  });
  it('datas relativas nunca ficam negativas', () => {
    expect(relativeDate(Date.now() / 1000 + 100)).toBe('agora');
    expect(relativeDate(Date.now() / 1000 - 120)).toBe('há 2 min');
  });
});
