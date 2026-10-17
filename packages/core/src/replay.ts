/**
 * Snapshot replay codec — pure, no framework, no network.
 *
 * Runs are recorded as body poses sampled at 20 Hz plus trick events, and
 * played back by interpolation. No physics runs during replay, so playback
 * is exact by construction and seeking is O(1).
 *
 * Two densities:
 *   - local (ghosts, crash loops): full precision, 20 Hz, kept in memory
 *     or localStorage.
 *   - share (URL): downsampled to 10 Hz, quantized (0.5 px, ~0.5 deg),
 *     delta-encoded, base64url. Capped so links stay short: if the encoded
 *     link would pass ~8 KB, only the last 30 seconds travel, flagged.
 *
 * Wire layout (all integers little-endian, zigzag for signed):
 *   u8 version (=2)
 *   u8 flags: bit0 inverted, bits1-2 interval (0=ALL,1=24H,2=7D),
 *             bit3 outcome (0=crash,1=finish), bit4 truncated
 *   u8 trackIdLen, trackIdLen bytes ASCII
 *   u8[8] trackHash prefix (first 8 bytes of sha256)
 *   varint beginStep, varint endStep, u16 progressHundredths,
 *   varint finalScore, varint finalTimeMs,
 *   varint frameCount, frames...,
 *   varint trickCount, tricks... ([stepDelta, code, points])
 *
 * Frame: varint stepDelta, 9 zigzag deltas (cx,cy,ca,rx,ry,ra,fx,fy,fa),
 * u8 bodyFlags (bit0 = ejected), optional 3 zigzag deltas (gx,gy,ga).
 */
export const REPLAY_VERSION = 2;

/** Trick codes for the replay event list (fixed set, no free text). */
export const TRICK_CODES = {
  BACKFLIP: 1,
  FRONTFLIP: 2,
  BIG_AIR: 3,
  WHEELIE: 4,
  STOPPIE: 5,
  SPEED_DEMON: 6,
  NITRO_BURN: 7,
} as const;

export type TrickCode = (typeof TRICK_CODES)[keyof typeof TRICK_CODES];

/** Full-precision body pose sample (local recordings, ghosts). */
export interface BodyFrame {
  step: number;
  /** chassis x, y, angle */
  c: [number, number, number];
  /** rear hub x, y, angle */
  r: [number, number, number];
  /** front hub x, y, angle */
  f: [number, number, number];
  ejected: boolean;
  /** ragdoll x, y, angle (only when ejected) */
  g?: [number, number, number];
}

export interface TrickEvent {
  step: number;
  code: number;
  points: number;
}

export interface RunMeta {
  trackId: string;
  /** First 16 hex chars of the track sha256 (8 bytes on the wire). */
  trackHashPrefix: string;
  inverted: boolean;
  interval: 'ALL' | '24H' | '7D';
  /** First step with any input; -1 when the run never started. */
  beginStep: number;
  endStep: number;
  outcome: 'crash' | 'finish';
  /** 0..1 along the course at the end moment. */
  progress: number;
  finalScore: number;
  finalTimeMs: number;
}

export interface SharePayload extends RunMeta {
  truncated: boolean;
  frames: BodyFrame[];
  tricks: TrickEvent[];
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

/** Links stay short enough to paste anywhere; longer runs travel truncated. */
export const MAX_LINK_LENGTH = 8192;
/** Share density and cap (10 Hz, last 30 s). */
export const SHARE_HZ = 10;
export const SHARE_KEEP_SECONDS = 30;

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

const zigzagEncode = (n: number): number => (n < 0 ? (-n - 1) * 2 + 1 : n * 2);
const zigzagDecode = (n: number): number => (n % 2 === 1 ? -((n - 1) / 2) - 1 : n / 2);

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
export const MAX_FRAMES = 200_000;
export const MAX_END_STEP = 1_000_000;

/** CRC16-CCITT: every flipped character changes the payload, so tampered
 *  links fail loudly instead of decoding to a wrong-but-valid run. */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function encodeFrames(frames: BodyFrame[], quantize: number, angleQuantize: number): number[] {
  const out: number[] = [];
  let prevStep = 0;
  let first = true;
  const prev = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let prevRagdoll = [0, 0, 0];
  for (const frame of frames) {
    writeVarint(out, frame.step - prevStep);
    prevStep = frame.step;
    const q = [
      Math.round(frame.c[0] * quantize),
      Math.round(frame.c[1] * quantize),
      Math.round(frame.c[2] * angleQuantize),
      Math.round(frame.r[0] * quantize),
      Math.round(frame.r[1] * quantize),
      Math.round(frame.r[2] * angleQuantize),
      Math.round(frame.f[0] * quantize),
      Math.round(frame.f[1] * quantize),
      Math.round(frame.f[2] * angleQuantize),
    ];
    for (let i = 0; i < 9; i++) {
      writeVarint(out, zigzagEncode(first ? q[i] : q[i] - prev[i]));
      prev[i] = q[i];
    }
    first = false;
    out.push(frame.ejected ? 1 : 0);
    if (frame.ejected && frame.g) {
      const g = [
        Math.round(frame.g[0] * quantize),
        Math.round(frame.g[1] * quantize),
        Math.round(frame.g[2] * angleQuantize),
      ];
      for (let i = 0; i < 3; i++) {
        writeVarint(out, zigzagEncode(g[i] - prevRagdoll[i]));
        prevRagdoll[i] = g[i];
      }
    } else {
      prevRagdoll = frame.ejected ? prevRagdoll : [0, 0, 0];
    }
  }
  return out;
}

function decodeFrames(bytes: Uint8Array, pos: { i: number }, count: number): BodyFrame[] {
  // Share payloads are quantized (0.5 px, ~0.5 deg); see POSITION_QUANT etc.
  const quantize = 2;
  const angleQuantize = (180 / Math.PI) * 2;
  const frames: BodyFrame[] = [];
  let step = 0;
  const prev = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let prevRagdoll = [0, 0, 0];
  for (let n = 0; n < count; n++) {
    step += readVarint(bytes, pos);
    const q: number[] = [];
    for (let i = 0; i < 9; i++) {
      const absolute = n === 0;
      const value = zigzagDecode(readVarint(bytes, pos));
      prev[i] = absolute ? value : prev[i] + value;
      q.push(prev[i]);
    }
    const ejected = readVar(bytes, pos) !== 0;
    let g: [number, number, number] | undefined;
    if (ejected) {
      const gv: number[] = [];
      for (let i = 0; i < 3; i++) {
        prevRagdoll[i] += zigzagDecode(readVarint(bytes, pos));
        gv.push(prevRagdoll[i]);
      }
      g = [gv[0] / quantize, gv[1] / quantize, gv[2] / angleQuantize];
    }
    frames.push({
      step,
      c: [q[0] / quantize, q[1] / quantize, q[2] / angleQuantize],
      r: [q[3] / quantize, q[4] / quantize, q[5] / angleQuantize],
      f: [q[6] / quantize, q[7] / quantize, q[8] / angleQuantize],
      ejected,
      g,
    });
  }
  return frames;
}

function readVar(bytes: Uint8Array, pos: { i: number }): number {
  if (pos.i >= bytes.length) throw new Error('truncated payload');
  return bytes[pos.i++];
}

/** Quantization steps: 0.5 px positions, ~0.5 deg angles. */
export const POSITION_QUANT = 2;
export const ANGLE_QUANT = (180 / Math.PI) * 2;

function buildPayload(meta: RunMeta, frames: BodyFrame[], tricks: TrickEvent[], truncated: boolean): number[] {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(meta.trackId)) throw new Error('bad track id');
  if (meta.trackId.length > MAX_TRACK_ID_LEN) throw new Error('track id too long');
  if (!/^[0-9a-f]{16}$/.test(meta.trackHashPrefix)) throw new Error('bad hash prefix');
  const out: number[] = [REPLAY_VERSION];
  out.push(
    (meta.inverted ? 1 : 0) |
      (INTERVAL_BITS[meta.interval] << 1) |
      (meta.outcome === 'finish' ? 8 : 0) |
      (truncated ? 16 : 0),
  );
  const idBytes = [...meta.trackId].map((ch) => ch.charCodeAt(0));
  out.push(idBytes.length, ...idBytes);
  for (let i = 0; i < 16; i += 2) {
    out.push(parseInt(meta.trackHashPrefix.slice(i, i + 2), 16));
  }
  if (!Number.isInteger(meta.beginStep) || meta.beginStep < -1) throw new Error('bad begin step');
  writeVarint(out, meta.beginStep + 1);
  if (!Number.isInteger(meta.endStep) || meta.endStep <= 0 || meta.endStep > MAX_END_STEP) {
    throw new Error('bad end step');
  }
  writeVarint(out, meta.endStep);
  const progress = Math.min(1, Math.max(0, meta.progress));
  out.push((progress * 65535) & 0xff, ((progress * 65535) >> 8) & 0xff);
  writeVarint(out, Math.max(0, Math.floor(meta.finalScore)));
  writeVarint(out, Math.max(0, Math.floor(meta.finalTimeMs)));
  if (frames.length === 0 || frames.length > MAX_FRAMES) throw new Error('bad frame count');
  writeVarint(out, frames.length);
  out.push(...encodeFrames(frames, POSITION_QUANT, ANGLE_QUANT));
  if (tricks.length > 10_000) throw new Error('too many tricks');
  writeVarint(out, tricks.length);
  let prevTrickStep = 0;
  for (const trick of tricks) {
    writeVarint(out, trick.step - prevTrickStep);
    prevTrickStep = trick.step;
    if (!Number.isInteger(trick.code) || trick.code < 1 || trick.code > 127) throw new Error('bad trick code');
    out.push(trick.code);
    writeVarint(out, Math.max(0, Math.floor(trick.points)));
  }
  return out;
}

/**
 * Encode a share link. Long runs travel downsampled to 10 Hz, and past ~8 KB
 * only the last 30 seconds travel (flagged, so the UI says so).
 */
export function encodeShareLink(meta: RunMeta, frames: BodyFrame[], tricks: TrickEvent[]): string {
  if (frames.length === 0) throw new Error('no frames to share');
  const downsampled = frames.filter((_, i) => i % 2 === 0);
  const use = downsampled.length > 0 ? downsampled : frames;
  const pack = (list: BodyFrame[], flag: boolean): string => {
    const body = buildPayload(meta, list, tricksIn(list, tricks), flag);
    const check = crc16(new Uint8Array(body));
    body.push((check >> 8) & 0xff, check & 0xff);
    return base64UrlEncode(new Uint8Array(body));
  };
  let link = pack(use, false);
  if (link.length > MAX_LINK_LENGTH) {
    const keep = use.slice(-SHARE_HZ * SHARE_KEEP_SECONDS);
    if (keep.length === 0) throw new Error('run too short to share');
    link = pack(keep, true);
  }
  return link;
}

function tricksIn(frames: BodyFrame[], tricks: TrickEvent[]): TrickEvent[] {
  if (frames.length === 0) return [];
  const from = frames[0].step;
  return tricks.filter((t) => t.step >= from);
}

export interface DecodedShareLink {
  meta: RunMeta;
  truncated: boolean;
  frames: BodyFrame[];
  tricks: TrickEvent[];
  encodedLength: number;
}

export function decodeShareLink(link: string): DecodedShareLink {
  if (link.length === 0 || link.length > MAX_LINK_LENGTH * 2) throw new Error('bad link length');
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
  const outcome = (flags & 8) !== 0 ? 'finish' : 'crash';
  const truncated = (flags & 16) !== 0;
  const idLen = need(1)[0];
  if (idLen === 0 || idLen > MAX_TRACK_ID_LEN) throw new Error('bad track id');
  const trackId = String.fromCharCode(...need(idLen));
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trackId)) throw new Error('bad track id');
  const trackHashPrefix = [...need(8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const beginStep = readVarint(bytes, pos) - 1;
  if (beginStep < -1) throw new Error('bad begin step');
  const endStep = readVarint(bytes, pos);
  if (endStep <= 0 || endStep > MAX_END_STEP) throw new Error('bad end step');
  const progressRaw = need(1)[0] | (need(1)[0] << 8);
  const finalScore = readVarint(bytes, pos);
  const finalTimeMs = readVarint(bytes, pos);
  const frameCount = readVarint(bytes, pos);
  if (frameCount === 0 || frameCount > MAX_FRAMES) throw new Error('bad frame count');
  const frames = decodeFrames(bytes, pos, frameCount);
  const trickCount = readVarint(bytes, pos);
  if (trickCount > 10_000) throw new Error('bad trick count');
  const tricks: TrickEvent[] = [];
  let trickStep = 0;
  for (let n = 0; n < trickCount; n++) {
    trickStep += readVarint(bytes, pos);
    const code = readVar(bytes, pos);
    if (code < 1 || code > 127) throw new Error('bad trick code');
    tricks.push({ step: trickStep, code, points: readVarint(bytes, pos) });
  }
  if (pos.i !== bytes.length - 2) throw new Error('trailing bytes');
  const checkHi = bytes[pos.i++];
  const checkLo = bytes[pos.i++];
  const actual = crc16(bytes.slice(0, bytes.length - 2));
  if (((actual >> 8) & 0xff) !== checkHi || (actual & 0xff) !== checkLo) {
    throw new Error('checksum mismatch: link is corrupt or tampered');
  }
  return {
    meta: {
      trackId,
      trackHashPrefix,
      inverted,
      interval,
      beginStep,
      endStep,
      outcome,
      progress: progressRaw / 65535,
      finalScore,
      finalTimeMs,
    },
    truncated,
    frames,
    tricks,
    encodedLength: link.length,
  };
}

/** Interpolated full-body pose at a step (holds ends outside the range). */
export function poseAtStep(
  frames: BodyFrame[],
  step: number,
): { c: [number, number, number]; r: [number, number, number]; f: [number, number, number]; ejected: boolean; g: [number, number, number] | null } | null {
  if (frames.length === 0) return null;
  if (step <= frames[0].step) {
    const f = frames[0];
    return { c: [...f.c] as [number, number, number], r: [...f.r] as [number, number, number], f: [...f.f] as [number, number, number], ejected: f.ejected, g: f.g ? ([...f.g] as [number, number, number]) : null };
  }
  const last = frames[frames.length - 1];
  if (step >= last.step) {
    return { c: [...last.c] as [number, number, number], r: [...last.r] as [number, number, number], f: [...last.f] as [number, number, number], ejected: last.ejected, g: last.g ? ([...last.g] as [number, number, number]) : null };
  }
  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].step <= step) lo = mid;
    else hi = mid;
  }
  const a = frames[lo];
  const b = frames[hi];
  const span = b.step - a.step;
  const k = span > 0 ? (step - a.step) / span : 0;
  const lerp3 = (u: [number, number, number], v: [number, number, number]): [number, number, number] => [
    u[0] + (v[0] - u[0]) * k,
    u[1] + (v[1] - u[1]) * k,
    u[2] + (v[2] - u[2]) * k,
  ];
  return {
    c: lerp3(a.c, b.c),
    r: lerp3(a.r, b.r),
    f: lerp3(a.f, b.f),
    ejected: k < 0.5 ? a.ejected : b.ejected,
    g: k < 0.5 ? a.g ?? null : b.g ?? null,
  };
}

/** score-timeMs at a step, derived exactly like the live score clock. */
export function timeMsAtStep(step: number, beginStep: number): number {
  if (beginStep < 0 || step < beginStep) return 0;
  return Math.round((step - beginStep + 1) * (1000 / 60));
}

/** Rear-hub ghost keyframes converted from full-body frames. */
export function framesToGhost(frames: BodyFrame[], beginStep: number): GhostSnapshot[] {
  return frames.map((f) => ({
    t: timeMsAtStep(f.step, beginStep),
    x: f.r[0],
    y: f.r[1],
    a: f.r[2],
  }));
}
