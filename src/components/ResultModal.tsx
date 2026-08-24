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
  const probPercent = result.finalProb !== undefined ? Math.round(result.finalProb * 100) : null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg border border-line bg-bg p-6 shadow-2xl">
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.32em] text-dim">ODDSRIDER TELEMETRY</div>
            <div
              className={`mt-1 font-display text-xl font-bold tracking-wider ${
                isSuccess ? 'text-toxic' : 'text-crimson'
              }`}
            >
              {isSuccess ? 'RIDE COMPLETED — MARKET CONQUERED' : 'CRASHED — PROBABILITY OVERLOAD'}
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

        {/* Market Question Box */}
        {result.marketQuestion && (
          <div className="mt-4 border border-line bg-surface/50 p-3.5">
            <div className="font-mono text-[9px] tracking-[0.28em] text-dim">LIVE POLYMARKET EVENT</div>
            <div className="mt-1 font-mono text-xs font-semibold text-ink line-clamp-2">
              {result.marketQuestion}
            </div>
            {probPercent !== null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="font-mono text-[10px] text-dim">FINAL ODDS:</span>
                <span className="font-mono text-xs font-bold text-toxic">{probPercent}% YES</span>
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="border border-line bg-bg p-3">
            <div className="font-mono text-[9px] tracking-[0.32em] text-dim">FINAL SCORE</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
              {result.score.toLocaleString()}
            </div>
          </div>
          <div className="border border-line bg-bg p-3">
            <div className="font-mono text-[9px] tracking-[0.32em] text-dim">TIME ELAPSED</div>
            <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-ink">
              {formatTime(result.timeMs)}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onRetry}
            className="flex-1 border border-toxic bg-toxic/10 py-3 font-mono text-xs font-bold tracking-widest text-toxic transition-all hover:bg-toxic hover:text-bg cursor-pointer"
          >
            [ 🔄 RIDE AGAIN ] <span className="text-[10px] opacity-75">(PRESS R)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
