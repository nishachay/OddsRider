import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSpotlight, { SearchStrip } from '../components/HeroSpotlight';
import DailyChallenge from '../components/DailyChallenge';
import MarketGrid from '../components/MarketGrid';
import Footer from '../components/Footer';
import { useMarkets } from '../data/marketsContext';
import {
  extractPolymarketSlug,
  filterMarketsLocal,
  getDailyChallenge,
  isLiveList,
  resolvePolymarketUrl,
  searchMarkets,
  type RideableMarket,
} from '../data/polymarket';
import { getPlayerStats, type PlayerStats } from '../data/playerStorage';

export function ridePath(market: RideableMarket, inverted = false, timeframe?: string): string {
  const params = new URLSearchParams();
  if (inverted) params.set('side', 'no');
  if (timeframe && timeframe !== 'LIVE') params.set('tf', timeframe);
  const qs = params.toString();
  return `/ride/${market.id}${qs ? `?${qs}` : ''}`;
}

// Scrolling odds tape: every runner on the card, live numbers, click to inspect.
function TickerTape({ markets, onPreview }: { markets: RideableMarket[]; onPreview: (m: RideableMarket) => void }) {
  const items = markets.slice(0, 14);
  if (items.length === 0) return null;
  const seq = [...items, ...items];
  return (
    <div className="ticker w-full overflow-hidden border-b border-[#232529] bg-[#0c0e12] select-none">
      <div className="ticker-track flex w-max items-center">
        {seq.map((m, i) => {
          const pct = Math.round(m.currentProb * 100);
          const up = m.currentProb >= 0.5;
          return (
            <button
              key={`${m.id}-${i}`}
              onClick={() => onPreview(m)}
              className="flex items-center gap-2 px-5 py-2 font-mono text-[11px] whitespace-nowrap border-r border-[#1a1c22] hover:bg-[#101113] transition-colors cursor-pointer"
            >
              <span className="max-w-[240px] truncate text-dim">{m.question}</span>
              <span className={`font-bold tabular-nums ${up ? 'text-toxic' : 'text-crimson'}`}>
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HomeStrip({ stats }: { stats: PlayerStats }) {
  if (stats.ridesCompleted > 0) {
    return (
      <section className="w-full max-w-6xl mx-auto px-4 pt-10 select-none">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-y border-[#232529] py-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
          <span className="text-toxic">Your garage</span>
          <span className="text-dim tabular-nums">
            <span className="text-ink text-sm">{stats.ridesCompleted}</span> rides
          </span>
          <span className="text-dim tabular-nums">
            Best <span className="text-ink text-sm">{stats.highScore.toLocaleString()}</span>
          </span>
          <span className="text-dim tabular-nums">
            <span className="text-ink text-sm">{stats.totalCrashes}</span> crashes
          </span>
          <span className="text-dim tabular-nums">
            <span className="text-toxic text-sm">{stats.conqueredMarkets.length}</span> conquered
          </span>
        </div>
      </section>
    );
  }

  const steps: Array<[string, string, string]> = [
    ['01', 'Pick a race', 'Live Polymarket contracts, sorted by 24H volume.'],
    ['02', 'Ride the curve', 'Green rallies climb. Red selloffs drop. NO inverts the track.'],
    ['03', 'Beat your best', 'Scores live on your device. New feature race drops 00:00 UTC.'],
  ];
  return (
    <section className="w-full max-w-6xl mx-auto px-4 pt-10 select-none">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {steps.map(([n, title, body]) => (
          <div key={n} className="border-t-2 border-[#3b414f] pt-3">
            <span className="font-poster text-4xl text-dim leading-none">{n}</span>
            <div className="font-mono text-[11px] font-bold tracking-[0.18em] text-ink uppercase pt-2">
              {title}
            </div>
            <p className="font-sans text-xs text-dim leading-relaxed pt-1">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { markets, loading, ingestMarket } = useMarkets();
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<RideableMarket[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState(() => getPlayerStats());
  const debounce = useRef(0);

  // Legacy share-link support: /?view=preview&market=<id> -> new routes
  useEffect(() => {
    const view = searchParams.get('view');
    const market = searchParams.get('market');
    if (market && (view === 'preview' || view === 'game')) {
      navigate(view === 'game' ? `/ride/${market}` : `/preview/${market}`, {
        replace: true,
      });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    setStats(getPlayerStats());
  }, [markets]);

  const runSearch = useCallback(
    (q: string) => {
      window.clearTimeout(debounce.current);
      if (!q.trim()) {
        setSearching(false);
        setSearchResults(null);
        return;
      }
      // Instant local hits first; live Gamma upgrades when it answers.
      setSearchResults(filterMarketsLocal(q, markets));
      setSearching(true);
      debounce.current = window.setTimeout(async () => {
        try {
          const live = await searchMarkets(q, markets);
          setSearchResults((prev) => {
            if (live.length === 0) return prev;
            const same =
              prev !== null &&
              prev.length === live.length &&
              prev.every((m, i) => m.id === live[i].id);
            return same ? prev : live;
          });
        } catch {
          // Local results already showing
        } finally {
          setSearching(false);
        }
      }, 400);
    },
    [markets],
  );

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const clearSearch = useCallback(() => {
    window.clearTimeout(debounce.current);
    setSearchQuery('');
    setSearchResults(null);
    setSearching(false);
  }, []);

  const handleSearchSubmit = useCallback(
    async (q: string) => {
      setSearchQuery(q);
      if (extractPolymarketSlug(q)) {
        setSearching(true);
        try {
          const resolved = await resolvePolymarketUrl(q);
          if (resolved) {
            ingestMarket(resolved);
            navigate(`/preview/${resolved.id}`);
            return;
          }
        } finally {
          setSearching(false);
        }
      }
      runSearch(q);
      document.getElementById('card')?.scrollIntoView({ behavior: 'smooth' });
    },
    [ingestMarket, navigate, runSearch],
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyChallenge = getDailyChallenge(markets, todayStr);
  const heroFeaturedMarket = markets[0] ?? null;
  const live = !loading && isLiveList(markets);
  const searchingMode = searchQuery.trim() !== '' || searching || searchResults !== null;
  const trackCount = markets.filter((m) => m.category !== 'LEGENDARY').length;
  const onPreview = useCallback((m: RideableMarket) => navigate(`/preview/${m.id}`), [navigate]);

  return (
    <div className="w-full flex flex-col min-h-screen">
      <Navbar onGoHome={() => navigate('/')} />
      <TickerTape markets={markets} onPreview={onPreview} />

      <main className="flex-1 flex flex-col">
        {heroFeaturedMarket && (
          <HeroSpotlight
            market={heroFeaturedMarket}
            live={live}
            trackCount={trackCount}
            onRideYes={(m) => navigate(ridePath(m, false))}
            onRideNo={(m) => navigate(ridePath(m, true))}
            onPreview={onPreview}
          />
        )}

        <SearchStrip
          query={searchQuery}
          onQueryChange={(q) => {
            setSearchQuery(q);
            runSearch(q);
          }}
          onSearch={handleSearchSubmit}
        />

        <HomeStrip stats={stats} />

        {!searchingMode && dailyChallenge && (
          <DailyChallenge
            market={dailyChallenge}
            dateStr={todayStr}
            onRide={(m) => navigate(ridePath(m, false))}
          />
        )}

        <div id="card" className="scroll-mt-16">
          <MarketGrid
            markets={markets}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            searchResults={searchResults}
            searching={searching}
            onClearSearch={clearSearch}
            live={live}
            onRideYes={(m) => navigate(ridePath(m, false))}
            onRideNo={(m) => navigate(ridePath(m, true))}
            onPreview={onPreview}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
