import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="w-full flex flex-col min-h-screen">
      <Navbar onGoHome={() => navigate('/')} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10 select-none">
        <div className="flex flex-col gap-3">
          <h1 className="font-display font-black text-3xl sm:text-4xl text-ink tracking-tight">
            About OddsRider
          </h1>
          <p className="font-sans text-sm text-dim leading-relaxed">
            OddsRider turns real Polymarket probability charts into rideable motocross tracks.
            Pick a market, ride what the crowd believes — every rally is a climb, every crash is a cliff.
          </p>
        </div>

        <section id="disclaimer" className="flex flex-col gap-2 scroll-mt-20">
          <h2 className="font-mono text-xs font-bold tracking-[0.24em] text-toxic uppercase">
            Disclaimer
          </h2>
          <p className="font-sans text-sm text-dim leading-relaxed">
            OddsRider is a game. Nothing here is financial advice, and nothing here is betting —
            no real money, no positions, no payouts. Market data is shown for entertainment as
            terrain. OddsRider is not affiliated with Polymarket.
          </p>
        </section>

        <section id="data" className="flex flex-col gap-2 scroll-mt-20">
          <h2 className="font-mono text-xs font-bold tracking-[0.24em] text-toxic uppercase">
            Data
          </h2>
          <p className="font-sans text-sm text-dim leading-relaxed">
            Market discovery uses Polymarket's public Gamma API and price histories come from the
            public CLOB API. Probabilities shown are last-trade prices. When the live feed is
            unreachable, the site falls back to a clearly-marked cached feed. We never invent
            odds — if history is missing, a track simply cannot be built.
          </p>
        </section>

        <section id="privacy" className="flex flex-col gap-2 scroll-mt-20">
          <h2 className="font-mono text-xs font-bold tracking-[0.24em] text-toxic uppercase">
            Privacy
          </h2>
          <p className="font-sans text-sm text-dim leading-relaxed">
            There are no accounts and no tracking. Your rides, scores, and cached markets live
            only in your own browser's local storage. Clear your site data and it's all gone.
          </p>
        </section>

        <Link
          to="/"
          className="self-start font-mono text-xs font-bold tracking-widest text-toxic border border-toxic/40 px-4 py-2 hover:bg-toxic hover:text-bg transition-colors"
        >
          [ BACK TO MARKETS ]
        </Link>
      </main>

      <Footer />
    </div>
  );
}
