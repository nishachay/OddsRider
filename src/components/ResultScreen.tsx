import { useEffect } from 'react';
import { starsFor } from '../game/score';
import type { Difficulty } from '../data/tracks';
import type { MarketBest } from '../data/playerStorage';

export interface ResultScreenData {
  finished: boolean;
  score: number;
  timeMs: number;
  difficulty: Difficulty;
  /** 0..1 along the course where the run ended. */
  progress: number;
  question: string;
  /** "14 MAR" style, from the frozen track's own timestamps. */
  crashDate: string | null;
  best: MarketBest;
  isNewBest: boolean;
}

interface ResultScreenProps {
  result: ResultScreenData;
  onRetry: () => void;
  onWatchReplay: () => void;
  onShare: () => void;
  onNextTrack: (() => void) | null;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

// Full result screen: what happened, where on the curve, the score, and the
// four ways forward. Race-day chrome: Anton poster, mono data, momentum
// colour, no brackets, no reticles.
export default function ResultScreen({ result, onRetry, onWatchReplay, onShare, onNextTrack }: ResultScreenProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRetry]);

  const accent = result.finished ? 'text-toxic' : 'text-crimson';
  const accentBg = result.finished ? 'bg-toxic' : 'bg-crimson';
  const headline = result.finished
    ? `Finished · ${formatTime(result.timeMs)}`
    : `Crashed at ${Math.round(result.progress * 100)}%${result.crashDate ? ` · ${result.crashDate}` : ''}`;
  const stars = starsFor(result.score, result.difficulty);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0a0a0b]/80 select-none p-4">
      <div className="rise w-full max-w-xl bg-[#0e1014] border border-[#232529] shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <div className={`h-[3px] w-full ${accentBg}`} />

        <div className="px-5 sm:px-7 pt-5 pb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-dim uppercase">
              {result.finished ? 'Run complete' : 'Run over'} · {result.difficulty} track
              {result.isNewBest && <span className="text-toxic"> · New best</span>}
            </span>
            <h2 className={`font-poster uppercase leading-[0.95] text-4xl sm:text-5xl ${accent}`}>
              {headline}
            </h2>
            <p className="font-display font-bold text-[15px] text-ink leading-snug pt-1">
              {result.question}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 border-y border-[#232529] py-4">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Score</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-ink">
                {result.score.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-l border-[#232529] pl-4">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Best</span>
              <span className="font-mono text-2xl font-bold tabular-nums text-ink">
                {result.best.best.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-col gap-1 border-l border-[#232529] pl-4">
              <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Rating</span>
              <span className="font-mono text-lg font-black tracking-[0.14em] text-toxic" aria-label={`${stars} out of 5 stars`}>
                {'★'.repeat(stars)}
                <span className="text-[#2a2e38]">{'★'.repeat(Math.max(0, 5 - stars))}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRetry}
              className={`py-3.5 font-mono text-xs font-bold tracking-[0.16em] uppercase border transition-all cursor-pointer min-h-[52px] ${
                result.finished
                  ? 'bg-toxic text-bg border-toxic hover:bg-toxic/90'
                  : 'bg-crimson/10 text-crimson border-crimson/40 hover:bg-crimson hover:text-bg'
              } active:scale-[0.99]`}
            >
              Ride again · R
            </button>
            <button
              onClick={onWatchReplay}
              className="py-3.5 font-mono text-xs font-bold tracking-[0.16em] uppercase bg-transparent text-ink border border-[#232529] hover:border-toxic/60 hover:text-toxic transition-all cursor-pointer min-h-[52px] active:scale-[0.99]"
            >
              Watch replay
            </button>
            <button
              onClick={onShare}
              className="py-3.5 font-mono text-xs font-bold tracking-[0.16em] uppercase bg-transparent text-ink border border-[#232529] hover:border-toxic/60 hover:text-toxic transition-all cursor-pointer min-h-[52px] active:scale-[0.99]"
            >
              Share
            </button>
            {onNextTrack ? (
              <button
                onClick={onNextTrack}
                className="py-3.5 font-mono text-xs font-bold tracking-[0.16em] uppercase bg-transparent text-ink border border-[#232529] hover:border-toxic/60 hover:text-toxic transition-all cursor-pointer min-h-[52px] active:scale-[0.99]"
              >
                Next track →
              </button>
            ) : (
              <span className="py-3.5 font-mono text-[10px] text-dim tracking-[0.14em] uppercase flex items-center justify-center border border-transparent">
                {result.best.plays} ride{result.best.plays === 1 ? '' : 's'} on this track
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
