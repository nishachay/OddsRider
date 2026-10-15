import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import TrackPreview from '../components/TrackPreview';
import Footer from '../components/Footer';
import { useMarket } from '../data/marketsContext';
import { getMarketBest } from '../data/playerStorage';
import { ridePath } from './HomePage';

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
}

export default function PreviewPage() {
  const navigate = useNavigate();
  const { marketId } = useParams<{ marketId: string }>();
  const { market, loading } = useMarket(marketId);
  const best = market ? getMarketBest(market.id) : null;

  return (
    <div className="w-full flex flex-col min-h-screen">
      <Navbar onGoHome={() => navigate('/')} />

      <main className="flex-1">
        {market ? (
          <>
            <TrackPreview
              market={market}
              onLaunchRide={(m, inv, tf) => navigate(ridePath(m, inv, tf))}
              onBack={() => navigate('/')}
            />

            {best && best.runs.length > 0 && (
              <section className="w-full max-w-4xl mx-auto px-4 pb-10 select-none">
                <div className="border border-[#232529] bg-[#101113] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#232529]">
                    <h2 className="font-mono text-[10px] font-bold tracking-[0.24em] text-dim uppercase">
                      Your runs on this track
                    </h2>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-dim uppercase">
                      Best <span className="text-toxic tabular-nums">{best.best.toLocaleString()}</span>
                      {' · '}
                      {best.plays} play{best.plays === 1 ? '' : 's'}
                      {' · '}
                      {best.wins} win{best.wins === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    {best.runs.map((r, i) => (
                      <div
                        key={`${r.at}-${i}`}
                        className="flex items-center justify-between py-2.5 border-b border-[#1a1c22] last:border-0 font-mono text-xs"
                      >
                        <span className={r.finished ? 'text-toxic' : 'text-crimson'}>
                          {r.finished ? 'FINISHED' : 'CRASHED'}
                        </span>
                        <span className="text-ink tabular-nums">{r.score.toLocaleString()} PTS</span>
                        <span className="text-dim tabular-nums">{fmtTime(r.timeMs)}</span>
                        <span className="text-dim">
                          {new Date(r.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        ) : loading ? (
          <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center font-mono text-xs text-dim">
            LOADING FROZEN TRACK...
          </div>
        ) : (
          <div className="w-full max-w-4xl mx-auto px-4 py-24 text-center flex flex-col items-center gap-4">
            <p className="font-mono text-xs text-dim">
              TRACK NOT FOUND: {marketId}
            </p>
            <Link
              to="/"
              className="font-mono text-xs font-bold tracking-widest text-toxic border border-toxic/40 px-4 py-2 hover:bg-toxic hover:text-bg transition-colors"
            >
              [ BACK TO MARKETS ]
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
