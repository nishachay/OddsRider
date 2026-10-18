import { momentumGlyph } from '../data/tracks';

/**
 * The direction half of the 24h cue: colour alone is not enough, so a ↑/↓
 * glyph sits beside the green/crimson number. Both arrows are in Anton's
 * self-hosted unicode-range (U+2191/U+2193), so poster numerals keep their
 * font. Decorative — the sign on the delta ("+2.4%") is what is announced —
 * and absent when the change is unknown ("—").
 */
export default function MomentumCue({ delta }: { delta: number | null | undefined }) {
  const glyph = momentumGlyph(delta);
  if (!glyph) return null;
  return (
    <span aria-hidden="true" className="mr-1">
      {glyph}
    </span>
  );
}
