/**
 * Snapshot replay codec — pure, no framework, no network.
 *
 * A run is recorded as body poses sampled at 20 Hz plus trick events, and
 * played back by interpolating between snapshots. No physics runs during
 * playback, so a replay is exact by construction and seeking is O(1).
 *
 * Wire format (body before deflate, all integers little-endian, zigzag signed):
 *   u8  version (= 3)
 *   u8  flags: bit0 inverted, bits1-2 interval (0=ALL,1=24H,2=7D),
 *              bit3 outcome (0=crash,1=finish), bit4 truncated
 *   u8  trackIdLen, trackIdLen ASCII bytes
 *   u8[8] track hash prefix
 *   varint beginStep+1, varint endStep, u16 progressHundredths,
 *   varint finalScore, varint finalTimeMs,
 *   varint frameCount, frames...,
 *   varint trickCount, tricks... ([stepDelta, code, points])
 *
 * Frame: varint stepDelta, 9 zigzag varint deltas (cx,cy,ca,rx,ry,ra,fx,fy,fa),
 * u8 bodyFlags (bit0 = ejected), optional 3 zigzag varint ragdoll deltas.
 *
 * Positions are quantized to 0.5 px, angles to 1/256 rad. The body is deflated
 * (fflate) and framed as u16-LE deflated length + deflated bytes + u16
 * CRC16-CCITT over those bytes, then base64url-encoded for URLs. The explicit
 * length matters: inflate silently ignores trailing junk, and a trailing zero
 * byte is invisible to the checksum (CRC residue is 0), so without it a link
 * could gain junk and still verify. 20 Hz recordings are downsampled to
 * `SHARE_HZ` before encoding so a 60-second run stays well under 8 KB; local
 * ghosts keep the full 20 Hz. Longer runs keep the tail, shaved in halves until
 * the link fits `MAX_LINK_LENGTH`.
 */
import { deflateSync, inflateSync } from 'fflate';

export const REPLAY_VERSION = 3;

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
  /** ragdoll (rider after a crash) x, y, angle, only when ejected */
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

const INTERVAL_BITS: Record<RunMeta['interval'], number> = { ALL: 0, '24H': 1, '7D': 2 };
const BITS_INTERVAL = ['ALL', '24H', '7D'] as const;

/** Links stay short enough to paste anywhere; longer runs travel truncated. */
export const MAX_LINK_LENGTH = 8192;
/** Seconds of the run tail kept when a link would otherwise be too long. */
export const SHARE_KEEP_SECONDS = 30;
/** Snapshots are recorded at 60/3 = 20 Hz. */
export const SNAPSHOT_HZ = 20;
/** Share links carry every Nth snapshot (1 = full 20 Hz, 2 = 10 Hz). */
export const SHARE_DOWNSAMPLE = 2;

/** Quantization steps: 0.5 px positions, 1/256 rad angles. */
export const POSITION_QUANT = 2;
export const ANGLE_QUANT = 256;

export const MAX_TRACK_ID_LEN = 80;
export const MAX_FRAMES = 200_000;
export const MAX_END_STEP = 1_000_000;

function writeVarint(out: number[], value: number): void {
  let v = Math.floor(value);
  if (v < 0) throw new Error(`varint cannot be negative: ${value}`);
  do {
    let b = v & 0x7f;
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

function readByte(bytes: Uint8Array, pos: { i: number }): number {
  if (pos.i >= bytes.length) throw new Error('truncated payload');
  return bytes[pos.i++];
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

/** CRC16-CCITT: a flipped character changes the checksum, so tampered links
 *  fail loudly instead of decoding to a wrong-but-valid run. */
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

function encodeFrames(frames: BodyFrame[]): number[] {
  const out: number[] = [];
  let prevStep = 0;
  let first = true;
  const prev = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let prevRagdoll = [0, 0, 0];
  for (const frame of frames) {
    if (!Number.isInteger(frame.step) || frame.step < prevStep) throw new Error('frame steps must be non-decreasing');
    writeVarint(out, frame.step - prevStep);
    prevStep = frame.step;
    const q = [
      Math.round(frame.c[0] * POSITION_QUANT),
      Math.round(frame.c[1] * POSITION_QUANT),
      Math.round(frame.c[2] * ANGLE_QUANT),
      Math.round(frame.r[0] * POSITION_QUANT),
      Math.round(frame.r[1] * POSITION_QUANT),
      Math.round(frame.r[2] * ANGLE_QUANT),
      Math.round(frame.f[0] * POSITION_QUANT),
      Math.round(frame.f[1] * POSITION_QUANT),
      Math.round(frame.f[2] * ANGLE_QUANT),
    ];
    for (let i = 0; i < 9; i++) {
      writeVarint(out, zigzagEncode(first ? q[i] : q[i] - prev[i]));
      prev[i] = q[i];
    }
    first = false;
    out.push(frame.ejected ? 1 : 0);
    if (frame.ejected && frame.g) {
      const g = [
        Math.round(frame.g[0] * POSITION_QUANT),
        Math.round(frame.g[1] * POSITION_QUANT),
        Math.round(frame.g[2] * ANGLE_QUANT),
      ];
      for (let i = 0; i < 3; i++) {
        writeVarint(out, zigzagEncode(g[i] - prevRagdoll[i]));
        prevRagdoll[i] = g[i];
      }
    } else {
      prevRagdoll = [0, 0, 0];
    }
  }
  return out;
}

function decodeFrames(bytes: Uint8Array, pos: { i: number }, count: number): BodyFrame[] {
  const frames: BodyFrame[] = [];
  let step = 0;
  const prev = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let prevRagdoll = [0, 0, 0];
  for (let n = 0; n < count; n++) {
    step += readVarint(bytes, pos);
    const q: number[] = [];
    for (let i = 0; i < 9; i++) {
      const value = zigzagDecode(readVarint(bytes, pos));
      prev[i] = n === 0 ? value : prev[i] + value;
      q.push(prev[i]);
    }
    const ejected = readByte(bytes, pos) !== 0;
    let g: [number, number, number] | undefined;
    if (ejected) {
      const gv: number[] = [];
      for (let i = 0; i < 3; i++) {
        prevRagdoll[i] += zigzagDecode(readVarint(bytes, pos));
        gv.push(prevRagdoll[i]);
      }
      g = [gv[0] / POSITION_QUANT, gv[1] / POSITION_QUANT, gv[2] / ANGLE_QUANT];
    } else {
      prevRagdoll = [0, 0, 0];
    }
    frames.push({
      step,
      c: [q[0] / POSITION_QUANT, q[1] / POSITION_QUANT, q[2] / ANGLE_QUANT],
      r: [q[3] / POSITION_QUANT, q[4] / POSITION_QUANT, q[5] / ANGLE_QUANT],
      f: [q[6] / POSITION_QUANT, q[7] / POSITION_QUANT, q[8] / ANGLE_QUANT],
      ejected,
      g,
    });
  }
  return frames;
}

function writeBody(meta: RunMeta, frames: BodyFrame[], tricks: TrickEvent[], truncated: boolean): Uint8Array {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(meta.trackId)) throw new Error('bad track id');
  if (meta.trackId.length > MAX_TRACK_ID_LEN) throw new Error('track id too long');
  if (!/^[0-9a-f]{16}$/.test(meta.trackHashPrefix)) throw new Error('bad hash prefix');
  if (!Number.isInteger(meta.beginStep) || meta.beginStep < -1) throw new Error('bad begin step');
  if (!Number.isInteger(meta.endStep) || meta.endStep <= 0 || meta.endStep > MAX_END_STEP) {
    throw new Error('bad end step');
  }
  if (frames.length === 0 || frames.length > MAX_FRAMES) throw new Error('bad frame count');
  if (tricks.length > 10_000) throw new Error('too many tricks');

  const out: number[] = [REPLAY_VERSION];
  out.push(
    (meta.inverted ? 1 : 0) |
      (INTERVAL_BITS[meta.interval] << 1) |
      (meta.outcome === 'finish' ? 8 : 0) |
      (truncated ? 16 : 0),
  );
  const idBytes = [...meta.trackId].map((ch) => ch.charCodeAt(0));
  out.push(idBytes.length, ...idBytes);
  for (let i = 0; i < 16; i += 2) out.push(parseInt(meta.trackHashPrefix.slice(i, i + 2), 16));
  writeVarint(out, meta.beginStep + 1);
  writeVarint(out, meta.endStep);
  const progress = Math.min(1, Math.max(0, meta.progress));
  const progressRaw = Math.round(progress * 65535);
  out.push(progressRaw & 0xff, (progressRaw >> 8) & 0xff);
  writeVarint(out, Math.max(0, Math.floor(meta.finalScore)));
  writeVarint(out, Math.max(0, Math.floor(meta.finalTimeMs)));
  writeVarint(out, frames.length);
  out.push(...encodeFrames(frames));
  writeVarint(out, tricks.length);
  let prevTrickStep = 0;
  for (const trick of tricks) {
    if (trick.step < prevTrickStep) throw new Error('trick steps must be non-decreasing');
    writeVarint(out, trick.step - prevTrickStep);
    prevTrickStep = trick.step;
    if (!Number.isInteger(trick.code) || trick.code < 1 || trick.code > 127) throw new Error('bad trick code');
    out.push(trick.code);
    writeVarint(out, Math.max(0, Math.floor(trick.points)));
  }
  return new Uint8Array(out);
}

export interface DecodedReplay {
  meta: RunMeta;
  truncated: boolean;
  frames: BodyFrame[];
  tricks: TrickEvent[];
}

function readBody(body: Uint8Array): DecodedReplay {
  if (body.length < 4) throw new Error('replay too short');
  const pos = { i: 0 };
  if (readByte(body, pos) !== REPLAY_VERSION) throw new Error('unsupported replay version');
  const flags = readByte(body, pos);
  const inverted = (flags & 1) !== 0;
  const interval = BITS_INTERVAL[(flags >> 1) & 3];
  if (!interval) throw new Error('bad interval bits');
  const outcome = (flags & 8) !== 0 ? 'finish' : 'crash';
  const truncated = (flags & 16) !== 0;
  const idLen = readByte(body, pos);
  if (idLen === 0 || idLen > MAX_TRACK_ID_LEN) throw new Error('bad track id');
  let trackId = '';
  for (let i = 0; i < idLen; i++) trackId += String.fromCharCode(readByte(body, pos));
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(trackId)) throw new Error('bad track id');
  let trackHashPrefix = '';
  for (let i = 0; i < 8; i++) trackHashPrefix += readByte(body, pos).toString(16).padStart(2, '0');
  const beginStep = readVarint(body, pos) - 1;
  if (beginStep < -1) throw new Error('bad begin step');
  const endStep = readVarint(body, pos);
  if (endStep <= 0 || endStep > MAX_END_STEP) throw new Error('bad end step');
  const progressRaw = readByte(body, pos) | (readByte(body, pos) << 8);
  const finalScore = readVarint(body, pos);
  const finalTimeMs = readVarint(body, pos);
  const frameCount = readVarint(body, pos);
  if (frameCount === 0 || frameCount > MAX_FRAMES) throw new Error('bad frame count');
  const frames = decodeFrames(body, pos, frameCount);
  const trickCount = readVarint(body, pos);
  if (trickCount > 10_000) throw new Error('bad trick count');
  const tricks: TrickEvent[] = [];
  let trickStep = 0;
  for (let n = 0; n < trickCount; n++) {
    trickStep += readVarint(body, pos);
    const code = readByte(body, pos);
    if (code < 1 || code > 127) throw new Error('bad trick code');
    tricks.push({ step: trickStep, code, points: readVarint(body, pos) });
  }
  if (pos.i !== body.length) throw new Error('trailing bytes');
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
  };
}

function downsample(frames: BodyFrame[], every: number): BodyFrame[] {
  if (every <= 1) return frames;
  const out = frames.filter((_, i) => i % every === 0);
  return out.length > 0 ? out : frames;
}

/**
 * Encode a compact share link: snapshots downsampled, deflated, base64url.
 * Past ~8 KB only the run tail travels, flagged so the UI says so.
 */
export function encodeShareLink(meta: RunMeta, frames: BodyFrame[], tricks: TrickEvent[]): string {
  if (frames.length === 0) throw new Error('no frames to share');
  const pack = (list: BodyFrame[], flag: boolean): string => {
    const from = list[0].step;
    const body = writeBody(
      meta,
      list,
      tricks.filter((t) => t.step >= from),
      flag,
    );
    const deflated = deflateSync(body);
    const check = crc16(deflated);
    const bytes = new Uint8Array(deflated.length + 4);
    bytes[0] = deflated.length & 0xff;
    bytes[1] = (deflated.length >> 8) & 0xff;
    bytes.set(deflated, 2);
    bytes[deflated.length + 2] = (check >> 8) & 0xff;
    bytes[deflated.length + 3] = check & 0xff;
    return base64UrlEncode(bytes);
  };
  const dense = downsample(frames, SHARE_DOWNSAMPLE);
  const full = pack(dense, false);
  if (full.length <= MAX_LINK_LENGTH) return full;
  // Over the cap: keep roughly the last SHARE_KEEP_SECONDS of run time, shaving
  // the head in halves until the link fits.
  let keep = dense.slice(-Math.max(2, Math.floor((SHARE_KEEP_SECONDS * SNAPSHOT_HZ) / SHARE_DOWNSAMPLE)));
  let link = pack(keep, true);
  while (link.length > MAX_LINK_LENGTH && keep.length > 16) {
    keep = keep.slice(Math.ceil(keep.length / 2));
    link = pack(keep, true);
  }
  if (link.length > MAX_LINK_LENGTH) throw new Error('run too long to share');
  return link;
}

export interface DecodedShareLink extends DecodedReplay {
  encodedLength: number;
}

export function decodeShareLink(link: string): DecodedShareLink {
  if (link.length === 0 || link.length > MAX_LINK_LENGTH * 2) throw new Error('bad link length');
  const bytes = base64UrlDecode(link);
  if (bytes.length < 5) throw new Error('replay too short');
  const length = bytes[0] | (bytes[1] << 8);
  if (bytes.length !== length + 4) throw new Error('bad link length: corrupt or tampered');
  const deflated = bytes.subarray(2, 2 + length);
  const check = (bytes[length + 2] << 8) | bytes[length + 3];
  if (crc16(deflated) !== check) throw new Error('checksum mismatch: link is corrupt or tampered');
  return { ...readBody(inflateSync(deflated)), encodedLength: link.length };
}

/** Interpolated full-body pose at a step (holds the ends outside the range). */
export function poseAtStep(
  frames: BodyFrame[],
  step: number,
): {
  c: [number, number, number];
  r: [number, number, number];
  f: [number, number, number];
  ejected: boolean;
  g: [number, number, number] | null;
} | null {
  if (frames.length === 0) return null;
  const first = frames[0];
  if (step <= first.step) {
    return {
      c: [...first.c] as [number, number, number],
      r: [...first.r] as [number, number, number],
      f: [...first.f] as [number, number, number],
      ejected: first.ejected,
      g: first.g ? ([...first.g] as [number, number, number]) : null,
    };
  }
  const last = frames[frames.length - 1];
  if (step >= last.step) {
    return {
      c: [...last.c] as [number, number, number],
      r: [...last.r] as [number, number, number],
      f: [...last.f] as [number, number, number],
      ejected: last.ejected,
      g: last.g ? ([...last.g] as [number, number, number]) : null,
    };
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
