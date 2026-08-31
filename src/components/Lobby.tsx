import { useEffect, useMemo, useState } from 'react';
import { fetchLobbyMarkets, fetchRideForMarket, type LobbyMarket, type Ride } from '../data/polymarket';
import { bus, EV } from '../game/bus';

interface LobbyProps {
  onSelectMarket: (ride: Ride) => void;
  onClose?: () => void;
}

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

function MiniSparkline({ pts, deltaUp }: { pts: number[]; deltaUp: boolean }) {
  if (!pts || pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const W = 180, H = 36;
  const strokeColor = deltaUp ? TOXIC : CRIMSON;

  const pointsStr = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((p - min) / range) * (H - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={W} height={H} className="w-full h-9 overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pointsStr}
      />
    </svg>
  );
}

export default function Lobby({ onSelectMarket }: LobbyProps) {
  const [markets, setMarkets] = useState<LobbyMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchLobbyMarkets().then((data) => {
      if (mounted) {
        setMarkets(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLaunch = async (market: LobbyMarket) => {
    setLaunchingId(market.id);
    try {
      const ride = await fetchRideForMarket(market);
      onSelectMarket(ride);
    } catch (e) {
      console.error('Launch failed:', e);
      setLaunchingId(null);
    }
  };

  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      const matchCat = activeCategory === 'ALL' || m.category === activeCategory;
      const matchQuery = !searchQuery || m.question.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [markets, activeCategory, searchQuery]);

  const featured = markets[0];

  return (
    <div className="fixed inset-0 z-40 bg-[#0a0a0b] text-ink font-sans overflow-y-auto select-none p-4 sm:p-8 lg:p-12 flex flex-col items-center">
      
      {/* ── 1. HEADER BRAND & TERMINAL WORDMARK ── */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#1f242d]">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-2xl sm:text-3xl">
            <span className="text-ink">ODDS</span>
            <span style={{ color: TOXIC }}>RIDER</span>
          </div>
          <span className="font-mono text-[9px] font-bold tracking-[0.22em] text-dim uppercase">
            // DECENTRALIZED PROBABILITY RACETRACK LOBBY
          </span>
        </div>

        {/* Live Market Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#1f242d] bg-[#12141a]">
            <div className="w-2 h-2 bg-toxic animate-ping" />
            <span className="font-mono text-[9.5px] font-bold text-toxic tracking-widest uppercase">
              LIVE DATA FEED
            </span>
          </div>
          <span className="font-mono text-xs text-dim">
            {markets.length} TRACKS LOADED
          </span>
        </div>
      </header>

      {/* ── 2. HERO FEATURED CONTRACT OF THE DAY ── */}
      {featured && (
        <section className="w-full max-w-6xl mt-6 relative border border-[#232529] bg-[#0e1014] p-6 sm:p-8 shadow-[0_16px_40px_rgba(0,0,0,0.8)]">
          {/* Tactical Corner Reticles */}
          <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
          <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
          <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>
          <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none">+</span>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex-1 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] font-extrabold tracking-[0.22em] text-toxic uppercase px-2 py-0.5 border border-toxic/30 bg-toxic/8">
                  FEATURED RACE OF THE DAY
                </span>
                <span className="font-mono text-[9px] font-bold tracking-widest text-dim uppercase border border-[#1f242d] px-2 py-0.5">
                  {featured.category ?? 'MARKET'}
                </span>
              </div>

              <h2 className="font-display font-bold text-xl sm:text-2xl text-ink leading-snug">
                {featured.question}
              </h2>

              <div className="flex flex-wrap items-baseline gap-6 pt-2 font-mono">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                    PROBABILITY:
                  </span>
                  <span className="text-3xl font-black tabular-nums text-toxic tracking-tight">
                    {(featured.currentProb * 100).toFixed(1)}%
                  </span>
                  <span className="font-sans text-[10px] font-extrabold tracking-widest text-ink">
                    YES
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                    24H SHIFT:
                  </span>
                  <span
                    className={`text-base font-bold tabular-nums ${
                      featured.probDelta >= 0 ? 'text-toxic' : 'text-crimson'
                    }`}
                  >
                    {featured.probDelta >= 0 ? '+' : ''}{(featured.probDelta * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-sans text-[8.5px] font-extrabold tracking-[0.2em] text-dim uppercase">
                    TERRAIN PROFILE:
                  </span>
                  <span className="text-xs font-bold text-ink/80 tracking-wide uppercase">
                    {featured.volatilityLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Launch Hero Track Button */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-3 min-w-[220px]">
              <div className="w-48 h-10 border border-[#1f242d] bg-[#0a0a0b]/60 p-1 flex items-center justify-center">
                <MiniSparkline pts={featured.sparkline} deltaUp={featured.probDelta >= 0} />
              </div>

              <button
                onClick={() => handleLaunch(featured)}
                disabled={launchingId !== null}
                className="w-full py-3.5 px-6 font-mono text-xs font-bold tracking-[0.2em] uppercase border border-toxic bg-toxic/15 text-toxic hover:bg-toxic hover:text-bg hover:shadow-[0_0_24px_rgba(182,255,0,0.5)] transition-all cursor-pointer text-center"
              >
                {launchingId === featured.id ? '[ LOADING TERRAIN... ]' : '[ RIDE THIS CONTRACT ]'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. FILTER & SEARCH CONTROL BAR ── */}
      <div className="w-full max-w-6xl mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CRYPTO', 'POLITICS', 'MACRO', 'TECH'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase border transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'border-toxic bg-toxic/10 text-toxic'
                  : 'border-[#1f242d] bg-[#12141a] text-dim hover:text-ink hover:border-[#2f3542]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Filter Input */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            placeholder="SEARCH CONTRACTS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#12141a] border border-[#1f242d] px-3 py-1.5 font-mono text-[11px] text-ink placeholder:text-dim/60 focus:border-toxic/60 focus:outline-none"
          />
        </div>
      </div>

      {/* ── 4. RACETRACK FEED GRID ── */}
      <div className="w-full max-w-6xl mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-2 border border-[#1f242d] bg-[#0e1014]">
            <span className="font-mono text-xs font-bold text-toxic animate-pulse tracking-widest">
              QUERYING POLYMARKET CLOB ORDERBOOKS...
            </span>
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="col-span-full py-12 flex flex-col items-center justify-center border border-[#1f242d] bg-[#0e1014]">
            <span className="font-mono text-xs text-dim tracking-widest uppercase">
              NO MATCHING CONTRACTS FOUND
            </span>
          </div>
        ) : (
          filteredMarkets.map((market) => {
            const deltaUp = market.probDelta >= 0;
            const isLaunching = launchingId === market.id;

            return (
              <div
                key={market.id}
                className="relative flex flex-col justify-between border border-[#1f242d] bg-[#0e1014] p-5 hover:border-[#333a48] transition-all group"
              >
                {/* Top Badge & Volatility Tag */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#181a22]">
                  <span className="font-mono text-[8.5px] font-bold tracking-widest text-dim uppercase border border-[#1f242d] px-1.5 py-0.5">
                    {market.category ?? 'MARKET'}
                  </span>
                  <span className="font-mono text-[8.5px] font-extrabold tracking-widest text-dim/80 uppercase">
                    {market.volatilityLabel}
                  </span>
                </div>

                {/* Contract Question */}
                <h3 className="font-display font-semibold text-[14px] leading-snug text-ink/90 pt-3 flex-1">
                  {market.question}
                </h3>

                {/* Probability & Sparkline Area */}
                <div className="pt-4 flex items-end justify-between gap-2">
                  <div className="flex flex-col gap-0.5 font-mono">
                    <span className="text-[8px] font-extrabold tracking-[0.2em] text-dim uppercase font-sans">
                      ODDS (YES)
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`text-2xl font-black tabular-nums ${
                          deltaUp ? 'text-toxic' : 'text-crimson'
                        }`}
                      >
                        {(market.currentProb * 100).toFixed(1)}%
                      </span>
                      <span
                        className={`text-[9.5px] font-bold tabular-nums ${
                          deltaUp ? 'text-toxic' : 'text-crimson'
                        }`}
                      >
                        {deltaUp ? '+' : ''}{(market.probDelta * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Sparkline */}
                  <div className="w-24 h-8 opacity-80 group-hover:opacity-100 transition-opacity">
                    <MiniSparkline pts={market.sparkline} deltaUp={deltaUp} />
                  </div>
                </div>

                {/* Action Ride Button */}
                <div className="pt-4 border-t border-[#181a22] mt-4">
                  <button
                    onClick={() => handleLaunch(market)}
                    disabled={launchingId !== null}
                    className="w-full py-2.5 font-mono text-[10px] font-bold tracking-[0.18em] uppercase border border-[#232529] bg-[#12141a] text-ink group-hover:border-toxic group-hover:bg-toxic/10 group-hover:text-toxic transition-all cursor-pointer text-center"
                  >
                    {isLaunching ? '[ GENERATING TRACK... ]' : '[ RIDE TRACK ]'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 5. HOW IT WORKS TERMINAL GUIDE ── */}
      <footer className="w-full max-w-6xl mt-12 pt-6 border-t border-[#1f242d] grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] font-extrabold text-toxic tracking-widest">
            01 // CHOOSE CONTRACT
          </span>
          <span className="text-[11px] text-dim leading-relaxed">
            Real Polymarket live probabilities dictate the physical topography and slope steepness.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] font-extrabold text-toxic tracking-widest">
            02 // RIDE THE PROBABILITY
          </span>
          <span className="text-[11px] text-dim leading-relaxed">
            Surging odds create steep neon uphill jumps. Market crashes create treacherous red drop-offs.
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] font-extrabold text-toxic tracking-widest">
            03 // SETTLE & SHARE
          </span>
          <span className="text-[11px] text-dim leading-relaxed">
            Cross the finish gate without wiping out to claim your verified settlement receipt card.
          </span>
        </div>
      </footer>

    </div>
  );
}
