import { describe, expect, it } from 'vitest';
import { categorize, DEFAULT_CATEGORY, words } from './categorize.ts';

describe('words', () => {
  it('strips punctuation and lowercases', () => {
    expect(words("Will the Fed's rate cut, in Q3? (Yes/No)")).toEqual([
      'will',
      'the',
      'fed',
      's',
      'rate',
      'cut',
      'in',
      'q3',
      'yes',
      'no',
    ]);
  });
});

describe('categorize — whole words only', () => {
  it('does not read "eth" inside "Ethiopia"', () => {
    // The regression this rewrite exists for.
    expect(categorize('Will Ethiopia hold national elections in 2026?')).toBe('POLITICS');
    expect(categorize('Will Ethiopia sign a new trade agreement?')).not.toBe('CRYPTO');
  });

  it('does not read "rate" inside "irate"', () => {
    expect(categorize('Will the irate crowd change anything?')).toBe(DEFAULT_CATEGORY);
  });

  it('matches a real standalone keyword', () => {
    expect(categorize('Will ETH close above $5,000?')).toBe('CRYPTO');
    expect(categorize('Will Ethereum set a new all-time high?')).toBe('CRYPTO');
  });

  it('never classifies on a substring', () => {
    expect(categorize('Will software piracy drop in 2026?')).toBe(DEFAULT_CATEGORY);
  });

  it('reads macro questions', () => {
    expect(categorize('Will the Fed cut rates in September?')).toBe('MACRO');
  });

  it('reads tech questions', () => {
    expect(categorize('Will OpenAI ship GPT-5 before December?')).toBe('TECH');
  });

  it('prefers politics when a question spans buckets', () => {
    expect(categorize('Will Trump mention bitcoin in the debate?')).toBe('POLITICS');
  });

  it('is deterministic', () => {
    const q = 'Will the Fed cut rates before the election?';
    expect(categorize(q)).toBe(categorize(q));
  });

  it('falls back to the boring bucket instead of guessing', () => {
    expect(categorize('Will the thing happen?')).toBe(DEFAULT_CATEGORY);
  });
});
