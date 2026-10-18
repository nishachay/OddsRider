/**
 * Copy for the two states a frozen track feed can land in: a card with nothing
 * on it, and a load that failed. They are deliberately different — an empty
 * manifest is not an outage, and a failed index must never read as "no tracks
 * yet". Pure strings, so every screen says the same thing and the copy is
 * pinned by tests instead of drifting per page.
 */
import type { FeedError } from './tracks';

export interface FeedCopy {
  /** Poster headline. */
  headline: string;
  /** One sentence of plain explanation. */
  body: string;
  /** Retry affordance label. */
  retry: string;
}

const RETRY = 'Retry →';

/** A published-but-empty manifest: nothing to ride, nothing invented. */
export function emptyTracksCopy(): FeedCopy {
  return {
    headline: 'No tracks published yet',
    body: 'The card is empty right now — the next ingest fills it. No terrain is invented to fill the gap.',
    retry: 'Check again →',
  };
}

/**
 * The failure copy for a typed feed error. `online` comes from
 * `navigator.onLine`: a dropped connection is a different problem from a bad
 * payload, and the viewer should be told which one they have.
 */
export function feedErrorCopy(code: FeedError, online: boolean): FeedCopy {
  if (code === 'TRACKS_EMPTY') return emptyTracksCopy();
  if (!online) {
    return {
      headline: "You're offline",
      body: 'OddsRider reads frozen tracks from this same site. Reconnect, then retry to load the card.',
      retry: RETRY,
    };
  }
  if (code === 'TRACKS_INVALID') {
    return {
      headline: 'Track feed unreadable',
      body: 'The published track index failed validation, so no terrain can be built from it. Retry, or check back after the next ingest.',
      retry: RETRY,
    };
  }
  return {
    headline: 'Track feed unreachable',
    body: 'The frozen track index did not load. Check your connection and retry.',
    retry: RETRY,
  };
}
