const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

// Tiny terrain silhouette drawn from a frozen preview series. Real data,
// downsampled at ingest — never invented.
export default function MiniTrack({ pts, deltaUp }: { pts: number[] | null; deltaUp: boolean }) {
  const W = 220;
  const H = 44;
  if (!pts || pts.length < 2) {
    return (
      <div className="w-full h-11 flex items-center font-mono text-[9px] font-bold tracking-[0.2em] text-dim">
        NO FORM
      </div>
    );
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = Math.max(0.01, max - min);
  const color = deltaUp ? TOXIC : CRIMSON;
  const line = pts
    .map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - 4 - ((p - min) / range) * (H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-11 overflow-hidden" aria-hidden="true">
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={deltaUp ? 'rgba(182,255,0,0.07)' : 'rgba(255,51,85,0.07)'} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
