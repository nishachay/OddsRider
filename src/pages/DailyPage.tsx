import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import TopStrip from '../components/TopStrip';
import MiniTrack from '../components/MiniTrack';
import { useMarkets } from '../data/marketsContext';
import { getDailyChallenge, momentumUp, type RideableMarket } from '../data/tracks';
import { getMarketBest as getBest } from '../data/playerStorage';

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDateStr(s: string | null): s is string {
  return s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

function useCountdownToMidnightUtc(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  const ms = Math.max(0, next - now);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))}`;
}

// One track per UTC day, same for everyone. `?date=YYYY-MM-DD` pins the day
// (used by the smoke test); otherwise the track is picked from today's date.
export default function DailyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { markets, loading, feedError, reload } = useMarkets();
  const dateStr = isDateStr(searchParams.get('date')) ? (searchParams.get('date') as string) : utcToday();
  const countdown = useCountdownToMidnightUtc();

  const pick: RideableMarket | null = useMemo(
    () => getDailyChallenge(markets, dateStr),
    [markets, dateStr],
  );
  const best = pick ? getBest(pick.id) : null;

  const pct = pick ? Math.round(pick.currentProb * 100) : 0;
  const up = momentumUp(pick?.probDelta ?? null);

  return (
    <div className="w-full flex flex-col min-h-screen bg-[#0a0a0b] text-[#f0f0f2]">
      <TopStrip />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-10 pb-16 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-amber-400 uppercase">
            Daily ride · {dateStr}
          </span>
          <h1 className="font-poster uppercase leading-[0.95] text-5xl sm:text-6xl text-ink">
            One track. Everyone.
          </h1>
          <p className="font-mono text-[11px] text-dim tracking-[0.14em] uppercase">
            Same ride for every rider today · next drop in {countdown}
          </p>
        </div>

        {loading && !pick ? (
          <div className="flex flex-col gap-4 py-16 items-start">
            <div className="shimmer h-[3px] w-56" />
            <span className="font-mono text-[11px] tracking-[0.3em] text-dim uppercase">Loading daily…</span>
          </div>
        ) : feedError && !pick ? (
          <div className="border border-amber-400/40 border-l-4 border-l-amber-400 bg-amber-400/5 px-4 py-3 font-mono text-[11px] text-amber-400 flex flex-wrap items-center justify-between gap-2">
            <span>TRACK INDEX UNREACHABLE — CHECK YOUR CONNECTION AND RETRY.</span>
            <button
              onClick={reload}
              className="shrink-0 font-bold tracking-widest hover:bg-amber-400 hover:text-bg px-2 py-1 transition-colors cursor-pointer uppercase"
            >
              Retry →
            </button>
          </div>
        ) : pick ? (
          <section className="border border-[#3a2f12] bg-[#12100a] border-l-4 border-l-amber-400 px-5 sm:px-8 py-6 flex flex-col gap-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6 justify-between">
              <div className="flex flex-col gap-2 min-w-0">
                <span className="font-mono text-[10px] font-extrabold tracking-[0.24em] text-amber-400 uppercase">
                  Feature race · {pick.kind === 'closed' && pick.resolution ? `Resolved ${pick.resolution}` : pick.live ? 'Live track' : 'Settled track'}
                </span>
                <p className="font-display font-bold text-xl sm:text-2xl text-ink leading-snug">
                  {pick.question}
                </p>
                <span className="font-mono text-[11px] text-dim tabular-nums">
                  <span className={`text-base font-bold ${up ? 'text-toxic' : 'text-crimson'}`}>{pct}%</span>{' '}
                  YES ·{' '}
                  {best && best.plays > 0 ? (
                    <>YOUR BEST {best.best.toLocaleString()} · {best.plays} RIDE{best.plays === 1 ? '' : 'S'}</>
                  ) : (
                    <>NO RIDES YET — SET THE LINE</>
                  )}
                </span>
              </div>
              <button
                onClick={() => navigate(`/ride/${pick.id}`)}
                className="shrink-0 px-8 py-4 bg-amber-400 text-bg font-mono text-sm font-bold tracking-[0.16em] uppercase hover:bg-amber-300 active:scale-[0.98] transition-all cursor-pointer"
              >
                Ride →
              </button>
            </div>
            <div className="border-t border-[#3a2f12] pt-4 flex flex-col gap-2">
              <MiniTrack pts={pick.sparkline} deltaUp={up} />
              <p className="font-mono text-[10px] tracking-[0.2em] text-dim uppercase">
                Today&apos;s terrain · W gas · A/D lean · Space jump · Shift nitro
              </p>
            </div>
          </section>
        ) : (
          <p className="font-mono text-xs text-dim uppercase tracking-[0.18em] py-16 text-center">
            No tracks published yet.
          </p>
        )}

        <Link
          to="/"
          className="self-start font-mono text-xs font-bold tracking-[0.2em] text-toxic border-b-2 border-toxic/40 px-1 py-2 hover:bg-toxic hover:text-bg transition-colors uppercase"
        >
          ← Back to title
        </Link>
      </main>
    </div>
  );
}
