import { useEffect, useState } from 'react';
import { bus, EV } from '../game/bus';

const STEPS = ['3', '2', '1', 'RIDE'];

export default function CountdownGate({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      bus.emit(EV.RESTART);
      onDone();
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), step === STEPS.length - 1 ? 500 : 700);
    return () => window.clearTimeout(t);
  }, [step, onDone]);

  if (step >= STEPS.length) return null;

  const label = STEPS[step];
  const go = label === 'RIDE';

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#0a0a0b]/60 select-none">
      <span
        className={`font-mono font-black tabular-nums leading-none ${
          go ? 'text-toxic text-7xl sm:text-8xl' : 'text-ink text-6xl sm:text-7xl'
        }`}
        style={go ? { textShadow: '0 0 32px rgba(182,255,0,0.6)' } : undefined}
      >
        {label}
      </span>
      {!go && (
        <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-dim uppercase">
          W GAS · A/D LEAN · SPACE JUMP · SHIFT NITRO
        </span>
      )}
    </div>
  );
}
