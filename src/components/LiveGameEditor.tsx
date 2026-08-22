import { useState } from "react";
import { SPRITE } from "../game/constants";
import { bus, EV } from "../game/bus";

type ElementKey = "CHASSIS" | "REAR_WHEEL" | "FRONT_WHEEL" | "RIDER";

interface LiveGameEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveGameEditor({ isOpen, onClose }: LiveGameEditorProps) {
  const [selected, setSelected] = useState<ElementKey>("CHASSIS");

  const [params, setParams] = useState({
    bikeScale: SPRITE.bikeScale,
    rearWheelScale: SPRITE.rearWheelScale,
    frontWheelScale: SPRITE.frontWheelScale,
    rearWheelOffsetX: SPRITE.rearWheelOffsetX,
    rearWheelOffsetY: SPRITE.rearWheelOffsetY,
    frontWheelOffsetX: SPRITE.frontWheelOffsetX,
    frontWheelOffsetY: SPRITE.frontWheelOffsetY,
    seatLocalX: SPRITE.seatLocalX,
    seatLocalY: SPRITE.seatLocalY,
    riderScale: SPRITE.riderScale,
    riderAngleOffset: SPRITE.riderAngleOffset,
    flagScale: SPRITE.flagScale,
  });

  const updateParam = (key: keyof typeof params, val: number) => {
    const fix = (v: number) => parseFloat(v.toFixed(2));
    const targetVal = fix(val);

    setParams((prev) => {
      const next = { ...prev, [key]: targetVal };
      (SPRITE as any)[key] = targetVal;
      bus.emit(EV.STUDIO_UPDATE);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed top-4 right-4 z-50 flex w-80 flex-col border border-toxic bg-bg/95 p-4 font-mono text-ink shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-line pb-2">
        <span className="font-bold text-xs tracking-widest text-toxic">LIVE IN-GAME STUDIO</span>
        <button onClick={onClose} className="border border-line px-2 py-0.5 text-xs text-dim">[ X ]</button>
      </div>

      <div className="mt-3 flex gap-1">
        {(["CHASSIS", "REAR_WHEEL", "FRONT_WHEEL", "RIDER"] as ElementKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`border px-2 py-1 text-[10px] font-bold ${selected === key ? "border-toxic bg-toxic text-bg" : "border-line text-dim"}`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {selected === "REAR_WHEEL" && (
          <>
            <div className="flex items-center justify-between text-xs">
              <span>OFFSET X:</span>
              <input type="number" step="0.1" value={params.rearWheelOffsetX} onChange={(e) => updateParam("rearWheelOffsetX", parseFloat(e.target.value) || 0)} className="w-20 bg-black text-toxic border border-line px-1" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>OFFSET Y:</span>
              <input type="number" step="0.1" value={params.rearWheelOffsetY} onChange={(e) => updateParam("rearWheelOffsetY", parseFloat(e.target.value) || 0)} className="w-20 bg-black text-toxic border border-line px-1" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
