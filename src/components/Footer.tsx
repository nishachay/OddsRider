export default function Footer() {
  return (
    <footer className="w-full bg-[#0a0a0b] border-t border-[#232529] mt-24 py-16 select-none font-sans">
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand */}
        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-xl">
            <span className="text-ink">ODDS</span>
            <span className="text-toxic">RIDER</span>
          </div>
          <p className="text-xs text-dim max-w-xs leading-relaxed">
            Real Polymarket prediction odds and orderbook probabilities turned into 2D motocross tracks you can ride.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 border border-[#232529] bg-[#101113] font-mono text-[10px] text-dim hover:text-ink transition-colors cursor-pointer"
            >
              [ 𝕏 TWITTER ]
            </a>
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 border border-[#232529] bg-[#101113] font-mono text-[10px] text-dim hover:text-toxic transition-colors cursor-pointer"
            >
              [ POLYMARKET API ]
            </a>
          </div>
        </div>

        {/* Play */}
        <div className="flex flex-col gap-2.5 text-xs text-dim">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink mb-1">
            RACE
          </span>
          <span className="hover:text-toxic cursor-pointer">Live Prediction Odds</span>
          <span className="hover:text-toxic cursor-pointer">Daily Challenge Track</span>
          <span className="hover:text-toxic cursor-pointer">Historic Market Crashes</span>
          <span className="hover:text-toxic cursor-pointer">Global Leaderboard</span>
        </div>

        {/* Company */}
        <div className="flex flex-col gap-2.5 text-xs text-dim">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink mb-1">
            PROJECT
          </span>
          <span className="hover:text-toxic cursor-pointer">About OddsRider</span>
          <span className="hover:text-toxic cursor-pointer">How Odds Become Slopes</span>
          <span className="hover:text-toxic cursor-pointer">Terms of Use</span>
          <span className="hover:text-toxic cursor-pointer">Privacy Policy</span>
        </div>

      </div>

      <div className="max-w-5xl mx-auto px-4 mt-12 pt-6 border-t border-[#232529] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10.5px] text-dim">
        <span>Built with real Polymarket prediction data • For entertainment only • Not financial advice</span>
        <span>ODDSRIDER // PRODUCTION</span>
      </div>
    </footer>
  );
}
