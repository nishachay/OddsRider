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

