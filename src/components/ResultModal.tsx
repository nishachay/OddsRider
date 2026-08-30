import { useEffect } from 'react';

interface ResultModalProps {
  isOpen: boolean;
  result: {
    finished: boolean;
    score: number;
    timeMs: number;
    marketQuestion?: string;
    finalProb?: number;
  } | null;
  onRetry: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export default function ResultModal({ isOpen, result, onRetry }: ResultModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onRetry();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onRetry]);

  if (!isOpen || !result) return null;

  const isSuccess = result.finished;
  const probPercent = result.finalProb !== undefined ? (result.finalProb * 100).toFixed(1) : null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0b]/85 backdrop-blur-sm select-none animate-in fade-in duration-200 font-sans">
      <div className="w-full max-w-lg border border-line bg-bg p-6 shadow-2xl">
        {/* Header Status */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <div className="text-[8px] font-extrabold tracking-[0.24em] text-dim uppercase">ODDSRIDER TELEMETRY</div>
            <div
              className={`mt-1 font-display text-lg font-black tracking-wider uppercase ${
                isSuccess ? 'text-toxic' : 'text-crimson'
              }`}
            >
              {isSuccess ? 'MARKET CONQUERED' : 'CRASHED - PROBABILITY OVERLOAD'}
            </div>
          </div>
          <div
            className={`border px-2.5 py-1 font-mono text-xs font-bold tracking-widest ${
              isSuccess ? 'border-toxic/40 bg-toxic/10 text-toxic' : 'border-crimson/40 bg-crimson/10 text-crimson'
            }`}
          >
            {isSuccess ? 'FINISH 100%' : 'WRECKED'}
          </div>
        </div>

        {/* Market Event Box */}
        {result.marketQuestion && (
          <div className="mt-4 border border-line bg-surface/50 p-3.5">
            <div className="text-[8px] font-bold tracking-[0.22em] text-dim uppercase">LIVE EVENT</div>
            <div className="mt-1 text-xs font-medium leading-snug text-ink/90">
              {result.marketQuestion}
            </div>
            {probPercent !== null && (
              <div className="mt-2.5 flex items-center gap-2 font-mono text-xs">
                <span className="text-[9px] font-bold text-dim tracking-wider uppercase">FINAL ODDS:</span>
                <span className={`font-bold ${isSuccess ? 'text-toxic' : 'text-crimson'}`}>{probPercent}% YES</span>
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="border border-line bg-bg p-3.5">
            <div className="text-[8px] font-bold tracking-[0.22em] text-dim uppercase">FINAL SCORE</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
              {result.score.toLocaleString()}
            </div>
          </div>
          <div className="border border-line bg-bg p-3.5">
            <div className="text-[8px] font-bold tracking-[0.22em] text-dim uppercase">TIME ELAPSED</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
              {formatTime(result.timeMs)}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onRetry}
            className={`flex-1 border py-3 font-mono text-xs font-bold tracking-widest transition-all cursor-pointer ${
              isSuccess ? 'border-toxic bg-toxic/10 text-toxic hover:bg-toxic hover:text-bg' : 'border-crimson bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg'
            }`}
          >
            [ RIDE AGAIN ] <span className="text-[10px] opacity-75 font-sans">(PRESS R)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
