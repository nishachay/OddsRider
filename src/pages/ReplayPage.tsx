/**
 * `/r/:payload` — open a shared run and replay it, then ride the same track.
 *
 * The URL carries the whole replay (the base64url payload), so there is no
 * server lookup and no second source of truth. The market question is the one
 * thing the payload does not carry, so it is read from the frozen track file
 * and the page is honest when that file has been pruned.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopStrip from '../components/TopStrip';
import ReplayPlayer from '../components/ReplayPlayer';
import { fetchTrack } from '../data/tracks';
import { crashPercent, decodeRunShare, formatRunTime } from '../utils/shareRun';
import type { SharePayload } from '@oddsrider/core';

function BrokenLink() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-bg text-ink">
      <TopStrip />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-crimson uppercase">
          Replay link
        </span>
        <h1 className="font-poster text-4xl uppercase leading-[0.95] text-ink sm:text-5xl">
          This replay link is broken
        </h1>
        <p className="max-w-md font-mono text-[11px] leading-relaxed text-dim">
          The payload is missing, corrupt or tampered, so there is no run to replay.
        </p>
        <Link
          to="/"
          className="min-h-[48px] border border-toxic/40 bg-toxic/10 px-6 py-3 font-mono text-xs font-bold tracking-[0.16em] text-toxic uppercase transition-all hover:bg-toxic hover:text-bg active:scale-[0.98]"
        >
          Back to the title
        </Link>
      </main>
    </div>
  );
}

export default function ReplayPage() {
  const { payload } = useParams<{ payload: string }>();
  const decoded = useMemo(() => {
    try {
      return decodeRunShare(payload ?? '');
    } catch {
      return null;
    }
  }, [payload]);

  const [question, setQuestion] = useState<string | null>(null);
  const [trackMissing, setTrackMissing] = useState(false);

  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;
    setQuestion(null);
    setTrackMissing(false);
    fetchTrack(decoded.meta.trackId).then(
      (track) => {
        if (!cancelled) setQuestion(track.question);
      },
      () => {
        if (!cancelled) setTrackMissing(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [decoded]);

  if (!decoded) return <BrokenLink />;

  const meta = decoded.meta;
  const run: SharePayload = {
    ...meta,
    truncated: decoded.truncated,
    frames: decoded.frames,
    tricks: decoded.tricks,
  };
  const crashed = meta.outcome !== 'finish';
  const rideTo = `/ride/${meta.trackId}?tf=${meta.interval}${meta.inverted ? '&side=no' : ''}`;

  return (
    <div className="flex min-h-screen w-full flex-col bg-bg text-ink">
      <TopStrip />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-10 pb-16">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-bold tracking-[0.24em] text-dim uppercase">
            Shared run · {meta.inverted ? 'NO' : 'YES'} side · {meta.interval}
            {decoded.truncated ? ' · tail only' : ''}
          </span>
          <h1
            className={`font-poster text-4xl uppercase leading-[0.95] sm:text-6xl ${
              crashed ? 'text-crimson' : 'text-toxic'
            }`}
          >
            {crashed ? `Crashed at ${crashPercent(meta.progress)}%` : `Finished · ${formatRunTime(meta.finalTimeMs)}`}
          </h1>
          {question ? (
            <p className="max-w-2xl font-display text-[15px] font-bold leading-snug text-ink">{question}</p>
          ) : trackMissing ? (
            <p className="max-w-2xl font-mono text-[11px] text-dim uppercase">
              This frozen track is no longer published, so it cannot be ridden again.
            </p>
          ) : (
            <div className="shimmer h-[3px] w-56" />
          )}
        </div>

        <div className="grid grid-cols-3 border-y border-line py-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Score</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {meta.finalScore.toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-l border-line pl-4">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">Time</span>
            <span className="font-mono text-2xl font-bold tabular-nums text-ink">
              {formatRunTime(meta.finalTimeMs)}
            </span>
          </div>
          <div className="flex flex-col gap-1 border-l border-line pl-4">
            <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-dim uppercase">
              {crashed ? 'Crash point' : 'Outcome'}
            </span>
            <span className={`font-mono text-2xl font-bold tabular-nums ${crashed ? 'text-crimson' : 'text-toxic'}`}>
              {crashed ? `${crashPercent(meta.progress)}%` : 'FINISH'}
            </span>
          </div>
        </div>

        <ReplayPlayer payload={run} />

        {decoded.truncated && (
          <p className="font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
            Long run: this link carries only the closing seconds.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {trackMissing ? (
            <Link
              to="/tracks"
              className="min-h-[52px] border border-line px-6 py-3.5 text-center font-mono text-xs font-bold tracking-[0.16em] text-ink uppercase transition-all hover:border-toxic/60 hover:text-toxic active:scale-[0.99]"
            >
              Browse tracks
            </Link>
          ) : (
            <Link
              to={rideTo}
              className="min-h-[52px] flex-1 border border-toxic bg-toxic px-6 py-3.5 text-center font-mono text-xs font-bold tracking-[0.16em] text-bg uppercase transition-all hover:bg-toxic/90 active:scale-[0.99]"
            >
              Ride this track
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
