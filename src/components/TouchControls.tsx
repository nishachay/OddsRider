import { useCallback } from 'react';

function press(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code }));
}

function release(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keyup', { code }));
}

function HoldButton({
  code,
  label,
  wide,
}: {
  code: string;
  label: string;
  wide?: boolean;
}) {
  const down = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or already-released pointers have nothing to capture
      }
      press(code);
    },
    [code],
  );
  const up = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      release(code);
    },
    [code],
  );

  return (
    <button
      className={`pointer-events-auto font-mono text-[11px] font-bold tracking-widest uppercase border border-[#232529] bg-[#12141a]/85 text-dim active:text-toxic active:border-toxic/60 py-4 select-none min-h-[60px] min-w-[60px] ${
        wide ? 'px-7' : 'px-5'
      }`}
      style={{ touchAction: 'none' }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={() => release(code)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function JumpButton() {
  const tap = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    press('Space');
    release('Space');
  }, []);

  return (
    <button
      className="pointer-events-auto font-mono text-[11px] font-bold tracking-widest uppercase border border-[#232529] bg-[#12141a]/85 text-dim active:text-toxic active:border-toxic/60 px-5 py-4 select-none min-h-[60px] min-w-[60px]"
      style={{ touchAction: 'none' }}
      onPointerDown={tap}
      onContextMenu={(e) => e.preventDefault()}
    >
      JUMP
    </button>
  );
}

// Thumb controls for touch devices. Feeds the existing keyboard pipeline
// via synthetic events, so the game side stays untouched.
export default function TouchControls() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 hidden [@media(pointer:coarse)]:flex items-end justify-between px-4 select-none">
      <div className="flex items-center gap-2">
        <HoldButton code="ArrowLeft" label="◀ LEAN" />
        <HoldButton code="ArrowRight" label="LEAN ▶" />
      </div>
      <div className="flex items-center gap-2">
        <HoldButton code="ArrowDown" label="BRAKE" />
        <JumpButton />
        <HoldButton code="ShiftLeft" label="NITRO" />
        <HoldButton code="ArrowUp" label="GAS" wide />
      </div>
    </div>
  );
}
