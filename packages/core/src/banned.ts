/**
 * Sensitive-market filter (plan §12).
 *
 * Markets about deaths, wars, attacks, disasters and individuals' health never
 * become tracks — not on the daily ride, not in a sponsored slot. Matching is
 * token-based, so "software" never trips the "war" rule.
 */
import { words } from './categorize.ts';

export const BLOCKED_KEYWORDS: string[] = [
  // death and violence
  'death',
  'deaths',
  'dead',
  'die',
  'dies',
  'died',
  'kill',
  'kills',
  'killed',
  'killing',
  'murder',
  'assassination',
  'assassinated',
  'shooting',
  'shooter',
  'massacre',
  'genocide',
  'execution',
  'hostage',
  'hostages',
  'casualties',
  // conflict
  'war',
  'wars',
  'invasion',
  'invade',
  'attack',
  'attacks',
  'bombing',
  'bomb',
  'missile',
  'missiles',
  'nuclear',
  'airstrike',
  'troops',
  // disaster
  'earthquake',
  'hurricane',
  'typhoon',
  'tsunami',
  'wildfire',
  'flood',
  'floods',
  'famine',
  'refugee',
  'refugees',
  // health of individuals
  'cancer',
  'hospital',
  'hospitalized',
  'diagnosed',
  'diagnosis',
  'illness',
  'surgery',
  'hospitalised',
  'health',
  'pandemic',
  'outbreak',
];

export function isBlockedQuestion(question: string, tags: string[] = []): boolean {
  const blocked = new Set(BLOCKED_KEYWORDS);
  const haystack = [...words(question), ...tags.flatMap((tag) => words(tag))];
  return haystack.some((token) => blocked.has(token));
}

export function filterBlocked<T extends { question: string }>(items: T[], tagsOf?: (item: T) => string[]): T[] {
  return items.filter((item) => !isBlockedQuestion(item.question, tagsOf?.(item) ?? []));
}
