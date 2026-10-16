import { Link } from 'react-router-dom';
import TopStrip from '../components/TopStrip';

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <section id={id} className="flex flex-col gap-2 scroll-mt-20">
      <h2 className="font-mono text-xs font-bold tracking-[0.24em] uppercase">
        <span className="text-toxic">{num}</span> <span className="text-ink">{title}</span>
      </h2>
      <div className="font-sans text-sm text-dim leading-relaxed flex flex-col gap-2">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="w-full flex flex-col min-h-screen">
      <TopStrip />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-12 flex flex-col gap-10 select-none">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-toxic uppercase">
            Motocross meets crowd odds
          </span>
          <h1 className="font-poster uppercase text-5xl sm:text-6xl text-ink leading-[0.9]">
            About the races
          </h1>
          <p className="font-sans text-sm text-dim leading-relaxed">
            You&apos;re not riding money — you&apos;re riding what the crowd believes.
            OddsRider is a free browser game that turns real probability charts into
            rideable motocross tracks. Pick a track, ride what the crowd believes — every rally
            is a climb, every crash is a cliff. Ride the YES side uphill, or flip to the NO side
            and ride the same history inverted.
          </p>
        </div>

        <Section num="01" title="How it works">
          <p>
            Every track is a real price history. Each data point becomes one terrain node, mapped
            1:1 with no smoothing — jagged volatility is the game. Flat markets ride like smooth
            highways; volatile ones throw cliff edges and launchpad jumps at you.
          </p>
          <p>
            Track difficulty is computed from the curve itself: calm probability lines are EASY,
            violent swingers are INSANE. History never repeats exactly, so every contract rides
            differently.
          </p>
        </Section>

        <Section num="02" title="Tricks & scoring">
          <p>
            Score comes from distance (up to 1000) plus air tricks — flips, stoppies, wheelies,
            big air — chained under a combo multiplier up to ×5. Crashing costs 500 points and
            resets the combo. Crossing the finish gate pays 1000.
          </p>
        </Section>

        <Section num="03" title="Compete">
          <p>
            A new daily challenge drops every day at 00:00 UTC — one market, same track for
            everyone, no excuses. Your per-track records (best score, plays, wins) live on your
            device, so every market has a personal leaderboard with your name on all of it.
          </p>
        </Section>

        <Section num="04" title="Controls">
          <p>
            Desktop: W or ↑ for gas, S or ↓ for brake, A/D or ←/→ to lean, Space to jump,
            Shift or N for nitro, R to reset, M to mute. Touch controls appear automatically on
            mobile.
          </p>
        </Section>

        <Section num="05" title="Available tracks">
          <p>
            The card lists live tracks alongside settled classics — famous resolved
            markets with their final YES or NO shown on the card. Tracks are frozen
            snapshots published by a scheduled ingest, so the same track always
            rides the same.
          </p>
        </Section>

        <Section num="06" title="Free game">
          <p>
            OddsRider is a game. Nothing here is financial advice, and nothing here
            involves money — no positions, no payouts, no prizes. Market data is
            shown for entertainment as terrain.
          </p>
        </Section>

        <Section num="07" title="Data honesty">
          <p>
            Probabilities shown are last-trade prices from frozen snapshots. A 24H
            change shows "—" when it can&apos;t be computed, and a track with no
            history simply doesn&apos;t exist — odds are never fabricated. When the
            track index is unreachable, the site says so instead of guessing.
          </p>
        </Section>

        <Section num="08" title="Privacy">
          <p>
            There are no accounts and no tracking. Your rides, scores, and cached markets live
            only in your own browser's local storage. Clear your site data and it's all gone.
          </p>
        </Section>

        <Section num="09" title="Questions">
          <p>
            <span className="text-ink font-bold">Is it free?</span> Yes — free forever, no
            account, no wallet, no ads.
          </p>
          <p>
            <span className="text-ink font-bold">What does riding NO do?</span> It inverts the
            probability curve (1 − p), so rallies become descents and crashes become climbs. Same
            history, mirrored danger.
          </p>
        </Section>

        <Link
          to="/"
          className="self-start font-mono text-xs font-bold tracking-[0.2em] text-toxic border-b-2 border-toxic/40 px-1 py-2 hover:bg-toxic hover:text-bg transition-colors uppercase"
        >
          ← Back to title
        </Link>
      </main>
    </div>
  );
}
