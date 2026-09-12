import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSpotlight from '../components/HeroSpotlight';
import DailyChallenge from '../components/DailyChallenge';
import MarketGrid from '../components/MarketGrid';
import Footer from '../components/Footer';
import { useMarkets } from '../data/marketsContext';
import {
  filterMarketsLocal,
  getDailyChallenge,
  isLiveList,
  searchMarkets,
  type RideableMarket,
} from '../data/polymarket';
import { getPlayerStats } from '../data/playerStorage';

export function ridePath(market: RideableMarket, inverted = false, timeframe?: string): string {
  const params = new URLSearchParams();
  if (inverted) params.set('side', 'no');
  if (timeframe && timeframe !== 'LIVE') params.set('tf', timeframe);
  const qs = params.toString();
  return `/ride/${market.id}${qs ? `?${qs}` : ''}`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { markets, loading } = useMarkets();
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyChallenge = getDailyChallenge(markets, todayStr);
  const heroFeaturedMarket = markets[0] ?? null;
  const live = !loading && isLiveList(markets);
  const searchingMode = searchQuery.trim() !== '' || searching || searchResults !== null;

  return (
    <div className="w-full flex flex-col min-h-screen">
      <Navbar onGoHome={() => navigate('/')} />

      <main className="flex-1 flex flex-col">
        {heroFeaturedMarket && (
          <HeroSpotlight
            market={heroFeaturedMarket}
            live={live}
            stats={stats}
            query={searchQuery}
            onQueryChange={(q) => {
              setSearchQuery(q);
              runSearch(q);
            }}
            onRideYes={(m) => navigate(ridePath(m, false))}
            onRideNo={(m) => navigate(ridePath(m, true))}
            onPreview={(m) => navigate(`/preview/${m.id}`)}
            onSearch={(q) => {
              setSearchQuery(q);
              runSearch(q);
              document.getElementById('markets')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        )}

        {!searchingMode && dailyChallenge && (
          <DailyChallenge
            market={dailyChallenge}
            dateStr={todayStr}
            onRide={(m) => navigate(ridePath(m, false))}
          />
        )}

        <div id="markets" className="scroll-mt-16">
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
            onPreview={(m) => navigate(`/preview/${m.id}`)}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
