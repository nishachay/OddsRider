import { useCallback, useEffect, useState } from 'react';
import PhaserGame from './game/PhaserGame';
import HudOverlay from './components/HudOverlay';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import DailyChallenge from './components/DailyChallenge';
import MarketGrid from './components/MarketGrid';
import TrackPreview from './components/TrackPreview';
import Footer from './components/Footer';
import { bus, EV } from './game/bus';
import {
  fetchAllMarkets,
  fetchRideForMarket,
  MASTER_MARKETS,
  type RideableMarket,
  type Ride,
} from './data/polymarket';
import { recordRun } from './data/playerStorage';

export default function App() {
  const [view, setView] = useState<'home' | 'preview' | 'game'>('home');
  const [markets, setMarkets] = useState<RideableMarket[]>(MASTER_MARKETS);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<RideableMarket>(MASTER_MARKETS[0]);

  // Load Markets and sync initial URL query state
  useEffect(() => {
    fetchAllMarkets().then((data) => setMarkets(data));

    const params = new URLSearchParams(window.location.search);
    const mId = params.get('market');
    const v = params.get('view');

    if (mId) {
      const found = MASTER_MARKETS.find((m) => m.id === mId || m.slug === mId);
      if (found) setSelectedMarket(found);
    }
    if (v === 'preview') setView('preview');
    else if (v === 'game') {
      setView('game');
    }
  }, []);

  const syncUrl = useCallback((newView: string, marketId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', newView);
    if (marketId) url.searchParams.set('market', marketId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Listen for finish / crash results
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

  const handleLaunchRide = async (market: RideableMarket) => {
    setSelectedMarket(market);
    setView('game');
    syncUrl('game', market.id);

    try {
      const ride: Ride = await fetchRideForMarket(market);
      setTimeout(() => {
        bus.emit(EV.LOAD_MARKET, ride);
      }, 60);
    } catch (e) {
      console.error('Failed to launch ride:', e);
    }
  };

  const handleGoHome = () => {
    setView('home');
    syncUrl('home');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#f0f0f2] font-sans antialiased">
      
      {/* ── 1. ACTIVE GAME SIMULATION VIEW ── */}
      {view === 'game' ? (
        <div className="fixed inset-0 overflow-hidden bg-bg z-50">
          <PhaserGame />
          <HudOverlay onOpenLobby={handleGoHome} />
        </div>
      ) : (
        /* ── 2. STONKRIDER-STYLE FULL WEBPAGE VIEW (NATURAL SCROLL) ── */
        <div className="w-full flex flex-col min-h-screen">
          <Navbar
            onGoHome={handleGoHome}
            onSelectTab={handleSelectCategory}
          />

          {view === 'preview' ? (
            <main className="flex-1">
              <TrackPreview
                market={selectedMarket}
                onLaunchRide={(m) => handleLaunchRide(m)}
                onBack={handleGoHome}
              />
            </main>
          ) : (
            <main className="flex-1 flex flex-col">
              <HeroSection
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                onSearchSubmit={() => {}}
              />

              <DailyChallenge
                market={MASTER_MARKETS[1]}
                onRide={(m) => handleLaunchRide(m)}
              />

              <MarketGrid
                markets={markets}
                activeCategory={activeCategory}
                searchQuery={searchQuery}
                onSelectMarket={handlePreviewMarket}
              />
            </main>
          )}

          <Footer />
        </div>
      )}

    </div>
  );
}
