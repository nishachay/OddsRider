/**
 * Sharing a run: the `/r/` link, the share sheet, and the 1200x630 card.
 *
 * A shared link carries the whole replay (the base64url payload from
 * `@oddsrider/core`), so opening it replays the run exactly — no server, no
 * second source of truth. Sharing prefers the platform share sheet
 * (`navigator.share`, with the PNG card attached when the platform accepts
 * files) and falls back to copying the text; a cancelled sheet is a
 * deliberate no, never a silent copy.
 *
 * The card is drawn on a plain canvas in the race-day palette. It only ever
 * prints what the recording already knows: the outcome, the score, the time
 * and the run's own path. No invented numbers.
 */
import { decodeShareLink, encodeShareLink, type DecodedShareLink, type SharePayload } from '@oddsrider/core';

export type ShareState = 'idle' | 'shared' | 'copied' | 'failed';

/** The route that plays a shared replay. */
export const SHARE_ROUTE = '/r/';

/** OG/Twitter card size. 1.91:1 is the size every crawler crops to. */
export const CARD_W = 1200;
export const CARD_H = 630;

const BG = '#0a0a0b';
const LINE = '#232529';
const INK = '#f0f0f2';
const DIM = '#7c7f86';
const TOXIC = '#b6ff00';
const CRIMSON = '#ff3355';

/** Whole percent of the course where the run ended (0..100). */
export function crashPercent(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

/** "00:09.5" — the same clock the result screen and HUD show. */
export function formatRunTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

/**
 * The share copy: a crash names the point on the curve, a finish says so
 * instead of claiming a crash.
 */
export function shareTextFor(payload: SharePayload, question: string, url: string): string {
  const track = `"${question}"`;
  if (payload.outcome === 'finish') return `I rode ${track} to the finish — beat me: ${url}`;
  return `I rode ${track} and crashed at ${crashPercent(payload.progress)}% — beat me: ${url}`;
}

/** The replay payload as a URL-safe string. Empty recordings cannot travel. */
export function encodeRunShare(payload: SharePayload): string {
  if (payload.frames.length === 0) throw new Error('no frames to share');
  return encodeShareLink(payload, payload.frames, payload.tricks);
}

/** Decode a `/r/` payload. Throws on anything corrupt or tampered. */
export function decodeRunShare(link: string): DecodedShareLink {
  return decodeShareLink(link);
}

function currentOrigin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

/** The absolute `/r/<payload>` link for a run. */
export function shareUrlFor(payload: SharePayload, origin: string = currentOrigin()): string {
  return `${origin.replace(/\/+$/, '')}${SHARE_ROUTE}${encodeRunShare(payload)}`;
}

/** Copy text to the clipboard. False when the browser refuses or lacks it. */
export async function copyToClipboard(text: string): Promise<boolean> {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Denied or unavailable: the caller reports the failure.
  }
  return false;
}

function isAbort(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError';
}

export interface ShareRunInput {
  payload: SharePayload;
  question: string;
  url: string;
  /** The 1200x630 card, attached when the platform accepts files. */
  card?: Blob | null;
  title?: string;
}

/**
 * Open the share sheet, or copy the text when there is none. Returns what
 * actually happened so the UI can say so.
 */
export async function shareRun(input: ShareRunInput): Promise<ShareState> {
  const text = shareTextFor(input.payload, input.question, input.url);
  const nav = typeof navigator === 'undefined' ? null : navigator;

  if (nav && typeof nav.share === 'function') {
    const data: ShareData = { title: input.title ?? 'OddsRider', text };
    if (input.card && typeof nav.canShare === 'function') {
      const files = [new File([input.card], 'oddsrider-run.png', { type: 'image/png' })];
      if (nav.canShare({ files })) data.files = files;
    }
    try {
      await nav.share(data);
      return 'shared';
    } catch (error) {
      // The user closed the sheet on purpose: do not copy behind their back.
      if (isAbort(error)) return 'failed';
    }
  }
  return (await copyToClipboard(text)) ? 'copied' : 'failed';
}

export interface ShareCardInput {
  payload: SharePayload;
  /** The market question, or null when the frozen track is gone. */
  question: string | null;
  url: string;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) {
        line = '';
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 2) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
    }
    if (!lines[maxLines - 1].endsWith('…')) lines[maxLines - 1] += '…';
  }
  return lines;
}

/** Host without protocol, for the card's footer. */
function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, '').split('/')[0] || 'oddsrider.com';
}

/**
 * Draw the share card. Returns the live canvas so the caller can attach it
 * (as a Blob) or hand it to a download; 1200x630 so every crawler crops to
 * the same composition.
 */
export function renderShareCard(input: ShareCardInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const crashed = input.payload.outcome !== 'finish';
  const accent = crashed ? CRIMSON : TOXIC;
  const pad = 56;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, CARD_W - 48, CARD_H - 48);

  // Wordmark + provenance.
  ctx.font = '400 34px Anton, "Arial Narrow", sans-serif';
  ctx.fillStyle = INK;
  ctx.fillText('ODDS', pad, 88);
  ctx.fillStyle = TOXIC;
  ctx.fillText('RIDER', pad + ctx.measureText('ODDS').width, 88);
  ctx.font = '700 13px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = DIM;
  ctx.textAlign = 'right';
  ctx.fillText('SNAPSHOT REPLAY', CARD_W - pad, 86);
  ctx.textAlign = 'left';

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 114);
  ctx.lineTo(CARD_W - pad, 114);
  ctx.stroke();

  // Outcome poster headline.
  const headline = crashed ? `CRASHED AT ${crashPercent(input.payload.progress)}%` : 'FINISHED';
  ctx.font = '400 86px Anton, "Arial Narrow", sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(headline, pad, 226);

  // The market question, two lines at most.
  ctx.font = '600 24px "Space Grotesk", sans-serif';
  ctx.fillStyle = INK;
  const question = input.question ?? 'The frozen track for this run is no longer published.';
  const lines = wrapLines(ctx, question, CARD_W - pad * 2, 2);
  lines.forEach((line, i) => ctx.fillText(line, pad, 276 + i * 30));

  // The run's own path: the recorded rear hub is the ground it rode.
  const pts = input.payload.frames.filter((_, i) => i % 2 === 0).map((f) => f.r);
  if (pts.length > 1) {
    const left = pad;
    const right = CARD_W - pad;
    const top = 356;
    const bottom = 500;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const sx = (right - left) / Math.max(1, maxX - minX);
    const sy = (bottom - top) / Math.max(1, maxY - minY);
    const px = (x: number) => left + (x - minX) * sx;
    const py = (y: number) => top + (y - minY) * sy;

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = px(pts[i][0]);
      const y = py(pts[i][1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = px(pts[i][0]);
      const y = py(pts[i][1]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Where the run ended.
    const last = pts[pts.length - 1];
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(px(last[0]), py(last[1]), 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Telemetry row: only what the recording carries.
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(pad, 536);
  ctx.lineTo(CARD_W - pad, 536);
  ctx.stroke();

  const stat = (label: string, value: string, x: number, color: string) => {
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText(label, x, 566);
    ctx.font = '800 30px "Geist Mono", ui-monospace, monospace';
    ctx.fillStyle = color;
    ctx.fillText(value, x, 602);
  };
  stat('SCORE', input.payload.finalScore.toLocaleString(), pad, INK);
  stat('TIME', formatRunTime(input.payload.finalTimeMs), 360, INK);
  stat(crashed ? 'CRASHED AT' : 'OUTCOME', crashed ? `${crashPercent(input.payload.progress)}%` : 'FINISH', 620, accent);

  ctx.textAlign = 'right';
  ctx.font = '700 12px "Geist Mono", ui-monospace, monospace';
  ctx.fillStyle = DIM;
  ctx.fillText('RIDE IT', CARD_W - pad, 566);
  ctx.font = '800 26px "Space Grotesk", sans-serif';
  ctx.fillStyle = TOXIC;
  ctx.fillText(hostOf(input.url), CARD_W - pad, 602);
  ctx.textAlign = 'left';

  return canvas;
}

async function fontsReady(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch {
    // A font that never loads just falls back; the card still draws.
  }
}

/** Render the card once the webfonts have settled. Null outside a document. */
export async function shareCardBlob(input: ShareCardInput): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  await fontsReady();
  const canvas = renderShareCard(input);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

/** Save a blob to the user's downloads. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
