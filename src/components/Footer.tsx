export default function Footer() {
  return (
    <footer className="w-full bg-[#0a0a0b] border-t border-[#1f242d] mt-20 py-12 select-none">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand Column */}
        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="flex items-baseline tracking-[0.22em] uppercase font-display font-black text-xl">
            <span className="text-ink">ODDS</span>
            <span className="text-toxic">RIDER</span>
          </div>
          <p className="text-xs text-dim max-w-sm leading-relaxed">
            Real prediction market orderbooks and live Polymarket probabilities turned into 2D physics motocross tracks you can ride and conquer.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 border border-[#1f242d] bg-[#12141a] flex items-center justify-center text-xs text-dim hover:text-toxic hover:border-toxic/40 transition-colors"
            >
              𝕏
            </a>
            <a
              href="https://polymarket.com"
              target="_blank"
              rel="noreferrer"
              className="px-2.5 h-8 border border-[#1f242d] bg-[#12141a] flex items-center justify-center font-mono text-[9.5px] font-bold text-dim hover:text-toxic hover:border-toxic/40 transition-colors"
            >
              POLYMARKET API
            </a>
          </div>
        </div>

        {/* Play Links */}
        <div className="flex flex-col gap-2 font-mono text-xs">
          <span className="text-[10px] font-extrabold tracking-widest text-ink uppercase mb-1">
            RACE
          </span>
          <span className="text-dim hover:text-toxic cursor-pointer">Live Markets</span>
          <span className="text-dim hover:text-toxic cursor-pointer">Daily Challenge</span>
          <span className="text-dim hover:text-toxic cursor-pointer">Legendary Crashes</span>
          <span className="text-dim hover:text-toxic cursor-pointer">Global Leaderboard</span>
        </div>

        {/* Company & Legal */}
        <div className="flex flex-col gap-2 font-mono text-xs">
          <span className="text-[10px] font-extrabold tracking-widest text-ink uppercase mb-1">
            PROJECT
          </span>
          <span className="text-dim hover:text-toxic cursor-pointer">About OddsRider</span>
          <span className="text-dim hover:text-toxic cursor-pointer">How It Works</span>
          <span className="text-dim hover:text-toxic cursor-pointer">Physics Derivation</span>
          <span className="text-dim hover:text-toxic cursor-pointer">Source Code</span>
        </div>

      </div>

      <div className="max-w-6xl mx-auto px-4 mt-10 pt-6 border-t border-[#181a22] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[10px] text-dim">
        <span>Built with real Polymarket prediction data • For entertainment only • Not financial advice</span>
        <span>ODDSRIDER v2.0 • PRODUCTION</span>
      </div>
    </footer>
  );
}
