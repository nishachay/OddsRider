export interface PlayerStats {
  ridesCompleted: number;
  totalCrashes: number;
  highScore: number;
  totalScore: number;
  conqueredMarkets: string[];
  lastPlayed: number;
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
  };
}

export function recordRun(marketId: string, score: number, finished: boolean): PlayerStats {
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

  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore quota errors
  }

  return stats;
}

export function getGlobalPlatformStats(playerStats: PlayerStats) {
  const baseRides = 58771;
  const baseVolume = 111146919;
  const baseCrashes = 264109;

  return {
    rides: (baseRides + playerStats.ridesCompleted).toLocaleString(),
    volume: `$${(baseVolume + playerStats.totalScore * 420).toLocaleString()}`,
    crashes: (baseCrashes + playerStats.totalCrashes).toLocaleString(),
  };
}
