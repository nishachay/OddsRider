interface SharePayload {
  finished: boolean;
  score: number;
  timeMs: number;
  marketQuestion?: string;
  finalProb?: number;
  trackPts?: Array<[number, number]> | null;
}

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return `${m.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
}

export function generateShareCard(payload: SharePayload): HTMLCanvasElement {
  const W = 1200;
  const H = 675; // Standard 16:9 Twitter/OG card aspect ratio
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const TOXIC = '#b6ff00';
  const CRIMSON = '#ff3355';
  const BG = '#0a0a0b';
  const LINE = '#1f242d';
  const INK = '#f0f0f2';
  const DIM = '#7c7f86';
  const isSuccess = payload.finished;
  const accent = isSuccess ? TOXIC : CRIMSON;

  // 1. Background Fill
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // 2. Subtle Dark Tactical Grid
  ctx.strokeStyle = '#12141a';
  ctx.lineWidth = 1;
  const GRID_SIZE = 40;
  for (let x = 0; x < W; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 3. Outer Machined Border with Corner Crosshairs
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  ctx.fillStyle = DIM;
  ctx.font = '700 14px monospace';
  ctx.fillText('+', 30, 36);
  ctx.fillText('+', W - 38, 36);
  ctx.fillText('+', 30, H - 30);
  ctx.fillText('+', W - 38, H - 30);

  // 4. Header: Brand Wordmark + Status Badge
  ctx.fillStyle = INK;
  ctx.font = '900 24px "Space Grotesk", sans-serif';
  ctx.fillText('ODDS', 64, 80);
  ctx.fillStyle = TOXIC;
  ctx.fillText('RIDER', 132, 80);

  ctx.fillStyle = DIM;
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  ctx.fillText('// TELEMETRY SETTLEMENT RECEIPT', 220, 78);

  // Status Pill (Top-Right)
  const statusText = isSuccess ? 'MARKET CONQUERED (100% RESOLVED)' : 'FATAL CRASH // OVERLOAD';
  ctx.fillStyle = isSuccess ? 'rgba(182, 255, 0, 0.12)' : 'rgba(255, 51, 85, 0.12)';
  ctx.fillRect(W - 380, 56, 316, 32);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(W - 380, 56, 316, 32);

  ctx.fillStyle = accent;
  ctx.font = '800 12px "Geist Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(statusText, W - 222, 76);
  ctx.textAlign = 'left';

  // Divider Line
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(64, 110);
  ctx.lineTo(W - 64, 110);
  ctx.stroke();

  // 5. Market Question (Full Text)
  ctx.fillStyle = DIM;
  ctx.font = '800 11px "Space Grotesk", sans-serif';
  ctx.fillText('SETTLED POLYMARKET CONTRACT:', 64, 145);

  ctx.fillStyle = INK;
  ctx.font = '600 20px "Space Grotesk", sans-serif';
  const question = payload.marketQuestion ?? 'Polymarket Probability Race';
  // Wrap text
  const maxWidth = W - 128;
  const words = question.split(' ');
  let line = '';
  let lineY = 178;
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, 64, lineY);
      line = words[i] + ' ';
      lineY += 26;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, 64, lineY);

  // 6. Terrain Curve Sparkline Background Graphic
  const pts = payload.trackPts;
  if (pts && pts.length > 2) {
    const chartX = 64;
    const chartY = lineY + 30;
    const chartW = W - 128;
    const chartH = 130;

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const sx = chartW / Math.max(1, x1 - x0);
    const sy = (chartH - 20) / Math.max(1, y1 - y0);

    // Gradient area fill
    ctx.beginPath();
    ctx.moveTo(chartX, chartY + chartH);
    ctx.lineTo(chartX, chartY + (pts[0][1] - y0) * sy);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(chartX + (pts[i][0] - x0) * sx, chartY + (pts[i][1] - y0) * sy);
    }
    ctx.lineTo(chartX + chartW, chartY + chartH);
    const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
    grad.addColorStop(0, isSuccess ? 'rgba(182, 255, 0, 0.25)' : 'rgba(255, 51, 85, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Track stroke
    ctx.lineWidth = 3;
    for (let i = 1; i < pts.length; i++) {
      ctx.strokeStyle = pts[i][1] <= pts[i - 1][1] ? TOXIC : CRIMSON;
      ctx.beginPath();
      ctx.moveTo(chartX + (pts[i - 1][0] - x0) * sx, chartY + (pts[i - 1][1] - y0) * sy);
      ctx.lineTo(chartX + (pts[i][0] - x0) * sx, chartY + (pts[i][1] - y0) * sy);
      ctx.stroke();
    }
  }

  // 7. Telemetry Stats Deck (Bottom)
  const statsY = H - 150;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(64, statsY);
  ctx.lineTo(W - 64, statsY);
  ctx.stroke();

  // Column 1: Time Elapsed
  ctx.fillStyle = DIM;
  ctx.font = '800 11px "Space Grotesk", sans-serif';
  ctx.fillText('SESSION TIME', 64, statsY + 30);
  ctx.fillStyle = INK;
  ctx.font = '800 34px "Geist Mono", monospace';
  ctx.fillText(fmtTime(payload.timeMs), 64, statsY + 68);

  // Column 2: Final Score
  ctx.fillStyle = DIM;
  ctx.font = '800 11px "Space Grotesk", sans-serif';
  ctx.fillText('FINAL SCORE', 340, statsY + 30);
  ctx.fillStyle = INK;
  ctx.font = '800 34px "Geist Mono", monospace';
  ctx.fillText(payload.score.toLocaleString(), 340, statsY + 68);

  // Column 3: Final Odds
  if (payload.finalProb !== undefined) {
    ctx.fillStyle = DIM;
    ctx.font = '800 11px "Space Grotesk", sans-serif';
    ctx.fillText('SETTLEMENT ODDS', 620, statsY + 30);
    ctx.fillStyle = accent;
    ctx.font = '900 34px "Geist Mono", monospace';
    ctx.fillText(`${(payload.finalProb * 100).toFixed(1)}% YES`, 620, statsY + 68);
  }

  // Column 4: Watermark & CTA
  ctx.fillStyle = DIM;
  ctx.font = '700 11px "Space Grotesk", sans-serif';
  ctx.fillText('RIDE REAL POLYMARKET CHARTS AT:', W - 320, statsY + 30);
  ctx.fillStyle = TOXIC;
  ctx.font = '900 20px "Space Grotesk", sans-serif';
  ctx.fillText('ODDSRIDER.COM', W - 320, statsY + 65);

  return canvas;
}

export function downloadShareCardImage(payload: SharePayload): void {
  const canvas = generateShareCard(payload);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oddsrider-settlement-${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function shareToTwitter(payload: SharePayload): void {
  const timeStr = fmtTime(payload.timeMs);
  const statusStr = payload.finished ? 'Just conquered the market on @OddsRider 🏍️💨' : 'Crashed trying to ride market volatility on @OddsRider 💥';
  const probStr = payload.finalProb !== undefined ? `${(payload.finalProb * 100).toFixed(1)}% YES` : '';
  const questionStr = payload.marketQuestion ? `"${payload.marketQuestion}"` : 'Polymarket Event';

  const tweetText = [
    statusStr,
    `📈 ${questionStr} (${probStr})`,
    `⏱️ Time: ${timeStr} | 🏆 Score: ${payload.score.toLocaleString()}`,
    ``,
    `Ride real Polymarket probability charts: https://oddsrider.com`
  ].join('\n');

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=600,height=450');
}
