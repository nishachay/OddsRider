import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import ResultScreen, { ResultActions, type ResultScreenData } from './ResultScreen.tsx';
import type { SharePayload } from '@oddsrider/core';

/** A short recording: the last frames are ejected, like a real crash loop. */
function recording(): SharePayload {
  const frames = [];
  for (let i = 0; i < 240; i++) {
    frames.push({
      step: i * 3,
      c: [800 + i, 470 - i * 0.1, 0.1] as [number, number, number],
      r: [744 + i, 488 - i * 0.1, 0.1] as [number, number, number],
      f: [856 + i, 488 - i * 0.1, 0.1] as [number, number, number],
      ejected: i > 200,
    });
  }
  return {
    trackId: '2589812-15c71daca061',
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
    tricks: [{ step: 120, code: 1, points: 500 }],
  };
}

function data(overrides: Partial<ResultScreenData> = {}): ResultScreenData {
  return {
    finished: false,
    score: 1234,
    timeMs: 9567,
    difficulty: 'MEDIUM',
    progress: 0.62,
    question: 'Will X happen by March?',
    crashDate: '14 MAR',
    best: { plays: 3, best: 900, wins: 0, runs: [] },
    isNewBest: true,
    recording: recording(),
    ...overrides,
  };
}

const noop = () => {};

describe('ResultScreen', () => {
  it('renders a crash with its progress, market date and every way forward', () => {
    const html = renderToString(
      createElement(ResultScreen, { result: data(), onRetry: noop, onShare: noop, onNextTrack: noop }),
    );
    expect(html).toContain('Crashed at 62% · 14 MAR');
    expect(html).toContain('1,234');
    expect(html).toContain('00:09.5');
    expect(html).toContain('Retry');
    expect(html).toContain('Share');
    expect(html).toContain('Next track');
    expect(html).toContain('½ speed');
  });

  it('renders a finish and hides Next track when there is none', () => {
    const html = renderToString(
      createElement(ResultScreen, {
        result: data({ finished: true, isNewBest: false, progress: 1 }),
        onRetry: noop,
        onShare: noop,
        onNextTrack: null,
      }),
    );
    expect(html).toContain('Finished · 00:09.5');
    expect(html).not.toContain('Next track');
    expect(html).not.toContain('New best');
  });

  it('falls back when the run has no recording, and keeps ResultActions empty', () => {
    const html = renderToString(
      createElement(ResultScreen, {
        result: data({ recording: null }),
        onRetry: noop,
        onShare: noop,
        onNextTrack: null,
      }),
    );
    expect(html).toContain('Replay unavailable');
    expect(renderToString(createElement(ResultActions))).toBe('');
  });
});
