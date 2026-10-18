/**
 * Minimal preload progress bar. `progress` is a real 0..1 fraction of assets
 * settled; the bar is the only thing on screen while the stage warms up.
 */
export default function PreloadBar({ progress, label }: { progress: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg"
      role="status"
      aria-live="polite"
    >
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-[3px] w-56 overflow-hidden bg-line"
      >
        <div
          className="h-full bg-toxic transition-[width] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tracking-[0.3em] text-dim uppercase">
        {label} · {pct}%
      </span>
    </div>
  );
}
