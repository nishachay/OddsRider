import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crashPercent,
  decodeRunShare,
  encodeRunShare,
  formatRunTime,
  shareRun,
  shareTextFor,
  shareUrlFor,
} from './shareRun.ts';
import type { SharePayload } from '@oddsrider/core';

function payload(overrides: Partial<SharePayload> = {}): SharePayload {
  const frames = [];
  for (let i = 0; i < 40; i++) {
    frames.push({
      step: i * 6,
      c: [800 + i * 5, 470, 0.1] as [number, number, number],
      r: [744 + i * 5, 488, 0.1] as [number, number, number],
      f: [856 + i * 5, 488, 0.1] as [number, number, number],
      ejected: false,
    });
  }
  return {
    trackId: '253591-576fcffa80a5',
    trackHashPrefix: '0123456789abcdef',
    inverted: false,
    interval: 'ALL',
    beginStep: 24,
    endStep: 717,
    outcome: 'crash',
    progress: 0.62,
    finalScore: 1234,
    finalTimeMs: 9567,
    truncated: false,
    frames,
    tricks: [],
    ...overrides,
  };
}

const QUESTIONS = 'Will X happen by March?';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('share copy', () => {
  it('names the crash point and the link', () => {
    const text = shareTextFor(payload(), QUESTIONS, 'https://odds.example/r/abc');
    expect(text).toBe('I rode "Will X happen by March?" and crashed at 62% — beat me: https://odds.example/r/abc');
  });

  it('says finished instead of claiming a crash', () => {
    const text = shareTextFor(payload({ outcome: 'finish', progress: 1 }), QUESTIONS, 'https://odds.example/r/abc');
    expect(text).toBe('I rode "Will X happen by March?" to the finish — beat me: https://odds.example/r/abc');
  });

  it('rounds and clamps progress, and formats the clock', () => {
    expect(crashPercent(0.624)).toBe(62);
    expect(crashPercent(-1)).toBe(0);
    expect(crashPercent(2)).toBe(100);
    expect(crashPercent(Number.NaN)).toBe(0);
    expect(formatRunTime(9567)).toBe('00:09.5');
    expect(formatRunTime(61_000)).toBe('01:01.0');
  });
});

describe('share links', () => {
  it('carries the whole run in the payload and round-trips it', () => {
    const url = shareUrlFor(payload(), 'https://odds.example/');
    expect(url.startsWith('https://odds.example/r/')).toBe(true);
    const decoded = decodeRunShare(url.slice(url.indexOf('/r/') + 3));
    expect(decoded.meta.trackId).toBe('253591-576fcffa80a5');
    expect(decoded.meta.outcome).toBe('crash');
    expect(decoded.meta.progress).toBeCloseTo(0.62, 3);
    expect(decoded.frames.length).toBeGreaterThan(0);
  });

  it('refuses to share a run with no snapshots', () => {
    expect(() => encodeRunShare(payload({ frames: [] }))).toThrow(/no frames/);
  });

  it('rejects a tampered link', () => {
    const link = encodeRunShare(payload());
    const tampered = `${link.slice(0, 12)}${link[12] === 'A' ? 'B' : 'A'}${link.slice(13)}`;
    expect(() => decodeRunShare(tampered)).toThrow();
  });
});

describe('shareRun', () => {
  it('uses the platform share sheet with the exact copy', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });

    const state = await shareRun({ payload: payload(), question: QUESTIONS, url: 'https://odds.example/r/abc' });

    expect(state).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0].text).toBe(
      'I rode "Will X happen by March?" and crashed at 62% — beat me: https://odds.example/r/abc',
    );
  });

  it('copies the text when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const state = await shareRun({ payload: payload(), question: QUESTIONS, url: 'https://odds.example/r/abc' });

    expect(state).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(
      'I rode "Will X happen by March?" and crashed at 62% — beat me: https://odds.example/r/abc',
    );
  });

  it('treats a cancelled sheet as a no, not a copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue({ name: 'AbortError' }),
      clipboard: { writeText },
    });

    const state = await shareRun({ payload: payload(), question: QUESTIONS, url: 'https://odds.example/r/abc' });

    expect(state).toBe('failed');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the share sheet fails for another reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      share: vi.fn().mockRejectedValue(new Error('nope')),
      clipboard: { writeText },
    });

    const state = await shareRun({ payload: payload(), question: QUESTIONS, url: 'https://odds.example/r/abc' });

    expect(state).toBe('copied');
    expect(writeText).toHaveBeenCalled();
  });
});
