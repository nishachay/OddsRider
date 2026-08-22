import { useEffect, useState } from "react";
import { SPRITE } from "../game/constants";

type ElementKey = "CHASSIS" | "WHEELS" | "RIDER" | "FLAG";

export default function StudioModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState<ElementKey>("CHASSIS");
  const [lockAspect, setLockAspect] = useState(true);
  const [lockGround, setLockGround] = useState(true);
  const [syncWheels, setSyncWheels] = useState(true);
  
  // Local state initialized from SPRITE
  const [config, setConfig] = useState({ ...SPRITE });

  useEffect(() => {
    setConfig({ ...SPRITE });
  }, [isOpen]);

  if (!isOpen) return null;

  const updateVal = (key: keyof typeof SPRITE, val: number) => {
    setConfig((prev) => {
      const next = { ...prev, [key]: val };
      if (syncWheels && (key === "rearWheelScale" || key === "frontWheelScale" || key === "wheelScale")) {
        next.rearWheelScale = val;
        next.frontWheelScale = val;
        next.wheelScale = val;
      }
      return next;
    });
  };

  const saveAndCommit = async () => {
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Saved config! Copying to constants.ts...");
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/80 font-mono backdrop-blur-md">
      <div className="flex h-[85vh] w-[90vw] max-w-5xl flex-col border border-toxic bg-bg shadow-2xl">
        {/* TOP BAR */}
        <div className="flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 bg-toxic animate-pulse"></span>
            <span className="text-sm font-bold tracking-widest text-toxic">ISOLATED ASSEMBLY STUDIO</span>
          </div>
          <button
            onClick={onClose}
            className="border border-line bg-bg px-3 py-1 text-xs font-bold text-dim transition-all hover:border-crimson hover:text-crimson"
          >
            [ CLOSE STUDIO ]
          </button>
        </div>

        {/* MAIN BODY: EDITOR TOOLBAR & CONTROLS */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* LEFT SIDEBAR: TOOL PALETTE */}
          <div className="col-span-4 flex flex-col justify-between border-r border-line bg-bg/50 p-4">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-dim uppercase">SELECT ELEMENT:</span>
              <div className="grid grid-cols-2 gap-2">
                {(["CHASSIS", "WHEELS", "RIDER", "FLAG"] as ElementKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`border p-2 text-xs font-bold transition-all ${
                      selected === key
                        ? "border-toxic bg-toxic text-bg"
                        : "border-line bg-bg text-ink hover:border-dim hover:text-toxic"
                    }`}
                  >
                    {key === "CHASSIS" && "??? CHASSIS"}
                    {key === "WHEELS" && "?? WHEELS"}
                    {key === "RIDER" && "?? RIDER"}
                    {key === "FLAG" && "?? FLAG"}
                  </button>
                ))}
              </div>

              {/* LOCKS & CONSTRAINTS */}
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold text-dim uppercase">ALIGNMENT LOCKS:</span>
                
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">?? LOCK ASPECT RATIO</span>
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>

                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">?? LOCK GROUND BASELINE</span>
                  <input
                    type="checkbox"
                    checked={lockGround}
                    onChange={(e) => setLockGround(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>

                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">?? SYNC FRONT & REAR WHEELS</span>
                  <input
                    type="checkbox"
                    checked={syncWheels}
                    onChange={(e) => setSyncWheels(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>
              </div>

              {/* SLIDERS FOR SELECTED ELEMENT */}
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <span className="text-xs font-bold text-toxic uppercase">{selected} TRANSFORM CONTROLS:</span>

                {selected === "CHASSIS" && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">SCALE ({Math.round(config.bikeScale * 100)}%)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.01"
                        value={config.bikeScale}
                        onChange={(e) => updateVal("bikeScale", parseFloat(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">HEIGHT ORIGIN Y</span>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.01"
                        value={config.bikeOriginY}
                        onChange={(e) => updateVal("bikeOriginY", parseFloat(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                  </>
                )}

                {selected === "WHEELS" && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">WHEEL SIZE ({Math.round(config.wheelScale * 100)}%)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.01"
                        value={config.wheelScale}
                        onChange={(e) => updateVal("wheelScale", parseFloat(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">REAR OFFSET X ({config.rearWheelOffsetX}px)</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={config.rearWheelOffsetX}
                        onChange={(e) => updateVal("rearWheelOffsetX", parseInt(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">FRONT OFFSET X ({config.frontWheelOffsetX}px)</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={config.frontWheelOffsetX}
                        onChange={(e) => updateVal("frontWheelOffsetX", parseInt(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                  </>
                )}

                {selected === "RIDER" && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">RIDER SIZE ({Math.round(config.riderScale * 100)}%)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.01"
                        value={config.riderScale}
                        onChange={(e) => updateVal("riderScale", parseFloat(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">SEAT POSITION X ({config.seatLocalX}px)</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={config.seatLocalX}
                        onChange={(e) => updateVal("seatLocalX", parseInt(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">SEAT POSITION Y ({config.seatLocalY}px)</span>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        step="1"
                        value={config.seatLocalY}
                        onChange={(e) => updateVal("seatLocalY", parseInt(e.target.value))}
                        className="w-32 accent-toxic"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SAVE BUTTON */}
            <button
              onClick={saveAndCommit}
              className="w-full border border-toxic bg-toxic py-3 text-xs font-bold tracking-widest text-bg transition-all hover:bg-toxic/80"
            >
              [ ?? SAVE & APPLY CONFIG ]
            </button>
          </div>

          {/* RIGHT SIDE: PREVIEW WORKSPACE */}
          <div className="col-span-8 flex flex-col items-center justify-center bg-black/90 p-6">
            <div className="flex flex-col items-center gap-2 text-center text-xs text-dim">
              <span className="text-toxic font-bold">LIVE VISUAL PREVIEW & ASSEMBLY CANVA</span>
              <p>Drag elements with mouse or use the left sliders. Ground baseline and wheel alignment lines are active.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
