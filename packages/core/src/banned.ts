/**
 * Sensitive-market filter (plan §12).
 *
 * Markets about deaths, wars, attacks, disasters and individuals' health never
 * become tracks — not on the daily ride, not in a sponsored slot. Matching is
 * token-based, so "software" never trips the "war" rule.
 *
 * The built-in keyword list catches the obvious cases. `data/blocklist.json` is
 * the manual override for markets the words cannot name — a specific conflict,
 * a named victim, a diagnosis. Ingest applies both when a track is built *and*
 * when an existing frozen track is reviewed, so adding an entry also removes
 * that market's frozen tracks on the next run.
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

/** One manual exclusion in `data/blocklist.json`. */
export interface BlocklistMarket {
  /** Source market id (e.g. the Gamma market id). */
  sourceId?: string;
  /** Source slug. */
  slug?: string;
  /** Case-insensitive substring of the question. */
  question?: string;
  /** Why it is excluded; ingest prints it in the skip warning. */
  reason?: string;
}

/**
 * The committed manual blocklist. `markets` names specific exclusions;
 * `keywords` extends the built-in list for a class of markets.
 */
export interface Blocklist {
  markets: BlocklistMarket[];
  keywords: string[];
}

/** Used when no blocklist file is present: the keyword filter still runs. */
export const EMPTY_BLOCKLIST: Blocklist = { markets: [], keywords: [] };

/** The minimum any blockable thing must expose. */
export interface BlockableMarket {
  question: string;
  sourceId?: string;
  slug?: string;
  tags?: string[];
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate the committed blocklist file. Fails loudly on a malformed entry — a
 * typo must not silently let a sensitive market through, and an entry that
 * matches nothing is almost always a typo.
 */
export function parseBlocklist(input: unknown): Blocklist {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('blocklist must be a JSON object');
  }
  const raw = input as { markets?: unknown; keywords?: unknown };
  const marketsRaw = raw.markets ?? [];
  const keywordsRaw = raw.keywords ?? [];
  if (!Array.isArray(marketsRaw)) throw new Error('blocklist.markets must be an array');
  if (!Array.isArray(keywordsRaw)) throw new Error('blocklist.keywords must be an array');

  const markets = marketsRaw.map((entry, i) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`blocklist.markets[${i}] must be an object`);
    }
    const rawEntry = entry as Record<string, unknown>;
    const parsed: BlocklistMarket = {};
    if (nonEmptyString(rawEntry.sourceId)) parsed.sourceId = rawEntry.sourceId.trim();
    if (nonEmptyString(rawEntry.slug)) parsed.slug = rawEntry.slug.trim();
    if (nonEmptyString(rawEntry.question)) parsed.question = rawEntry.question.trim();
    if (nonEmptyString(rawEntry.reason)) parsed.reason = rawEntry.reason.trim();
    if (!parsed.sourceId && !parsed.slug && !parsed.question) {
      throw new Error(`blocklist.markets[${i}] matches nothing: needs sourceId, slug or question`);
    }
    return parsed;
  });

  const keywords = keywordsRaw.map((keyword, i) => {
    if (!nonEmptyString(keyword)) throw new Error(`blocklist.keywords[${i}] must be a non-empty string`);
    return keyword.trim().toLowerCase();
  });

  return { markets, keywords };
}

/** Keyword token set: built-in words plus the blocklist's own keywords. */
function blockedTokens(blocklist: Blocklist): Set<string> {
  return new Set([...BLOCKED_KEYWORDS, ...blocklist.keywords].map((keyword) => keyword.toLowerCase()));
}

/** The manual entry naming this market, or undefined. */
function findBlocklistEntry(
  market: BlockableMarket,
  blocklist: Blocklist,
): BlocklistMarket | undefined {
  const question = market.question.toLowerCase();
  return blocklist.markets.find((entry) => {
    if (entry.sourceId !== undefined && entry.sourceId === market.sourceId) return true;
    if (entry.slug !== undefined && entry.slug === market.slug) return true;
    return entry.question !== undefined && question.includes(entry.question.toLowerCase());
  });
}

/** True when the manual blocklist names this market by id, slug or question. */
export function isBlockedByBlocklist(
  market: BlockableMarket,
  blocklist: Blocklist = EMPTY_BLOCKLIST,
): boolean {
  return findBlocklistEntry(market, blocklist) !== undefined;
}

/** Keyword/tag filter only — the word list plus any blocklist keywords. */
export function isBlockedQuestion(
  question: string,
  tags: string[] = [],
  blocklist: Blocklist = EMPTY_BLOCKLIST,
): boolean {
  const blocked = blockedTokens(blocklist);
  const haystack = [...words(question), ...tags.flatMap((tag) => words(tag))];
  return haystack.some((token) => blocked.has(token));
}

/** Manual blocklist OR keyword/tag filter: the one call every ingest path makes. */
export function isBlockedMarket(
  market: BlockableMarket,
  blocklist: Blocklist = EMPTY_BLOCKLIST,
): boolean {
  return (
    isBlockedByBlocklist(market, blocklist) ||
    isBlockedQuestion(market.question, market.tags ?? [], blocklist)
  );
}

/** Why a market is blocked, for the ingest warning; null when it is fine. */
export function blockedReason(
  market: BlockableMarket,
  blocklist: Blocklist = EMPTY_BLOCKLIST,
): string | null {
  const entry = findBlocklistEntry(market, blocklist);
  if (entry) {
    const name = entry.slug ?? entry.sourceId ?? entry.question;
    return entry.reason ? `blocklist: ${name} — ${entry.reason}` : `blocklist: ${name}`;
  }
  if (isBlockedQuestion(market.question, market.tags ?? [], blocklist)) return 'sensitive keyword';
  return null;
}

export function filterBlocked<T extends { question: string }>(
  items: T[],
  tagsOf?: (item: T) => string[],
  blocklist: Blocklist = EMPTY_BLOCKLIST,
): T[] {
  return items.filter((item) => {
    const extra = item as Partial<BlockableMarket>;
    return !isBlockedMarket(
      {
        question: item.question,
        sourceId: extra.sourceId,
        slug: extra.slug,
        tags: tagsOf?.(item) ?? extra.tags,
      },
      blocklist,
    );
  });
}
