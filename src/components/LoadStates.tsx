import { useSyncExternalStore } from 'react';
import { emptyTracksCopy, feedErrorCopy } from '../data/feedState';
import type { FeedError } from '../data/tracks';

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Live `navigator.onLine`, so an offline screen recovers when the network does. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

interface TrackStateBlockProps {
  tone?: 'error' | 'empty';
  eyebrow: string;
  headline: string;
  body: string;
  retryLabel?: string;
  onRetry: () => void;
}

/**
 * One block for every "nothing to ride" message: a failure is crimson, an
 * empty card is neutral. Rendered inside the title panel or centred on a page.
 */
export function TrackStateBlock({
  tone = 'error',
  eyebrow,
  headline,
  body,
  retryLabel = 'Retry →',
  onRetry,
}: TrackStateBlockProps) {
  const failed = tone === 'error';
  return (
    <div
      role={failed ? 'alert' : 'status'}
      aria-live="polite"
      className="flex flex-col gap-3 max-w-xl"
    >
      <span
        className={`font-mono text-[10px] font-bold tracking-[0.24em] uppercase ${failed ? 'text-crimson' : 'text-dim'}`}
      >
        {eyebrow}
      </span>
      <h2 className="font-poster uppercase leading-none text-3xl sm:text-4xl text-ink">{headline}</h2>
      <p className="font-sans text-sm text-dim">{body}</p>
      <button
        onClick={onRetry}
        className="pointer-events-auto w-fit mt-1 px-6 py-3 font-mono text-xs font-bold tracking-[0.16em] uppercase border border-toxic/40 text-toxic hover:bg-toxic hover:text-bg active:scale-[0.98] transition-all cursor-pointer"
      >
        {retryLabel}
      </button>
    </div>
  );
}

/** A typed feed failure. `code` + live connectivity pick the copy. */
export function FeedErrorState({ code, onRetry }: { code: FeedError; onRetry: () => void }) {
  const online = useOnline();
  const copy = feedErrorCopy(code, online);
  return (
    <TrackStateBlock
      tone={code === 'TRACKS_EMPTY' ? 'empty' : 'error'}
      eyebrow={code === 'TRACKS_EMPTY' ? 'Card' : 'Track feed'}
      headline={copy.headline}
      body={copy.body}
      retryLabel={copy.retry}
      onRetry={onRetry}
    />
  );
}

/** No error, no tracks: the manifest exists and is empty. */
export function EmptyTracksState({ onRetry }: { onRetry: () => void }) {
  const copy = emptyTracksCopy();
  return (
    <TrackStateBlock
      tone="empty"
      eyebrow="Card"
      headline={copy.headline}
      body={copy.body}
      retryLabel={copy.retry}
      onRetry={onRetry}
    />
  );
}
