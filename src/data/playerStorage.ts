export interface MarketRun {
  score: number;
  finished: boolean;
  timeMs: number;
  at: number;
}

export interface MarketBest {
  plays: number;
  best: number;
  wins: number;
  runs: MarketRun[];
}

const MAX_RUNS = 8;

export interface PlayerStats {
  ridesCompleted: number;
  totalCrashes: number;
  highScore: number;
  totalScore: number;
  conqueredMarkets: string[];
  lastPlayed: number;
  runsByMarket: Record<string, MarketBest>;
}

const STATS_KEY = 'oddsrider_player_stats_v1';

export function getPlayerStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) {
      return JSON.parse(raw) as PlayerStats;
    }
  } catch {
    // Ignore storage parse error
  }
  return {
    ridesCompleted: 0,
    totalCrashes: 0,
    highScore: 0,
    totalScore: 0,
    conqueredMarkets: [],
    lastPlayed: Date.now(),
    runsByMarket: {},
  };
}

export function recordRun(
  marketId: string,
  score: number,
  finished: boolean,
  timeMs = 0,
): PlayerStats {
  const stats = getPlayerStats();
  stats.ridesCompleted += 1;
  stats.totalScore += score;
  stats.lastPlayed = Date.now();

  if (score > stats.highScore) {
    stats.highScore = score;
  }

  if (finished) {
    if (!stats.conqueredMarkets.includes(marketId)) {
      stats.conqueredMarkets.push(marketId);
    }
  } else {
    stats.totalCrashes += 1;
  }

  if (!stats.runsByMarket) stats.runsByMarket = {};
  const entry = stats.runsByMarket[marketId] ?? { plays: 0, best: 0, wins: 0, runs: [] };
  entry.plays += 1;
  if (score > entry.best) entry.best = score;
  if (finished) entry.wins += 1;
  entry.runs = [{ score, finished, timeMs, at: Date.now() }, ...(entry.runs ?? [])].slice(0, MAX_RUNS);
  stats.runsByMarket[marketId] = entry;

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore quota errors
  }

  return stats;
}

export function getMarketBest(marketId: string): MarketBest {
  const stats = getPlayerStats();
  return stats.runsByMarket?.[marketId] ?? { plays: 0, best: 0, wins: 0, runs: [] };
}

const GHOST_KEY = 'oddsrider_ghosts_v1';
const GHOST_TOGGLE_KEY = 'oddsrider_ghost_on';

export type GhostInterval = 'ALL' | '24H' | '7D';

/** A saved best run: full-fidelity snapshots for instant ghosts. */
export interface GhostRun {
  trackId: string;
  /** Side + window ride different terrain, so a ghost only races its own track. */
  inverted: boolean;
  interval: GhostInterval;
  score: number;
  timeMs: number;
  finished: boolean;
  savedAt: number;
  snapshots: Array<{ t: number; x: number; y: number; a: number }>;
}

/** Ghosts are keyed by terrain, not just market id: YES/NO and the window differ. */
export function ghostKey(trackId: string, inverted = false, interval: GhostInterval = 'ALL'): string {
  return `${trackId}${inverted ? ':NO' : ':YES'}:${interval}`;
}

function readGhosts(): Record<string, GhostRun> {
  try {
    const raw = localStorage.getItem(GHOST_KEY);
    if (raw) return JSON.parse(raw) as Record<string, GhostRun>;
  } catch {
    // Ignore storage parse error
  }
  return {};
}

/** Save a ghost only when it beats the stored best (or none exists). */
export function saveGhostRun(run: Omit<GhostRun, 'savedAt'>): boolean {
  const ghosts = readGhosts();
  const key = ghostKey(run.trackId, run.inverted, run.interval);
  const prev = ghosts[key];
  if (prev && prev.score >= run.score) return false;
  ghosts[key] = { ...run, savedAt: Date.now() };
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify(ghosts));
  } catch {
    return false;
  }
  return true;
}

export function getGhostRun(trackId: string, inverted = false, interval: GhostInterval = 'ALL'): GhostRun | null {
  return readGhosts()[ghostKey(trackId, inverted, interval)] ?? null;
}

export function ghostsEnabled(): boolean {
  try {
    return localStorage.getItem(GHOST_TOGGLE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setGhostsEnabled(on: boolean): void {
  try {
    localStorage.setItem(GHOST_TOGGLE_KEY, on ? '1' : '0');
  } catch {
    // Ignore quota errors
  }
}

