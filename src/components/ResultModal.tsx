import { useCallback, useEffect, useState } from 'react';

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

function formatTime(ms: number): { main: string; ms: string } {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return {
    main: `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`,
    ms: `.${tenths}`
  };
}

export default function ResultModal({ isOpen, result, onRetry }: ResultModalProps) {
  const [copied, setCopied] = useState(false);

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

  const handleShare = useCallback(() => {
    if (!result) return;
    const timeObj = formatTime(result.timeMs);
    const probStr = result.finalProb !== undefined ? `${(result.finalProb * 100).toFixed(1)}% YES` : 'N/A';
    const statusStr = result.finished ? 'MARKET CONQUERED (100% RESOLVED)' : 'CRASHED // FATAL';
    
    const text = [
      `ODDSRIDER // ${statusStr}`,
      `Market: ${result.marketQuestion ?? 'Polymarket Event'}`,
      `Time: ${timeObj.main}${timeObj.ms} | Score: ${result.score.toLocaleString()} | Final Odds: ${probStr}`,
      `Ride the odds: https://oddsrider.com`
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [result]);

  if (!isOpen || !result) return null;

  const isSuccess = result.finished;
  const probPercent = result.finalProb !== undefined ? (result.finalProb * 100).toFixed(1) : null;
  const timeObj = formatTime(result.timeMs);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0b]/80 backdrop-blur-md select-none animate-in fade-in duration-200 font-sans p-4">
      <div className="relative w-full max-w-md bg-[#0e1014] border border-[#1f242d] p-6 sm:p-7 shadow-[0_16px_48px_rgba(0,0,0,0.85)]">
        
        {/* Tactical Corner Reticles */}
        <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>

        {/* ── 1. HEADER: SETTLEMENT STATUS ── */}
        <div className="flex items-start justify-between pb-5 border-b border-[#1f242d]">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-extrabold tracking-[0.24em] text-dim uppercase">
              ODDSRIDER // {isSuccess ? 'SETTLEMENT RECEIPT' : 'TELEMETRY DUMP'}
            </span>
            <span
              className={`font-display font-black text-xl tracking-wide uppercase ${
                isSuccess ? 'text-toxic' : 'text-crimson'
              }`}
              style={{ textShadow: isSuccess ? '0 0 14px rgba(182,255,0,0.4)' : '0 0 14px rgba(255,51,85,0.4)' }}
            >
              {isSuccess ? 'MARKET CONQUERED' : 'WRECKED // CRASHED'}
            </span>
          </div>

          <div
            className={`px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest uppercase border ${
              isSuccess 
                ? 'border-toxic/30 bg-toxic/8 text-toxic' 
                : 'border-crimson/30 bg-crimson/8 text-crimson'
            }`}
          >
            {isSuccess ? '100% RESOLVED' : 'FATAL'}
          </div>
        </div>

        {/* ── 2. CONTRACT SPECIFICATION (NO NESTED BOXES) ── */}
        {result.marketQuestion && (
          <div className="py-4 border-b border-[#1f242d] flex flex-col gap-2">
            <span className="text-[8px] font-extrabold tracking-[0.22em] text-dim uppercase">
              SETTLED CONTRACT
            </span>
            <span className="text-[13px] font-medium leading-[1.4] text-ink/90">
              {result.marketQuestion}
            </span>
            
            {probPercent !== null && (
              <div className="flex items-baseline gap-2 pt-1 font-mono">
                <span className="text-[8px] font-sans font-extrabold tracking-[0.2em] text-dim uppercase">
                  FINAL ODDS:
                </span>
                <span className={`text-sm font-black tabular-nums ${isSuccess ? 'text-toxic' : 'text-crimson'}`}>
                  {probPercent}%
                </span>
                <span className="font-sans text-[9px] font-extrabold tracking-widest text-ink">
                  YES
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── 3. PERFORMANCE TELEMETRY GRID ── */}
        <div className="grid grid-cols-2 py-4 border-b border-[#1f242d]">
          {/* Final Score */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[8px] font-extrabold tracking-[0.22em] text-dim uppercase">
              FINAL SCORE
            </span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink tracking-tight">
              {result.score.toLocaleString()}
            </span>
          </div>

          {/* Time Elapsed */}
          <div className="flex flex-col gap-0.5 pl-4 border-l border-[#1f242d]">
            <span className="text-[8px] font-extrabold tracking-[0.22em] text-dim uppercase">
              SESSION TIME
            </span>
            <div className="flex items-baseline font-mono tabular-nums">
              <span className="text-2xl font-bold text-ink tracking-tight">
                {timeObj.main}
              </span>
              <span className={`text-base font-bold ${isSuccess ? 'text-toxic' : 'text-crimson'}`}>
                {timeObj.ms}
              </span>
            </div>
          </div>
        </div>

        {/* ── 4. ACTION BUTTONS: RETRY + SHARE ── */}
        <div className="pt-5 flex items-center gap-3">
          <button
            onClick={onRetry}
            className={`flex-1 flex items-center justify-center gap-2 py-3 font-mono text-xs font-bold tracking-[0.2em] uppercase border transition-all duration-150 cursor-pointer ${
              isSuccess
                ? 'border-toxic bg-toxic/10 text-toxic hover:bg-toxic hover:text-bg hover:shadow-[0_0_20px_rgba(182,255,0,0.5)]'
                : 'border-crimson bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg hover:shadow-[0_0_20px_rgba(255,51,85,0.5)]'
            }`}
          >
            <span>[ RIDE AGAIN ]</span>
            <span className="font-sans text-[8px] font-extrabold opacity-75 tracking-normal">
              (R)
            </span>
          </button>

          <button
            onClick={handleShare}
            className="px-4 py-3 font-mono text-xs font-bold tracking-[0.18em] uppercase border border-[#232529] bg-[#14161d] text-ink hover:border-toxic/60 hover:text-toxic transition-all duration-150 cursor-pointer"
            title="Copy run summary receipt to clipboard"
          >
            {copied ? '[ COPIED! ]' : '[ SHARE ]'}
          </button>
        </div>

      </div>
    </div>
  );
}
