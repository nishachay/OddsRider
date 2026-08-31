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

    // Read initial URL params
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

  // Sync view & market to URL params so refresh & share links work
  const syncUrl = useCallback((newView: string, marketId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', newView);
    if (marketId) url.searchParams.set('market', marketId);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // Listen for game finish / crash results to persist player stats
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

  // Actions
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

  const handleLaunchRide = async (market: RideableMarket, inverted = false, timeframe = 'ALL') => {
    setSelectedMarket(market);
    setView('game');
    syncUrl('game', market.id);

    try {
      const ride: Ride = await fetchRideForMarket(market, inverted, timeframe);
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
    <main className="min-h-screen bg-[#0a0a0b] text-ink font-sans">
      
      {/* ── 1. ACTIVE GAME SIMULATION VIEW ── */}
      {view === 'game' ? (
        <div className="fixed inset-0 overflow-hidden bg-bg">
          <PhaserGame />
          <HudOverlay onOpenLobby={handleGoHome} />
        </div>
      ) : (
        /* ── 2. FULL HOME & TRACK INSPECTION WEB VIEWS ── */
        <div className="w-full flex flex-col min-h-screen">
          {/* Universal Sticky Top Nav */}
          <Navbar
            activeTab={activeCategory}
            onSelectTab={handleSelectCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onGoHome={handleGoHome}
          />

          {view === 'preview' ? (
            /* Dedicated Track Inspection Stage (Polymarket Single Market + StonkRider Preview) */
            <div className="flex-1">
              <TrackPreview
                market={selectedMarket}
                onLaunchRide={(m, inv, tf) => handleLaunchRide(m, inv, tf)}
                onBack={handleGoHome}
              />
            </div>
          ) : (
            /* Main Home Landing Page Feed */
            <div className="flex-1 flex flex-col">
              {/* StonkRider Hero Section */}
              <HeroSection onExploreClick={() => {}} />

              {/* Daily Challenge Spotlight Banner */}
              <DailyChallenge
                market={MASTER_MARKETS[1]}
                onRide={(m) => handleLaunchRide(m, false)}
                onPreview={handlePreviewMarket}
              />

              {/* Polymarket-Style Live Racetracks Feed Grid */}
              <MarketGrid
                markets={markets}
                activeCategory={activeCategory}
                onSelectCategory={setActiveCategory}
                searchQuery={searchQuery}
                onRideYes={(m) => handleLaunchRide(m, false)}
                onRideNo={(m) => handleLaunchRide(m, true)}
                onPreview={handlePreviewMarket}
              />
            </div>
          )}

          {/* Production Footer */}
          <Footer />
        </div>
      )}

    </main>
  );
}
