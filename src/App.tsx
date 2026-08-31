import { useCallback, useEffect, useState } from 'react';
import PhaserGame from './game/PhaserGame';
import HudOverlay from './components/HudOverlay';
import Navbar from './components/Navbar';
import HeroSpotlight from './components/HeroSpotlight';
import MarketGrid from './components/MarketGrid';
import TrackPreview from './components/TrackPreview';
import Footer from './components/Footer';
import { bus, EV } from './game/bus';
import {
  fetchAllMarkets,
  fetchRideForMarket,
  CURATED_POLYMARKET_FEED,
  type RideableMarket,
  type Ride,
} from './data/polymarket';
import { recordRun } from './data/playerStorage';

export default function App() {
  const [view, setView] = useState<'home' | 'preview' | 'game'>('home');
  const [markets, setMarkets] = useState<RideableMarket[]>(CURATED_POLYMARKET_FEED);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<RideableMarket>(CURATED_POLYMARKET_FEED[0]);

  // Load live Polymarket data and sync URL query state
  useEffect(() => {
    fetchAllMarkets().then((data) => {
      if (data && data.length > 0) {
        setMarkets(data);
        const params = new URLSearchParams(window.location.search);
        const mId = params.get('market');
        if (mId) {
          const found = data.find((m) => m.id === mId || m.slug === mId);
          if (found) setSelectedMarket(found);
        } else {
          setSelectedMarket(data[0]);
        }
      }
    });

    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'preview') setView('preview');
    else if (v === 'game') setView('game');
  }, []);

  const syncUrl = useCallback((newView: string, marketId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', newView);
    if (marketId) url.searchParams.set('market', marketId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Listen for finish / crash results to persist player stats
  useEffect(() => {
    const offResult = bus.on<{ finished: boolean; score: number; timeMs: number } | null>(
      EV.RESULT,
      (res) => {
        if (res && selectedMarket) {
          recordRun(selectedMarket.id, res.score, res.finished);
        }
      }
    );
    return () => offResult();
  }, [selectedMarket]);

  const handleSelectCategory = (cat: string) => {
    setActiveCategory(cat);
    if (view !== 'home') {
      setView('home');
      syncUrl('home');
    }
  };

  const handlePreviewMarket = (market: RideableMarket) => {
    setSelectedMarket(market);
    setView('preview');
    syncUrl('preview', market.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLaunchRide = async (market: RideableMarket, inverted = false) => {
    setSelectedMarket(market);
    setView('game');
    syncUrl('game', market.id);

    try {
      const ride: Ride = await fetchRideForMarket(market, inverted);
      bus.emit(EV.LOAD_MARKET, ride);
    } catch (e) {
      console.error('Failed to launch ride:', e);
    }
  };

  const handleGoHome = () => {
    setView('home');
    syncUrl('home');
  };

  const heroFeaturedMarket = markets[0] ?? CURATED_POLYMARKET_FEED[0];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] font-sans antialiased">
      
      {/* ── 1. ALWAYS-WARM PHASER PHYSICS CANVAS (Zero-Latency Track Swaps) ── */}
      <div className={view === 'game' ? 'fixed inset-0 overflow-hidden bg-bg z-40' : 'fixed inset-0 pointer-events-none opacity-0 -z-50'}>
        <PhaserGame />
        {view === 'game' && <HudOverlay onOpenLobby={handleGoHome} />}
      </div>

      {/* ── 2. FULL POLYMARKET WEB EXPERIENCE (NATURAL SCROLL) ── */}
      {view !== 'game' && (
        <div className="w-full flex flex-col min-h-screen">
          <Navbar
            onGoHome={handleGoHome}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {view === 'preview' ? (
            <main className="flex-1">
              <TrackPreview
                market={selectedMarket}
                onLaunchRide={(m, inv) => handleLaunchRide(m, inv)}
                onBack={handleGoHome}
              />
            </main>
          ) : (
            <main className="flex-1 flex flex-col">
              {/* Top Spotlight: Real Live #1 Trending Polymarket Contract */}
              {activeCategory === 'ALL' && searchQuery.trim() === '' && (
                <HeroSpotlight
                  market={heroFeaturedMarket}
                  onRideYes={(m) => handleLaunchRide(m, false)}
                  onRideNo={(m) => handleLaunchRide(m, true)}
                  onPreview={handlePreviewMarket}
                />
              )}

              {/* High-Density Polymarket Contract Grid */}
              <MarketGrid
                markets={markets}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                onRideYes={(m) => handleLaunchRide(m, false)}
                onRideNo={(m) => handleLaunchRide(m, true)}
                onPreview={handlePreviewMarket}
              />
            </main>
          )}

          <Footer />
        </div>
      )}

    </div>
  );
}
