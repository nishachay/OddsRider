/**
 * Category mapping.
 *
 * Whole-word matching only. The previous version matched substrings, so "eth"
 * classified "Ethiopia" as CRYPTO and "rate" would match "irate". Every keyword
 * here is matched against word-boundary tokens, and the test suite pins the
 * Ethiopia regression.
 */
import type { Category } from './types.ts';

type KeywordCategory = Exclude<Category, 'LEGENDARY' | 'REMIX'>;

/** Default bucket when nothing matches. Deliberately boring, never a guess. */
export const DEFAULT_CATEGORY: Category = 'TECH';

export const CATEGORY_KEYWORDS: Record<KeywordCategory, string[]> = {
  POLITICS: [
    'election',
    'elections',
    'trump',
    'president',
    'presidential',
    'senate',
    'congress',
    'governor',
    'mayor',
    'nominee',
    'nomination',
    'primary',
    'parliament',
    'vote',
    'votes',
    'referendum',
    'ceasefire',
    'impeach',
  ],
  CRYPTO: [
    'btc',
    'bitcoin',
    'eth',
    'ethereum',
    'sol',
    'solana',
    'xrp',
    'doge',
    'crypto',
    'cryptocurrency',
    'blockchain',
    'stablecoin',
    'defi',
    'altcoin',
    'token',
  ],
  MACRO: [
    'fed',
    'federal',
    'fomc',
    'rate',
    'rates',
    'gdp',
    'inflation',
    'cpi',
    'recession',
    'tariff',
    'tariffs',
    'powell',
    'unemployment',
    'treasury',
    'yield',
    'yields',
    'stimulus',
  ],
  TECH: [
    'ai',
    'openai',
    'gpt',
    'nvidia',
    'apple',
    'google',
    'microsoft',
    'tesla',
    'iphone',
    'chip',
    'chips',
    'semiconductor',
    'spacex',
    'launch',
  ],
};

/** Words in `text`, lowercased, punctuation stripped. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

// POLITICS wins ties, then CRYPTO, then MACRO — a fixed, tested order so the
// same question always lands in the same bucket.
const PRECEDENCE: KeywordCategory[] = ['POLITICS', 'CRYPTO', 'MACRO', 'TECH'];

export function categorize(question: string): Category {
  const tokens = new Set(words(question));
  let best: KeywordCategory | null = null;
  let bestScore = 0;

  for (const category of PRECEDENCE) {
    const score = CATEGORY_KEYWORDS[category].filter((k) => tokens.has(k)).length;
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best ?? DEFAULT_CATEGORY;
}
