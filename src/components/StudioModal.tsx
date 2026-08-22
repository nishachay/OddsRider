import { useEffect, useRef, useState } from "react";
import { SPRITE } from "../game/constants";

type ElementKey = "CHASSIS" | "REAR_WHEEL" | "FRONT_WHEEL" | "RIDER" | "FLAG";

export default function StudioModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<ElementKey>("CHASSIS");
  const [lockAspect, setLockAspect] = useState(true);
  const [lockGround, setLockGround] = useState(true);
  const [syncWheels, setSyncWheels] = useState(true);
  const [config, setConfig] = useState({ ...SPRITE });
  
  // Loaded Image references
  const imagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<"MOVE" | "RESIZE" | "ROTATE" | null>(null);
  const startMouseRef = useRef({ x: 0, y: 0 });
  const startConfigRef = useRef({ ...SPRITE });

  // Preload game images
  useEffect(() => {
    if (!isOpen) return;
    const assets = {
      bike: "/assets/game/bike.png",
      wheel: "/assets/game/wheel.png",
      rider: "/assets/game/rider.png",
      flag: "/assets/game/flag.png"
    };

    let loadedCount = 0;
    const total = Object.keys(assets).length;
    const loadedImages: { [key: string]: HTMLImageElement } = {};

    Object.entries(assets).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedImages[key] = img;
        loadedCount++;
        if (loadedCount === total) {
          imagesRef.current = loadedImages;
          setImagesLoaded(true);
        }
      };
    });
  }, [isOpen]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    if (!isOpen || !imagesLoaded || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dark Studio Background
    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Alignment Grid (20px)
    ctx.strokeStyle = "#1b1d22";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Ground Baseline
    const groundY = 360;
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    ctx.fillStyle = "#6e727e";
    ctx.font = "10px monospace";
    ctx.fillText("TRACK BASELINE (Y: 620)", 10, groundY - 6);

    // Assembly Center Reference (Spawn X=320, Y=300)
    const centerX = canvas.width / 2;
    const centerY = groundY - 60;

    // Assets
    const { bike, wheel, rider, flag } = imagesRef.current;

    // A. FLAG
    if (flag) {
      const fw = flag.width * config.flagScale * 0.5;
      const fh = flag.height * config.flagScale * 0.5;
      const fx = centerX - 180;
      const fy = groundY - fh;
      ctx.drawImage(flag, fx - fw / 2, fy, fw, fh);
      if (selected === "FLAG") drawSelectionBox(ctx, fx - fw / 2, fy, fw, fh);
    }

    // B. REAR WHEEL
    const rearX = centerX - 56 + config.rearWheelOffsetX;
    const rearY = centerY + 18 + config.rearWheelOffsetY;
    if (wheel) {
      const ww = wheel.width * config.rearWheelScale * 0.5;
      const wh = wheel.height * config.rearWheelScale * 0.5;
      ctx.drawImage(wheel, rearX - ww / 2, rearY - wh / 2, ww, wh);
      if (selected === "REAR_WHEEL") drawSelectionBox(ctx, rearX - ww / 2, rearY - wh / 2, ww, wh);
    }

    // C. FRONT WHEEL
    const frontX = centerX + 56 + config.frontWheelOffsetX;
    const frontY = centerY + 18 + config.frontWheelOffsetY;
    if (wheel) {
      const ww = wheel.width * config.frontWheelScale * 0.5;
      const wh = wheel.height * config.frontWheelScale * 0.5;
      ctx.drawImage(wheel, frontX - ww / 2, frontY - wh / 2, ww, wh);
      if (selected === "FRONT_WHEEL") drawSelectionBox(ctx, frontX - ww / 2, frontY - wh / 2, ww, wh);
    }

    // D. CHASSIS BIKE
    if (bike) {
      const bw = bike.width * config.bikeScale * 0.5;
      const bh = bike.height * config.bikeScale * 0.5;
      const bx = centerX - bw * config.bikeOriginX;
      const by = centerY - bh * config.bikeOriginY;
      ctx.drawImage(bike, bx, by, bw, bh);
      if (selected === "CHASSIS") drawSelectionBox(ctx, bx, by, bw, bh);
    }

    // E. RIDER
    if (rider) {
      const rw = rider.width * config.riderScale * 0.5;
      const rh = rider.height * config.riderScale * 0.5;
      const rx = centerX + config.seatLocalX;
      const ry = centerY + config.seatLocalY;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate((config.riderAngleOffset * Math.PI) / 180);
      ctx.drawImage(rider, -rw / 2, -rh * config.riderOriginY, rw, rh);
      ctx.restore();

      if (selected === "RIDER") {
        drawSelectionBox(ctx, rx - rw / 2, ry - rh * config.riderOriginY, rw, rh, true);
      }
    }
  }, [isOpen, imagesLoaded, config, selected]);

  // Draw Figma-style Bounding Handles
  const drawSelectionBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    hasRotate = false
  ) => {
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);

    // Corner Handles
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 1;
    const corners = [
      { x: x - 4, y: y - 4 },
      { x: x + w + 4, y: y - 4 },
      { x: x - 4, y: y + h + 4 },
      { x: x + w + 4, y: y + h + 4 }
    ];
    corners.forEach((c) => {
      ctx.fillRect(c.x - 4, c.y - 4, 8, 8);
      ctx.strokeRect(c.x - 4, c.y - 4, 8, 8);
    });

    // Top Rotation Handle Dot
    if (hasRotate) {
      const cx = x + w / 2;
      const ry = y - 24;
      ctx.beginPath();
      ctx.moveTo(cx, y - 4);
      ctx.lineTo(cx, ry);
      ctx.stroke();

      ctx.fillStyle = "#b6ff00";
      ctx.beginPath();
      ctx.arc(cx, ry, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  };

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

  // Mouse Drag & Transform Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    isDraggingRef.current = true;
    startMouseRef.current = { x: mx, y: my };
    startConfigRef.current = { ...config };
    dragModeRef.current = "MOVE";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - startMouseRef.current.x;
    const dy = my - startMouseRef.current.y;

    if (selected === "CHASSIS") {
      updateVal("bikeScale", parseFloat(Math.max(0.2, startConfigRef.current.bikeScale + dx * 0.005).toFixed(2)));
    } else if (selected === "REAR_WHEEL") {
      updateVal("rearWheelOffsetX", Math.round(startConfigRef.current.rearWheelOffsetX + dx));
      updateVal("rearWheelOffsetY", Math.round(startConfigRef.current.rearWheelOffsetY + dy));
    } else if (selected === "FRONT_WHEEL") {
      updateVal("frontWheelOffsetX", Math.round(startConfigRef.current.frontWheelOffsetX + dx));
      updateVal("frontWheelOffsetY", Math.round(startConfigRef.current.frontWheelOffsetY + dy));
    } else if (selected === "RIDER") {
      updateVal("seatLocalX", Math.round(startConfigRef.current.seatLocalX + dx));
      updateVal("seatLocalY", Math.round(startConfigRef.current.seatLocalY + dy));
    } else if (selected === "FLAG") {
      updateVal("flagScale", parseFloat(Math.max(0.2, startConfigRef.current.flagScale + dx * 0.005).toFixed(2)));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    dragModeRef.current = null;
  };

  const saveAndCommit = async () => {
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Saved & Copied Config JSON to Clipboard!");
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 font-mono backdrop-blur-md">
      <div className="flex h-[90vh] w-[95vw] max-w-6xl flex-col border border-toxic bg-bg shadow-2xl">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between border-b border-line bg-bg/95 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 bg-toxic animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-toxic uppercase">FIGMA VISUAL CANVAS STUDIO</span>
          </div>
          <button
            onClick={onClose}
            className="border border-line bg-bg px-3 py-1 text-xs font-bold text-dim transition-all hover:border-crimson hover:text-crimson"
          >
            [ CLOSE STUDIO ]
          </button>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* LEFT SIDEBAR: SELECTOR & CONTROLS */}
          <div className="col-span-4 flex flex-col justify-between border-r border-line bg-bg/60 p-4">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-dim uppercase">SELECT CANVAS ELEMENT:</span>
              <div className="grid grid-cols-2 gap-2">
                {(["CHASSIS", "REAR_WHEEL", "FRONT_WHEEL", "RIDER", "FLAG"] as ElementKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`border p-2 text-xs font-bold transition-all ${
                      selected === key
                        ? "border-toxic bg-toxic text-bg"
                        : "border-line bg-bg text-ink hover:border-dim hover:text-toxic"
                    }`}
                  >
                    {key === "CHASSIS" && "[ CHASSIS ]"}
                    {key === "REAR_WHEEL" && "[ REAR WHEEL ]"}
                    {key === "FRONT_WHEEL" && "[ FRONT WHEEL ]"}
                    {key === "RIDER" && "[ RIDER ]"}
                    {key === "FLAG" && "[ FLAG ]"}
                  </button>
                ))}
              </div>

              {/* ALIGNMENT LOCK TOGGLES */}
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold text-dim uppercase">ALIGNMENT LOCKS:</span>
                
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">LOCK ASPECT RATIO</span>
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>

                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">LOCK GROUND BASELINE</span>
                  <input
                    type="checkbox"
                    checked={lockGround}
                    onChange={(e) => setLockGround(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>

                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">SYNC FRONT & REAR WHEELS</span>
                  <input
                    type="checkbox"
                    checked={syncWheels}
                    onChange={(e) => setSyncWheels(e.target.checked)}
                    className="accent-toxic"
                  />
                </label>
              </div>

              {/* TRANSFORM CONTROLS */}
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <span className="text-xs font-bold text-toxic uppercase">{selected} TRANSFORM SLIDERS:</span>

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
                  </>
                )}

                {(selected === "REAR_WHEEL" || selected === "FRONT_WHEEL") && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">WHEEL SIZE ({Math.round(config.rearWheelScale * 100)}%)</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.01"
                        value={config.rearWheelScale}
                        onChange={(e) => updateVal("rearWheelScale", parseFloat(e.target.value))}
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
                      <span className="text-dim font-bold">LEAN ANGLE ({config.riderAngleOffset}deg)</span>
                      <input
                        type="range"
                        min="-45"
                        max="45"
                        step="1"
                        value={config.riderAngleOffset}
                        onChange={(e) => updateVal("riderAngleOffset", parseInt(e.target.value))}
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
              [ SAVE & APPLY CONFIG ]
            </button>
          </div>

          {/* RIGHT SIDEBAR: REAL VISUAL CANVAS WORKSPACE */}
          <div className="col-span-8 flex flex-col items-center justify-center bg-black/95 p-4 relative">
            <canvas
              ref={canvasRef}
              width={680}
              height={500}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="cursor-crosshair border border-line bg-black shadow-2xl"
            />
            <div className="mt-2 text-[10px] text-dim font-mono">
              * Click and drag elements inside the canvas to position them visually. Neon green bounding boxes mark the selected element.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
