import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { downloadShareCardImage, shareToTwitter } from '../utils/shareCard';

interface ResultModalProps {
  isOpen: boolean;
  result: {
    finished: boolean;
    score: number;
    timeMs: number;
    marketQuestion?: string;
    finalProb?: number;
    trackPts?: Array<[number, number]> | null;
  } | null;
  onRetry: () => void;
  onOpenLobby?: () => void;
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

const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

// Inline Settlement Chart Graphic Component (Visual Twin of Share Card)
function SettlementChartCanvas({ pts, isSuccess }: { pts: Array<[number, number]> | null; isSuccess: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const CW = 420, CH = 110, CP = 8;
  const accent = isSuccess ? TOXIC : CRIMSON;

  const geo = useMemo(() => {
    if (!pts || pts.length < 2) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }, [pts]);

  useEffect(() => {
    const c = ref.current; if (!c || !pts || !geo) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const sx = (CW - CP * 2) / Math.max(1, geo.x1 - geo.x0);
    const sy = (CH - CP * 2 - 16) / Math.max(1, geo.y1 - geo.y0);
    const px = (x: number) => CP + (x - geo.x0) * sx;
    const py = (y: number) => CP + 8 + (y - geo.y0) * sy;

    ctx.clearRect(0, 0, CW, CH);

    // Area fill under track line
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), CH);
    ctx.lineTo(px(pts[0][0]), py(pts[0][1]));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
    }
    ctx.lineTo(px(pts[pts.length - 1][0]), CH);
    const grad = ctx.createLinearGradient(0, 0, 0, CH);
    grad.addColorStop(0, isSuccess ? 'rgba(182, 255, 0, 0.22)' : 'rgba(255, 51, 85, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Track line segments
    ctx.lineWidth = 2.5;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = pts[i][1] <= pts[i - 1][1] ? TOXIC : CRIMSON;
      ctx.beginPath();
      ctx.moveTo(px(pts[i - 1][0]), py(pts[i - 1][1]));
      ctx.lineTo(px(pts[i][0]), py(pts[i][1]));
      ctx.stroke();
    }

    // Finish / Crash Marker Beacon
    const lastX = px(pts[pts.length - 1][0]);
    const lastY = py(pts[pts.length - 1][1]);

    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [pts, geo, isSuccess, accent]);

  if (!pts || pts.length < 2) return null;

  return (
    <div className="relative w-full h-[110px] overflow-hidden my-2 border border-[#1f242d] bg-[#0a0a0b]/60">
      <canvas ref={ref} width={CW} height={CH} className="w-full h-full" />
      <span className="absolute bottom-1 right-2 font-mono text-[8px] font-bold tracking-widest text-dim uppercase">
        {isSuccess ? 'SETTLED AT FINISH' : 'FATAL OVERLOAD POINT'}
      </span>
    </div>
  );
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

  const handleCopyLink = useCallback(() => {
    if (!result) return;
    const timeObj = formatTime(result.timeMs);
    const probStr = result.finalProb !== undefined ? `${(result.finalProb * 100).toFixed(1)}% YES` : 'N/A';
    const statusStr = result.finished ? 'MARKET CONQUERED' : 'CRASHED';
    
    const text = [
      `ODDSRIDER // ${statusStr}`,
      `Market: ${result.marketQuestion ?? 'Polymarket Event'}`,
      `Time: ${timeObj.main}${timeObj.ms} | Score: ${result.score.toLocaleString()} | Odds: ${probStr}`,
      `https://oddsrider.com`
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [result]);

  const handleTwitterShare = useCallback(() => {
    if (!result) return;
    shareToTwitter(result);
  }, [result]);

  const handleDownloadImage = useCallback(() => {
    if (!result) return;
    downloadShareCardImage(result);
  }, [result]);

  if (!isOpen || !result) return null;

  const isSuccess = result.finished;
  const probPercent = result.finalProb !== undefined ? (result.finalProb * 100).toFixed(1) : null;
  const timeObj = formatTime(result.timeMs);

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0b]/85 backdrop-blur-md select-none animate-in fade-in duration-200 font-sans p-4">
      <div className="relative w-full max-w-lg bg-[#0e1014] border border-[#1f242d] p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        
        {/* Tactical Corner Reticles */}
        <span className="absolute -top-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -top-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -bottom-1 -left-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>
        <span className="absolute -bottom-1 -right-1 text-[10px] text-[#3b414f] font-mono leading-none select-none">+</span>

        {/* ── 1. HEADER: SETTLEMENT STATUS ── */}
        <div className="flex items-start justify-between pb-4 border-b border-[#1f242d]">
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

        {/* ── 2. CONTRACT QUESTION & SETTLEMENT CHART ── */}
        <div className="py-3 border-b border-[#1f242d] flex flex-col gap-1">
          <span className="text-[8px] font-extrabold tracking-[0.22em] text-dim uppercase">
            SETTLED CONTRACT
          </span>
          <span className="text-[13px] font-medium leading-[1.38] text-ink/90">
            {result.marketQuestion ?? 'Polymarket Event'}
          </span>

          {/* Hero Neon Chart in Modal */}
          <SettlementChartCanvas pts={result.trackPts ?? null} isSuccess={isSuccess} />
          
          {probPercent !== null && (
            <div className="flex items-baseline gap-2 pt-0.5 font-mono">
              <span className="text-[8px] font-sans font-extrabold tracking-[0.2em] text-dim uppercase">
                SETTLEMENT ODDS:
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

        {/* ── 4. SOCIAL SHARE ACTIONS ROW ── */}
        <div className="pt-4 flex items-center gap-2">
          {/* Share on X */}
          <button
            onClick={handleTwitterShare}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase border border-[#232529] bg-[#12141c] text-ink hover:border-[#1d9bf0]/60 hover:text-[#1d9bf0] transition-all cursor-pointer"
            title="Post to X (Twitter)"
          >
            <span>𝕏 SHARE ON X</span>
          </button>

          {/* Save PNG Card */}
          <button
            onClick={handleDownloadImage}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 font-mono text-[10px] font-bold tracking-[0.16em] uppercase border border-[#232529] bg-[#12141c] text-ink hover:border-toxic/60 hover:text-toxic transition-all cursor-pointer"
            title="Download 1200x675 Card PNG"
          >
            <span>SAVE CARD (PNG)</span>
          </button>

          {/* Copy Receipt */}
          <button
            onClick={handleCopyLink}
            className="px-3 py-2.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase border border-[#232529] bg-[#12141c] text-dim hover:text-ink transition-all cursor-pointer"
            title="Copy text"
          >
            {copied ? 'COPIED!' : 'COPY'}
          </button>
        </div>

        {/* ── 5. PRIMARY RESTART & LOBBY BUTTONS ── */}
        <div className="pt-3 flex flex-col gap-2">
          <button
            onClick={onRetry}
            className={`w-full flex items-center justify-center gap-2 py-3 font-mono text-xs font-bold tracking-[0.2em] uppercase border transition-all duration-150 cursor-pointer ${
              isSuccess
                ? 'border-toxic bg-toxic/10 text-toxic hover:bg-toxic hover:text-bg hover:shadow-[0_0_20px_rgba(182,255,0,0.5)]'
                : 'border-crimson bg-crimson/10 text-crimson hover:bg-crimson hover:text-bg hover:shadow-[0_0_20px_rgba(255,51,85,0.5)]'
            }`}
          >
            <span>[ RIDE AGAIN ]</span>
            <span className="font-sans text-[8px] font-extrabold opacity-75 tracking-normal">
              (PRESS R)
            </span>
          </button>

          {onOpenLobby && (
            <button
              onClick={onOpenLobby}
              className="w-full py-2 font-mono text-[10px] font-bold tracking-[0.18em] uppercase border border-[#232529] bg-[#12141a] text-dim hover:text-ink hover:border-[#333a48] transition-all cursor-pointer text-center"
            >
              [ BROWSE ALL MARKETS ]
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
