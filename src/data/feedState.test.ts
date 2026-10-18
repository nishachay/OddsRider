import { describe, expect, it } from 'vitest';
import { emptyTracksCopy, feedErrorCopy } from './feedState';

describe('feed state copy', () => {
  it('keeps the empty card distinct from a failed load', () => {
    const empty = feedErrorCopy('TRACKS_EMPTY', true);
    const down = feedErrorCopy('TRACKS_UNREACHABLE', true);
    expect(empty).toEqual(emptyTracksCopy());
    expect(down.headline).not.toBe(empty.headline);
    expect(down.body).not.toBe(empty.body);
  });

  it('says offline (not unreachable) when the browser has no connection', () => {
    const offline = feedErrorCopy('TRACKS_UNREACHABLE', false);
    const online = feedErrorCopy('TRACKS_UNREACHABLE', true);
    expect(offline.headline).toMatch(/offline/i);
    expect(offline.headline).not.toBe(online.headline);
  });

  it('names an unreadable index separately from an unreachable one', () => {
    const invalid = feedErrorCopy('TRACKS_INVALID', true);
    const down = feedErrorCopy('TRACKS_UNREACHABLE', true);
    expect(invalid.headline).not.toBe(down.headline);
  });

  it('never ships blank copy or a blank retry label', () => {
    const all = [emptyTracksCopy(), ...(['TRACKS_EMPTY', 'TRACKS_INVALID', 'TRACKS_UNREACHABLE'] as const).flatMap((code) => [feedErrorCopy(code, true), feedErrorCopy(code, false)])];
    for (const copy of all) {
      expect(copy.headline.trim().length).toBeGreaterThan(0);
      expect(copy.body.trim().length).toBeGreaterThan(0);
      expect(copy.retry.trim().length).toBeGreaterThan(0);
    }
  });
});
