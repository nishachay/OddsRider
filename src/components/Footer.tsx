import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="w-full border-t border-[#232529] bg-[#0a0a0b] select-none">
      <div className="w-full max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 justify-between">
        <div className="flex flex-col gap-2 max-w-sm">
          <div className="flex items-baseline tracking-[0.24em] uppercase font-display font-black text-sm">
            <span className="text-ink">Odds</span>
            <span className="text-toxic">Rider</span>
          </div>
          <p className="font-sans text-xs text-dim leading-relaxed">
            Real Polymarket probability charts turned into rideable motocross tracks.
          </p>
          <p className="font-mono text-[10px] text-dim leading-relaxed">
            Market data by Polymarket (Gamma + CLOB APIs). Not affiliated with Polymarket.
          </p>
        </div>

        <div className="flex gap-12 font-mono text-[11px]">
          <div className="flex flex-col gap-2">
            <span className="font-bold tracking-widest text-dim uppercase">Play</span>
            <Link to="/" className="text-ink hover:text-toxic transition-colors">Markets</Link>
            <Link to="/about" className="text-ink hover:text-toxic transition-colors">About</Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold tracking-widest text-dim uppercase">Legal</span>
            <Link to="/about#disclaimer" className="text-ink hover:text-toxic transition-colors">Disclaimer</Link>
            <Link to="/about#privacy" className="text-ink hover:text-toxic transition-colors">Privacy</Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[#1a1c22]">
        <div className="w-full max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-1 sm:items-center justify-between font-mono text-[10px] text-dim">
          <span>Not financial advice. No real betting — just a bike and a chart.</span>
          <span>All stats stay on your device.</span>
        </div>
      </div>
    </footer>
  );
}
