import { describe, expect, it } from 'vitest';
import { filterBlocked, isBlockedQuestion } from './banned.ts';

describe('isBlockedQuestion', () => {
  it('blocks markets about deaths and violence', () => {
    expect(isBlockedQuestion('Will there be a ceasefire by June?')).toBe(false);
    // ...but the surrounding conflict vocabulary is blocked.
    expect(isBlockedQuestion('Will the war end in 2026?')).toBe(true);
    expect(isBlockedQuestion('Will the death toll exceed 100?')).toBe(true);
    expect(isBlockedQuestion('Will there be another assassination attempt?')).toBe(true);
  });

  it('blocks disasters and outbreaks', () => {
    expect(isBlockedQuestion('Will an earthquake hit California this year?')).toBe(true);
    expect(isBlockedQuestion('Will the WHO declare a pandemic in 2026?')).toBe(true);
  });

  it('blocks markets about individuals\u2019 health', () => {
    expect(isBlockedQuestion('Will the senator be hospitalized this year?')).toBe(true);
    expect(isBlockedQuestion('Will the candidate be diagnosed with cancer?')).toBe(true);
  });

  it('does not trip on substrings', () => {
    // "software" must not read as "war".
    expect(isBlockedQuestion('Will software sales rise?')).toBe(false);
    expect(isBlockedQuestion('Will the mayoral debate happen?')).toBe(false);
  });

  it('leaves ordinary markets alone', () => {
    expect(isBlockedQuestion('Will the Fed cut rates in September?')).toBe(false);
    expect(isBlockedQuestion('Will Bitcoin close above $150,000?')).toBe(false);
    expect(isBlockedQuestion('Will OpenAI ship GPT-5 before December?')).toBe(false);
  });

  it('blocks on source tags too', () => {
    expect(isBlockedQuestion('Will the summit happen?', ['War'])).toBe(true);
  });
});

describe('filterBlocked', () => {
  it('drops blocked items and keeps the rest', () => {
    const items = [
      { question: 'Will the Fed cut rates?' },
      { question: 'Will the war end?' },
      { question: 'Will Bitcoin hit 150k?' },
    ];
    expect(filterBlocked(items).map((item) => item.question)).toEqual([
      'Will the Fed cut rates?',
      'Will Bitcoin hit 150k?',
    ]);
  });

  it('supports per-item tags', () => {
    const items = [
      { question: 'Will the summit happen?', tags: ['War'] },
      { question: 'Will the summit happen?', tags: ['Politics'] },
    ];
    expect(filterBlocked(items, (item) => item.tags)).toHaveLength(1);
  });
});
