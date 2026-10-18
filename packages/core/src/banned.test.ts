import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  blockedReason,
  EMPTY_BLOCKLIST,
  filterBlocked,
  isBlockedByBlocklist,
  isBlockedMarket,
  isBlockedQuestion,
  parseBlocklist,
} from './banned.ts';

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

describe('parseBlocklist', () => {
  it('normalizes a valid file', () => {
    const blocklist = parseBlocklist({
      markets: [{ sourceId: ' 4641065 ', slug: 'us-x-iran-ceasefire', question: 'iran ceasefire', reason: ' conflict ' }],
      keywords: [' CeaseFire '],
    });
    expect(blocklist.markets[0]).toEqual({
      sourceId: '4641065',
      slug: 'us-x-iran-ceasefire',
      question: 'iran ceasefire',
      reason: 'conflict',
    });
    expect(blocklist.keywords).toEqual(['ceasefire']);
  });

  it('defaults to empty lists', () => {
    expect(parseBlocklist({})).toEqual(EMPTY_BLOCKLIST);
  });

  it('refuses an entry that would match nothing', () => {
    expect(() => parseBlocklist({ markets: [{ reason: 'oops' }] })).toThrow(/matches nothing/);
  });

  it('refuses malformed shapes loudly', () => {
    expect(() => parseBlocklist(null)).toThrow(/JSON object/);
    expect(() => parseBlocklist({ markets: 'nope' })).toThrow(/markets must be an array/);
    expect(() => parseBlocklist({ keywords: [''] })).toThrow(/non-empty string/);
    expect(() => parseBlocklist({ markets: [null] })).toThrow(/must be an object/);
  });
});

describe('manual blocklist', () => {
  const blocklist = parseBlocklist({
    markets: [
      {
        sourceId: '4641065',
        slug: 'us-x-iran-ceasefire-continues-through-october-31-20260917',
        question: 'iran ceasefire',
        reason: 'armed conflict',
      },
    ],
    keywords: ['ceasefire'],
  });

  it('matches by source id, slug or question text', () => {
    expect(isBlockedByBlocklist({ question: 'Anything', sourceId: '4641065' }, blocklist)).toBe(true);
    expect(isBlockedByBlocklist({ question: 'Anything', slug: 'us-x-iran-ceasefire-continues-through-october-31-20260917' }, blocklist)).toBe(true);
    expect(isBlockedByBlocklist({ question: 'Will the US x Iran ceasefire hold?' }, blocklist)).toBe(true);
    expect(isBlockedByBlocklist({ question: 'Will the Fed cut rates?' }, blocklist)).toBe(false);
    expect(isBlockedByBlocklist({ question: 'Will the Fed cut rates?' })).toBe(false);
  });

  it('combines the manual list with the keyword filter', () => {
    expect(isBlockedMarket({ question: 'Will the Fed cut rates?' }, blocklist)).toBe(false);
    expect(isBlockedMarket({ question: 'Will the war end?', tags: [] }, blocklist)).toBe(true);
    expect(isBlockedMarket({ question: 'Anything', sourceId: '4641065' }, blocklist)).toBe(true);
    // Extra keywords from the file join the built-in list.
    expect(isBlockedQuestion('Is that genocide?', [], blocklist)).toBe(true);
    // ...and "ceasefire" is only blocked when the file says so.
    expect(isBlockedQuestion('Will there be a ceasefire by June?', [], blocklist)).toBe(true);
    expect(isBlockedQuestion('Will there be a ceasefire by June?')).toBe(false);
  });

  it('explains why a market is blocked', () => {
    expect(blockedReason({ question: 'Anything', sourceId: '4641065' }, blocklist)).toContain('armed conflict');
    expect(blockedReason({ question: 'Will the war end?' }, blocklist)).toBe('sensitive keyword');
    expect(blockedReason({ question: 'Will the Fed cut rates?' }, blocklist)).toBeNull();
  });

  it('drops blocklisted items in filterBlocked', () => {
    const items = [
      { question: 'Anything', sourceId: '4641065' },
      { question: 'Will the Fed cut rates?' },
    ];
    expect(filterBlocked(items, undefined, blocklist)).toEqual([{ question: 'Will the Fed cut rates?' }]);
  });
});

// The committed data is part of the filter: if a frozen track in
// public/tracks/ matches the blocklist, the repo is shipping a track the
// sensitive-markets rule says must not exist. This pins the cleanup task.
describe('committed blocklist vs frozen tracks', () => {
  const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
  const TRACKS_DIR = join(ROOT, 'public', 'tracks');
  const blocklist = parseBlocklist(
    JSON.parse(readFileSync(join(ROOT, 'data', 'blocklist.json'), 'utf8')),
  );

  it('has no frozen track file that matches the filter', () => {
    const files = readdirSync(TRACKS_DIR).filter((name) => name.endsWith('.json') && name !== 'index.json');
    const offenders = files.filter((name) => {
      const track = JSON.parse(readFileSync(join(TRACKS_DIR, name), 'utf8')) as { question: string };
      return isBlockedMarket(track, blocklist);
    });
    expect(offenders).toEqual([]);
  });

  it('has no blocked summary in the committed index', () => {
    const index = JSON.parse(readFileSync(join(TRACKS_DIR, 'index.json'), 'utf8')) as {
      tracks: Array<{ id: string; question: string; sourceId?: string; slug?: string }>;
    };
    const offenders = index.tracks
      .filter((track) => isBlockedMarket(track, blocklist))
      .map((track) => track.id);
    expect(offenders).toEqual([]);
  });

  it('still catches the market that was removed', () => {
    expect(
      blockedReason(
        { question: 'US x Iran ceasefire continues through October 31?', sourceId: '4641065' },
        blocklist,
      ),
    ).toContain('Armed-conflict');
  });
});
