import { useEffect, useState } from 'react';
import { bus, EV } from '../game/bus';

function Key({ label }: { label: string }) {
  return (
    <span className="inline-flex min-w-7 items-center justify-center border border-line bg-bg/85 px-1.5 py-1 font-mono text-[10px] leading-none text-ink">
      {label}
    </span>
  );
}

function Hint({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((k) => (
        <Key key={k} label={k} />
      ))}
      <span className="ml-0.5 font-mono text-[10px] tracking-[0.2em] text-dim">{label}</span>
    </span>
  );
}

export default function HudOverlay() {
  const [speed, setSpeed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [nitro, setNitro] = useState(0);
  const [crashFlash, setCrashFlash] = useState(false);
  const [hintsVisible, setHintsVisible] = useState(true);

  useEffect(() => {
    const offSpeed = bus.on<number>(EV.SPEED, setSpeed);
    const offMute = bus.on<boolean>(EV.MUTE, setMuted);
    const offNitro = bus.on<number>(EV.NITRO, setNitro);
    let crashTimer = 0;
    const offCrash = bus.on(EV.CRASH, () => {
      setCrashFlash(true);
      window.clearTimeout(crashTimer);
      crashTimer = window.setTimeout(() => setCrashFlash(false), 900);
    });

    const fallbackTimer = window.setTimeout(() => setHintsVisible(false), 6500);
    let hideTimer = 0;
    const offFirst = bus.on(EV.INPUT_FIRST, () => {
      hideTimer = window.setTimeout(() => setHintsVisible(false), 1800);
    });

    return () => {
      offSpeed();
      offMute();
      offNitro();
      offCrash();
      offFirst();
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(hideTimer);
      window.clearTimeout(crashTimer);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.42) 100%)' }}
      />

      {/* top-left: wordmark + speed */}
      <div className="absolute top-4 left-4 flex items-stretch gap-2">
        <div className="border border-line bg-bg/85 px-3 py-2">
          <div
            className="font-display text-sm leading-none font-bold tracking-[0.18em] text-ink"
            style={{ fontStretch: '118%' }}
          >
            ODDSRIDER
          </div>
          <div className="mt-1.5 font-mono text-[9px] tracking-[0.32em] text-dim">TEST GROUND</div>
        </div>
        <div className="border border-line bg-bg/85 px-3 py-2">
          <div className="font-mono text-[9px] tracking-[0.32em] text-dim">SPEED</div>
          <div className="mt-0.5 font-mono text-2xl leading-none tabular-nums text-ink">
            {speed}
            <span className="ml-1 text-[10px] text-dim">PX/S</span>
          </div>
        </div>
        {muted && (
          <div className="self-start border border-crimson bg-bg/85 px-2 py-1 font-mono text-[9px] tracking-[0.28em] text-crimson">
            AUDIO OFF
          </div>
        )}
        <div className="border border-line bg-bg/85 px-3 py-2">
          <div className="font-mono text-[9px] tracking-[0.32em] text-dim">NITRO</div>
          <div className="mt-1.5 flex gap-[3px]">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={`h-3 w-1.5 ${nitro * 10 > i ? 'bg-toxic' : 'bg-line'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* crash flash */}
      <div
        className={`absolute inset-0 border-4 border-crimson transition-opacity duration-300 ${
          crashFlash ? 'opacity-70' : 'opacity-0'
        }`}
      />

      {/* bottom-center: control hints */}
      <div
        className={`absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 border border-line bg-bg/85 px-4 py-2 transition-opacity duration-700 ${
          hintsVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Hint keys={['W']} label="GAS" />
        <Hint keys={['S']} label="BRAKE" />
        <Hint keys={['A', 'D']} label="LEAN" />
        <Hint keys={['SPACE']} label="JUMP" />
        <Hint keys={['SHIFT']} label="NITRO" />
        <Hint keys={['R']} label="RESET" />
        <Hint keys={['M']} label="MUTE" />
      </div>
    </div>
  );
}
