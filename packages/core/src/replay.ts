/**
 * Deterministic run recordings — pure codec, no framework, no network.
 *
 * A recording captures everything needed to reproduce a ride exactly:
 * the track identity (id + hash prefix), the ride setup (inverted side,
 * history window), and the input state per fixed physics step, run-length
 * encoded as (step, bitmask) changes. Snapshots (ghost poses) travel with
 * local recordings but never go in share links — the /r/ page regenerates
 * them by replaying the inputs through the real physics.
 *
 * Binary layout (all integers little-endian):
 *   u8 version (=1)
 *   u8 flags: bit0 inverted, bits1-2 interval (0=ALL,1=24H,2=7D)
 *   u8 trackIdLen, trackIdLen bytes ASCII
 *   u8[8] trackHash prefix (first 8 bytes of sha256)
 *   varint eventCount, then per event: varint stepDelta, u8 mask
 *   varint endStep, u8 outcome (0=crash, 1=finish), f64 endX
 */
export const REPLAY_VERSION = 1;

/** Drive bitmask. Bit 6 (burning) records whether nitro was actually burning
 *  that step — input grouping differs per frame, so replaying it verbatim is
 *  the only exact choice. */
export const DRIVE_BITS = {
  gas: 1,
  brake: 2,
  leanBack: 4,
  leanFwd: 8,
  nitro: 16,
  jump: 32,
  burning: 64,
} as const;

export interface DriveState {
  gas: boolean;
  brake: boolean;
  leanBack: boolean;
  leanFwd: boolean;
  nitro: boolean;
  jump: boolean;
  burning: boolean;
}

export function maskFromDrive(drive: DriveState): number {
  let mask = 0;
  if (drive.gas) mask |= DRIVE_BITS.gas;
  if (drive.brake) mask |= DRIVE_BITS.brake;
  if (drive.leanBack) mask |= DRIVE_BITS.leanBack;
  if (drive.leanFwd) mask |= DRIVE_BITS.leanFwd;
  if (drive.nitro) mask |= DRIVE_BITS.nitro;
  if (drive.jump) mask |= DRIVE_BITS.jump;
  if (drive.burning) mask |= DRIVE_BITS.burning;
  return mask;
}

export function driveFromMask(mask: number): DriveState {
  return {
    gas: (mask & DRIVE_BITS.gas) !== 0,
    brake: (mask & DRIVE_BITS.brake) !== 0,
    leanBack: (mask & DRIVE_BITS.leanBack) !== 0,
    leanFwd: (mask & DRIVE_BITS.leanFwd) !== 0,
    nitro: (mask & DRIVE_BITS.nitro) !== 0,
    jump: (mask & DRIVE_BITS.jump) !== 0,
    burning: (mask & DRIVE_BITS.burning) !== 0,
  };
}

/** [stepIndex, mask] sorted by step, first entry always step 0. */
export type StepEvents = Array<[number, number]>;

export interface RunMeta {
  trackId: string;
  /** First 16 hex chars of the track sha256 (8 bytes on the wire). */
  trackHashPrefix: string;
  inverted: boolean;
  interval: 'ALL' | '24H' | '7D';
  endStep: number;
  outcome: 'crash' | 'finish';
  /** Bike x at the recorded end (crash point or finish). */
  endX: number;
}

export interface SharePayload extends RunMeta {
  events: StepEvents;
}

/** Ghost pose keyframe. t = score timeMs at capture. */
export interface GhostSnapshot {
  t: number;
  x: number;
  y: number;
  a: number;
}

const INTERVAL_BITS: Record<SharePayload['interval'], number> = { ALL: 0, '24H': 1, '7D': 2 };
const BITS_INTERVAL = ['ALL', '24H', '7D'] as const;

function writeVarint(out: number[], value: number): void {
  let v = Math.floor(value);
  if (v < 0) throw new Error(`varint cannot be negative: ${value}`);
  do {
    let b = v & 0x7f;
    v >>>= 0;
    v = Math.floor(v / 128);
    if (v > 0) b |= 0x80;
    out.push(b);
  } while (v > 0);
}

function readVarint(bytes: Uint8Array, pos: { i: number }): number {
  let result = 0;
  let shift = 0;
  for (let n = 0; n < 6; n++) {
    if (pos.i >= bytes.length) throw new Error('truncated varint');
    const b = bytes[pos.i++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
    if ((b & 0x80) === 0) return result;
  }
  throw new Error('varint too long');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    if (i + 1 < bytes.length) out += B64[((b & 15) << 2) | (c >> 6)];
    if (i + 2 < bytes.length) out += B64[c & 63];
  }
  return out;
}

export function base64UrlDecode(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  if (!/^[A-Za-z0-9\-_]*$/.test(clean)) throw new Error('not url-safe base64');
  const vals = [...clean].map((ch) => {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error(`bad base64 char: ${ch}`);
    return v;
  });
  const out: number[] = [];
  for (let i = 0; i < vals.length; i += 4) {
    const a = vals[i];
    const b = vals[i + 1];
    out.push((a << 2) | (b >> 4));
    if (i + 2 < vals.length) out.push(((b & 15) << 4) | (vals[i + 2] >> 2));
    if (i + 3 < vals.length) out.push(((vals[i + 2] & 3) << 6) | vals[i + 3]);
  }
  return new Uint8Array(out);
}

export const MAX_TRACK_ID_LEN = 80;
export const MAX_EVENTS = 200_000;
export const MAX_END_STEP = 1_000_000;

export function encodeShareLink(payload: SharePayload): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(payload.trackId)) throw new Error('bad track id');
  if (payload.trackId.length > MAX_TRACK_ID_LEN) throw new Error('track id too long');
  if (!/^[0-9a-f]{16}$/.test(payload.trackHashPrefix)) throw new Error('bad hash prefix');
  const out: number[] = [REPLAY_VERSION];
  out.push(
    (payload.inverted ? 1 : 0) | (INTERVAL_BITS[payload.interval] << 1),
  );
  const idBytes = [...payload.trackId].map((ch) => ch.charCodeAt(0));
  out.push(idBytes.length, ...idBytes);
  for (let i = 0; i < 16; i += 2) {
    out.push(parseInt(payload.trackHashPrefix.slice(i, i + 2), 16));
  }
  const events = payload.events;
  if (events.length === 0) throw new Error('no input events');
  if (events.length > MAX_EVENTS) throw new Error('too many input events');
  writeVarint(out, events.length);
  let prev = 0;
  for (const [step, mask] of events) {
    if (!Number.isInteger(step) || step < prev) throw new Error('events must be ordered');
    if (mask < 0 || mask > 255) throw new Error('bad drive mask');
    writeVarint(out, step - prev);
    out.push(mask);
    prev = step;
  }
  if (!Number.isInteger(payload.endStep) || payload.endStep <= 0 || payload.endStep > MAX_END_STEP) {
    throw new Error('bad end step');
  }
  writeVarint(out, payload.endStep);
  out.push(payload.outcome === 'finish' ? 1 : 0);
  const f64 = new Uint8Array(8);
  new DataView(f64.buffer).setFloat64(0, payload.endX, true);
  out.push(...f64);
  return base64UrlEncode(new Uint8Array(out));
}

export interface DecodedShareLink extends SharePayload {
  /** Full encoded length, for size reporting. */
  encodedLength: number;
}

export function decodeShareLink(link: string): DecodedShareLink {
  if (link.length === 0 || link.length > 8192) throw new Error('bad link length');
  const bytes = base64UrlDecode(link);
  const pos = { i: 0 };
  const need = (n: number): Uint8Array => {
    if (pos.i + n > bytes.length) throw new Error('truncated payload');
    return bytes.slice(pos.i, (pos.i += n));
  };
  if (need(1)[0] !== REPLAY_VERSION) throw new Error('unsupported replay version');
  const flags = need(1)[0];
  const inverted = (flags & 1) !== 0;
  const interval = BITS_INTERVAL[(flags >> 1) & 3];
  if (!interval) throw new Error('bad interval bits');
  const idLen = need(1)[0];
  if (idLen === 0 || idLen > MAX_TRACK_ID_LEN) throw new Error('bad track id');
  const idBytes = need(idLen);
  const trackId = String.fromCharCode(...idBytes);
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trackId)) throw new Error('bad track id');
  const hashBytes = need(8);
  const trackHashPrefix = [...hashBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const eventCount = readVarint(bytes, pos);
  if (eventCount === 0 || eventCount > MAX_EVENTS) throw new Error('bad event count');
  const events: StepEvents = [];
  let step = 0;
  for (let n = 0; n < eventCount; n++) {
    step += readVarint(bytes, pos);
    const mask = need(1)[0];
    events.push([step, mask]);
  }
  if (events[0][0] !== 0) throw new Error('first event must be step 0');
  const endStep = readVarint(bytes, pos);
  if (endStep <= 0 || endStep > MAX_END_STEP) throw new Error('bad end step');
  const outcomeByte = need(1)[0];
  if (outcomeByte !== 0 && outcomeByte !== 1) throw new Error('bad outcome');
  const endX = new DataView(need(8).buffer).getFloat64(0, true);
  if (!Number.isFinite(endX)) throw new Error('bad end position');
  if (pos.i !== bytes.length) throw new Error('trailing bytes');
  return {
    trackId,
    trackHashPrefix,
    inverted,
    interval,
    events,
    endStep,
    outcome: outcomeByte === 1 ? 'finish' : 'crash',
    endX,
    encodedLength: link.length,
  };
}

/** Drive state at a step: last event at or before it (events cover step 0). */
export function driveAtStep(events: StepEvents, step: number): number {
  let mask = events[0][1];
  for (const [s, m] of events) {
    if (s > step) break;
    mask = m;
  }
  return mask;
}

/** Interpolated ghost pose at score-time t (holds ends outside the range). */
export function poseAt(
  snapshots: GhostSnapshot[],
  t: number,
): { x: number; y: number; a: number } | null {
  if (snapshots.length === 0) return null;
  if (t <= snapshots[0].t) {
    const s = snapshots[0];
    return { x: s.x, y: s.y, a: s.a };
  }
  const last = snapshots[snapshots.length - 1];
  if (t >= last.t) return { x: last.x, y: last.y, a: last.a };
  let lo = 0;
  let hi = snapshots.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (snapshots[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = snapshots[lo];
  const b = snapshots[hi];
  const span = b.t - a.t;
  const k = span > 0 ? (t - a.t) / span : 0;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, a: a.a + (b.a - a.a) * k };
}
