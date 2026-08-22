import { useEffect, useState } from "react";
import { SPRITE } from "../game/constants";

type ElementKey = "CHASSIS" | "REAR_WHEEL" | "FRONT_WHEEL" | "RIDER" | "FLAG";

interface LiveGameEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LiveGameEditor({ isOpen, onClose }: LiveGameEditorProps) {
  const [selected, setSelected] = useState<ElementKey>("CHASSIS");
  const [syncWheels, setSyncWheels] = useState(true);

  // Asset Lock Map
  const [lockedMap, setLockedMap] = useState<{ [key in ElementKey]: boolean }>({
    CHASSIS: false,
    REAR_WHEEL: false,
    FRONT_WHEEL: false,
    RIDER: false,
    FLAG: false,
  });

  // Local state mirrored to live game SPRITE constants
  const [params, setParams] = useState({
    bikeScale: SPRITE.bikeScale,
    bikeOriginX: SPRITE.bikeOriginX,
    bikeOriginY: SPRITE.bikeOriginY,

    rearWheelScale: SPRITE.rearWheelScale,
    frontWheelScale: SPRITE.frontWheelScale,
    rearWheelOffsetX: SPRITE.rearWheelOffsetX,
    rearWheelOffsetY: SPRITE.rearWheelOffsetY,
    frontWheelOffsetX: SPRITE.frontWheelOffsetX,
    frontWheelOffsetY: SPRITE.frontWheelOffsetY,

    riderScale: SPRITE.riderScale,
    riderOriginY: SPRITE.riderOriginY,
    riderAngleOffset: SPRITE.riderAngleOffset,
    seatLocalX: SPRITE.seatLocalX,
    seatLocalY: SPRITE.seatLocalY,

    flagScale: SPRITE.flagScale,
  });

  const updateParam = (key: keyof typeof params, val: number) => {
    if (lockedMap[selected]) return; // Blocked if asset is locked!

    const fix = (v: number) => parseFloat(v.toFixed(2));
    const targetVal = fix(val);

    setParams((prev) => {
      const next = { ...prev, [key]: targetVal };

      if (syncWheels && (key === "rearWheelScale" || key === "frontWheelScale")) {
        next.rearWheelScale = targetVal;
        next.frontWheelScale = targetVal;
        (SPRITE as any).rearWheelScale = targetVal;
        (SPRITE as any).frontWheelScale = targetVal;
      }

      // Mutate live SPRITE constants directly so Phaser BikeRenderer updates instantly!
      (SPRITE as any)[key] = targetVal;

      return next;
    });
  };

  const toggleLock = (key: ElementKey) => {
    setLockedMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const nudge = (dx: number, dy: number) => {
    if (lockedMap[selected]) return;

    if (selected === "REAR_WHEEL") {
      updateParam("rearWheelOffsetX", params.rearWheelOffsetX + dx);
      updateParam("rearWheelOffsetY", params.rearWheelOffsetY + dy);
    } else if (selected === "FRONT_WHEEL") {
      updateParam("frontWheelOffsetX", params.frontWheelOffsetX + dx);
      updateParam("frontWheelOffsetY", params.frontWheelOffsetY + dy);
    } else if (selected === "RIDER") {
      updateParam("seatLocalX", params.seatLocalX + dx);
      updateParam("seatLocalY", params.seatLocalY + dy);
    }
  };

  // Keyboard Nudge Listener in Live Game (1.0px / Shift 0.1px micro-nudge)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      const step = e.shiftKey ? 0.1 : 1.0;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        nudge(0, -step);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        nudge(0, step);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(-step, 0);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(step, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selected, params, lockedMap]);

  const copyConfigJSON = () => {
    const jsonStr = JSON.stringify(params, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Copied Live In-Game Configuration JSON to Clipboard!");
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed top-4 right-4 z-50 flex max-h-[92vh] w-84 flex-col overflow-y-auto border border-toxic bg-bg/95 p-4 font-mono text-ink shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse bg-toxic" />
          <span className="font-bold text-xs tracking-widest text-toxic">LIVE IN-GAME STUDIO</span>
        </div>
        <button
          onClick={onClose}
          className="border border-line px-2 py-0.5 text-xs text-dim hover:border-crimson hover:text-crimson"
        >
          [ X ]
        </button>
      </div>

      <p className="mt-2 text-[10px] text-dim">
        Edit asset positions, scales, & angles directly inside the active Phaser game scene! Use Arrow Keys (1px) or Shift+Arrow (0.1px).
      </p>

      {/* Asset Selection Tree */}
      <div className="mt-3 flex flex-wrap gap-1">
        {(["CHASSIS", "REAR_WHEEL", "FRONT_WHEEL", "RIDER", "FLAG"] as ElementKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            className={`border px-2 py-1 text-[10px] font-bold transition-all ${
              selected === key
                ? "border-toxic bg-toxic text-bg"
                : lockedMap[key]
                ? "border-crimson bg-crimson/20 text-crimson"
                : "border-line bg-black/50 text-dim hover:border-ink hover:text-ink"
            }`}
          >
            {lockedMap[key] ? "🔒 " : ""}{key.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Asset Lock Toggle Card */}
      <div className="mt-3 border border-line bg-black/40 p-2 flex items-center justify-between">
        <span className="text-[10px] font-bold text-dim">FREEZE {selected}:</span>
        <label className="flex items-center gap-1 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={lockedMap[selected]}
            onChange={() => toggleLock(selected)}
            className="accent-crimson"
          />
          <span className={lockedMap[selected] ? "text-crimson font-bold" : "text-toxic"}>
            {lockedMap[selected] ? "🔒 LOCKED" : "🔓 UNLOCKED"}
          </span>
        </label>
      </div>

      {/* Tweak Controls for Selected Item */}
      <div className="mt-3 flex flex-col gap-3">
        {selected === "CHASSIS" && (
          <div className="flex flex-col gap-2 border border-line bg-black/40 p-2">
            <span className="text-[10px] font-bold text-toxic">CHASSIS BIKE CONTROLS</span>
            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SCALE:</span>
              <input
                disabled={lockedMap.CHASSIS}
                type="number"
                step="0.01"
                value={params.bikeScale}
                onChange={(e) => updateParam("bikeScale", parseFloat(e.target.value) || 0.1)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.CHASSIS}
                type="range"
                min="0.05"
                max="1.5"
                step="0.01"
                value={params.bikeScale}
                onChange={(e) => updateParam("bikeScale", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {selected === "REAR_WHEEL" && (
          <div className="flex flex-col gap-2 border border-line bg-black/40 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-toxic">REAR WHEEL CONTROLS</span>
              <label className="flex items-center gap-1 text-[9px] text-dim cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncWheels}
                  onChange={(e) => setSyncWheels(e.target.checked)}
                  className="accent-toxic"
                />
                SYNC WHEELS
              </label>
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SCALE:</span>
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="number"
                step="0.01"
                value={params.rearWheelScale}
                onChange={(e) => updateParam("rearWheelScale", parseFloat(e.target.value) || 0.1)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="range"
                min="0.05"
                max="1.5"
                step="0.01"
                value={params.rearWheelScale}
                onChange={(e) => updateParam("rearWheelScale", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">OFFSET X:</span>
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="number"
                step="0.1"
                value={params.rearWheelOffsetX}
                onChange={(e) => updateParam("rearWheelOffsetX", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="range"
                min="-150"
                max="150"
                step="0.1"
                value={params.rearWheelOffsetX}
                onChange={(e) => updateParam("rearWheelOffsetX", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">OFFSET Y:</span>
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="number"
                step="0.1"
                value={params.rearWheelOffsetY}
                onChange={(e) => updateParam("rearWheelOffsetY", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.REAR_WHEEL}
                type="range"
                min="-100"
                max="100"
                step="0.1"
                value={params.rearWheelOffsetY}
                onChange={(e) => updateParam("rearWheelOffsetY", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {selected === "FRONT_WHEEL" && (
          <div className="flex flex-col gap-2 border border-line bg-black/40 p-2">
            <span className="text-[10px] font-bold text-toxic">FRONT WHEEL CONTROLS</span>
            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SCALE:</span>
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="number"
                step="0.01"
                value={params.frontWheelScale}
                onChange={(e) => updateParam("frontWheelScale", parseFloat(e.target.value) || 0.1)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="range"
                min="0.05"
                max="1.5"
                step="0.01"
                value={params.frontWheelScale}
                onChange={(e) => updateParam("frontWheelScale", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">OFFSET X:</span>
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="number"
                step="0.1"
                value={params.frontWheelOffsetX}
                onChange={(e) => updateParam("frontWheelOffsetX", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="range"
                min="-150"
                max="150"
                step="0.1"
                value={params.frontWheelOffsetX}
                onChange={(e) => updateParam("frontWheelOffsetX", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">OFFSET Y:</span>
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="number"
                step="0.1"
                value={params.frontWheelOffsetY}
                onChange={(e) => updateParam("frontWheelOffsetY", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.FRONT_WHEEL}
                type="range"
                min="-100"
                max="100"
                step="0.1"
                value={params.frontWheelOffsetY}
                onChange={(e) => updateParam("frontWheelOffsetY", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>
          </div>
        )}

        {selected === "RIDER" && (
          <div className="flex flex-col gap-2 border border-line bg-black/40 p-2">
            <span className="text-[10px] font-bold text-toxic">RIDER CONTROLS</span>
            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SCALE:</span>
              <input
                disabled={lockedMap.RIDER}
                type="number"
                step="0.01"
                value={params.riderScale}
                onChange={(e) => updateParam("riderScale", parseFloat(e.target.value) || 0.1)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.RIDER}
                type="range"
                min="0.05"
                max="1.5"
                step="0.01"
                value={params.riderScale}
                onChange={(e) => updateParam("riderScale", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">ANGLE:</span>
              <input
                disabled={lockedMap.RIDER}
                type="number"
                step="0.5"
                value={params.riderAngleOffset}
                onChange={(e) => updateParam("riderAngleOffset", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.RIDER}
                type="range"
                min="-180"
                max="180"
                step="0.5"
                value={params.riderAngleOffset}
                onChange={(e) => updateParam("riderAngleOffset", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SEAT X:</span>
              <input
                disabled={lockedMap.RIDER}
                type="number"
                step="0.1"
                value={params.seatLocalX}
                onChange={(e) => updateParam("seatLocalX", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.RIDER}
                type="range"
                min="-150"
                max="150"
                step="0.1"
                value={params.seatLocalX}
                onChange={(e) => updateParam("seatLocalX", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>

            <div className="flex items-center justify-between text-xs gap-1">
              <span className="text-dim">SEAT Y:</span>
              <input
                disabled={lockedMap.RIDER}
                type="number"
                step="0.1"
                value={params.seatLocalY}
                onChange={(e) => updateParam("seatLocalY", parseFloat(e.target.value) || 0)}
                className="w-20 border border-line bg-black px-2 py-0.5 text-toxic font-bold disabled:opacity-50"
              />
              <input
                disabled={lockedMap.RIDER}
                type="range"
                min="-150"
                max="150"
                step="0.1"
                value={params.seatLocalY}
                onChange={(e) => updateParam("seatLocalY", parseFloat(e.target.value))}
                className="w-24 accent-toxic disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      {/* Copy JSON Button */}
      <button
        onClick={copyConfigJSON}
        className="mt-4 border border-toxic bg-toxic/10 px-3 py-2 font-bold text-xs text-toxic transition-all hover:bg-toxic hover:text-bg"
      >
        [ 📋 COPY LIVE CONFIG JSON ]
      </button>
    </div>
  );
}
