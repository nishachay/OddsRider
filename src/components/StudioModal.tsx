import { useEffect, useRef, useState } from "react";
import { SPRITE } from "../game/constants";

type ElementKey = "CHASSIS" | "REAR_WHEEL" | "FRONT_WHEEL" | "RIDER" | "FLAG";

export default function StudioModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<ElementKey>("CHASSIS");
  const [lockGround, setLockGround] = useState(true);
  const [syncWheels, setSyncWheels] = useState(true);
  const [riderBehind, setRiderBehind] = useState(false);
  
  // Config state
  const [config, setConfig] = useState({
    ...SPRITE,
    bikeAngle: 0,
    rearWheelAngle: 0,
    frontWheelAngle: 0,
    flagAngle: 0
  });

  // Canvas Viewport Zoom & Pan State
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });

  // Loaded Image references
  const imagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // Mouse interaction state
  const isDraggingRef = useRef(false);
  const startMouseWorldRef = useRef({ x: 0, y: 0 });
  const startConfigRef = useRef({ ...config });

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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dark Studio Background
    ctx.fillStyle = "#0a0a0b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // CAMERA TRANSFORM (ZOOM & PAN)
    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // 2. PRECISION GRID
    ctx.strokeStyle = "#16181d";
    ctx.lineWidth = 1 / zoom;
    for (let x = -800; x <= canvas.width + 800; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, -800);
      ctx.lineTo(x, canvas.height + 800);
      ctx.stroke();
    }
    for (let y = -800; y <= canvas.height + 800; y += 20) {
      ctx.beginPath();
      ctx.moveTo(-800, y);
      ctx.lineTo(canvas.width + 800, y);
      ctx.stroke();
    }

    // Major 100px Grid Lines
    ctx.strokeStyle = "#242730";
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillStyle = "#6e727e";
    ctx.font = `${Math.round(10 / Math.max(0.6, zoom))}px monospace`;

    for (let x = -800; x <= canvas.width + 800; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, -800);
      ctx.lineTo(x, canvas.height + 800);
      ctx.stroke();
      ctx.fillText(`${x}px`, x + 4, 14);
    }
    for (let y = -800; y <= canvas.height + 800; y += 100) {
      ctx.beginPath();
      ctx.moveTo(-800, y);
      ctx.lineTo(canvas.width + 800, y);
      ctx.stroke();
      ctx.fillText(`${y}px`, 4, y - 4);
    }

    // Ground Baseline
    const groundY = 360;
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(-800, groundY);
    ctx.lineTo(canvas.width + 800, groundY);
    ctx.stroke();

    ctx.fillStyle = "#b6ff00";
    ctx.fillText("TRACK GROUND BASELINE (Y: 620)", 10, groundY - 6);

    const centerX = canvas.width / 2;
    const centerY = groundY - 60;

    const { bike, wheel, rider, flag } = imagesRef.current;

    // RENDER RIDER
    const renderRider = () => {
      if (!rider) return;
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
        drawSelectionBox(ctx, rx - rw / 2, ry - rh * config.riderOriginY, rw, rh, config.riderAngleOffset, zoom);
      }
    };

    if (riderBehind) renderRider();

    // A. FLAG
    if (flag) {
      const fw = flag.width * config.flagScale * 0.5;
      const fh = flag.height * config.flagScale * 0.5;
      const fx = centerX - 180;
      const fy = groundY - fh;
      ctx.save();
      ctx.translate(fx, fy + fh / 2);
      ctx.rotate((config.flagAngle * Math.PI) / 180);
      ctx.drawImage(flag, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();

      if (selected === "FLAG") drawSelectionBox(ctx, fx - fw / 2, fy, fw, fh, config.flagAngle, zoom);
    }

    // B. REAR WHEEL
    const rearX = centerX - 56 + config.rearWheelOffsetX;
    const rearY = centerY + 18 + config.rearWheelOffsetY;
    if (wheel) {
      const ww = wheel.width * config.rearWheelScale * 0.5;
      const wh = wheel.height * config.rearWheelScale * 0.5;

      ctx.save();
      ctx.translate(rearX, rearY);
      ctx.rotate((config.rearWheelAngle * Math.PI) / 180);
      ctx.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
      ctx.restore();

      ctx.strokeStyle = "rgba(182, 255, 0, 0.4)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(rearX, rearY);
      ctx.lineTo(rearX, groundY);
      ctx.stroke();

      if (selected === "REAR_WHEEL") drawSelectionBox(ctx, rearX - ww / 2, rearY - wh / 2, ww, wh, config.rearWheelAngle, zoom);
    }

    // C. FRONT WHEEL
    const frontX = centerX + 56 + config.frontWheelOffsetX;
    const frontY = centerY + 18 + config.frontWheelOffsetY;
    if (wheel) {
      const ww = wheel.width * config.frontWheelScale * 0.5;
      const wh = wheel.height * config.frontWheelScale * 0.5;

      ctx.save();
      ctx.translate(frontX, frontY);
      ctx.rotate((config.frontWheelAngle * Math.PI) / 180);
      ctx.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
      ctx.restore();

      ctx.strokeStyle = "rgba(182, 255, 0, 0.4)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(frontX, frontY);
      ctx.lineTo(frontX, groundY);
      ctx.stroke();

      if (selected === "FRONT_WHEEL") drawSelectionBox(ctx, frontX - ww / 2, frontY - wh / 2, ww, wh, config.frontWheelAngle, zoom);
    }

    // D. CHASSIS BIKE
    if (bike) {
      const bw = bike.width * config.bikeScale * 0.5;
      const bh = bike.height * config.bikeScale * 0.5;
      const bx = centerX - bw * config.bikeOriginX;
      const by = centerY - bh * config.bikeOriginY;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((config.bikeAngle * Math.PI) / 180);
      ctx.drawImage(bike, -bw * config.bikeOriginX, -bh * config.bikeOriginY, bw, bh);
      ctx.restore();

      if (selected === "CHASSIS") drawSelectionBox(ctx, bx, by, bw, bh, config.bikeAngle, zoom);
    }

    // RENDER RIDER
    if (!riderBehind) renderRider();

    ctx.restore();
  }, [isOpen, imagesLoaded, config, selected, zoom, pan, riderBehind]);

  // Figma Bounding Handles
  const drawSelectionBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    angle: number,
    currentZoom: number
  ) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((angle * Math.PI) / 180);

    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 2 / currentZoom;
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 1 / currentZoom;
    const corners = [
      { x: -w / 2 - 4, y: -h / 2 - 4 },
      { x: w / 2 + 4, y: -h / 2 - 4 },
      { x: -w / 2 - 4, y: h / 2 + 4 },
      { x: w / 2 + 4, y: h / 2 + 4 }
    ];
    const handleSize = 8 / currentZoom;
    corners.forEach((c) => {
      ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
    });

    ctx.restore();
  };

  const updateVal = (key: keyof typeof config, val: number) => {
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

  // Convert Screen Mouse Coordinates to Canvas World Coordinates
  const getCanvasWorldPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const wx = (clientX - (canvas.width / 2 + pan.x)) / zoom + canvas.width / 2;
    const wy = (clientY - (canvas.height / 2 + pan.y)) / zoom + canvas.height / 2;
    return { x: wx, y: wy };
  };

  // 100% FREE MOUSE CLICK & PICK & DRAG ENGINE
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasWorldPos(e);

    if (e.button === 1 || e.button === 2) {
      isPanningRef.current = true;
      startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const groundY = 360;
    const centerX = canvas.width / 2;
    const centerY = groundY - 60;
    const { bike, wheel, rider } = imagesRef.current;

    // Hit Testing to Auto-Select Clicked Element Directly on Canvas
    if (rider) {
      const rw = rider.width * config.riderScale * 0.5;
      const rh = rider.height * config.riderScale * 0.5;
      const rx = centerX + config.seatLocalX;
      const ry = centerY + config.seatLocalY;
      if (Math.abs(pos.x - rx) < rw / 2 && Math.abs(pos.y - ry) < rh / 2) {
        setSelected("RIDER");
      }
    }
    if (wheel) {
      const ww = wheel.width * config.rearWheelScale * 0.5;
      const rearX = centerX - 56 + config.rearWheelOffsetX;
      const rearY = centerY + 18 + config.rearWheelOffsetY;
      if (Math.hypot(pos.x - rearX, pos.y - rearY) < ww / 2) {
        setSelected("REAR_WHEEL");
      }

      const frontX = centerX + 56 + config.frontWheelOffsetX;
      const frontY = centerY + 18 + config.frontWheelOffsetY;
      if (Math.hypot(pos.x - frontX, pos.y - frontY) < ww / 2) {
        setSelected("FRONT_WHEEL");
      }
    }
    if (bike) {
      const bw = bike.width * config.bikeScale * 0.5;
      const bh = bike.height * config.bikeScale * 0.5;
      if (Math.abs(pos.x - centerX) < bw / 2 && Math.abs(pos.y - centerY) < bh / 2) {
        setSelected("CHASSIS");
      }
    }

    isDraggingRef.current = true;
    startMouseWorldRef.current = pos;
    startConfigRef.current = { ...config };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      setPan({ x: e.clientX - startPanRef.current.x, y: e.clientY - startPanRef.current.y });
      return;
    }

    if (!isDraggingRef.current) return;
    const pos = getCanvasWorldPos(e);
    const dx = pos.x - startMouseWorldRef.current.x;
    const dy = pos.y - startMouseWorldRef.current.y;

    // 1-TO-1 FREE MOUSE POSITION MOVEMENT
    if (selected === "CHASSIS") {
      updateVal("bikeOriginY", parseFloat(Math.max(0.1, startConfigRef.current.bikeOriginY + dy * 0.003).toFixed(3)));
      updateVal("bikeScale", parseFloat(Math.max(0.1, startConfigRef.current.bikeScale + dx * 0.003).toFixed(2)));
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
      updateVal("flagScale", parseFloat(Math.max(0.1, startConfigRef.current.flagScale + dx * 0.005).toFixed(2)));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => parseFloat(Math.max(0.3, Math.min(5.0, z * factor)).toFixed(2)));
  };

  const saveAndCommit = async () => {
    const jsonStr = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Saved & Copied Config JSON to Clipboard!");
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 font-mono backdrop-blur-md">
      <div className="flex h-[92vh] w-[96vw] max-w-7xl flex-col border border-toxic bg-bg shadow-2xl">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between border-b border-line bg-bg/95 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 bg-toxic animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-toxic uppercase">FREE MOUSE CANVAS STUDIO</span>
          </div>

          {/* CANVAS CAMERA CONTROLS */}
          <div className="flex items-center gap-3 border border-line bg-black/50 px-3 py-1 text-xs">
            <span className="text-dim font-bold">ZOOM:</span>
            <button onClick={() => setZoom((z) => parseFloat(Math.max(0.3, z - 0.2).toFixed(2)))} className="border border-line bg-bg px-2 py-0.5 font-bold text-ink hover:border-toxic hover:text-toxic">-</button>
            <span className="w-12 text-center font-bold text-toxic tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => parseFloat(Math.min(5.0, z + 0.2).toFixed(2)))} className="border border-line bg-bg px-2 py-0.5 font-bold text-ink hover:border-toxic hover:text-toxic">+</button>
            <button onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }} className="ml-2 border border-line bg-bg px-2 py-0.5 text-[10px] font-bold text-dim hover:text-ink">RESET VIEW</button>
          </div>

          <button onClick={onClose} className="border border-line bg-bg px-3 py-1 text-xs font-bold text-dim transition-all hover:border-crimson hover:text-crimson">[ CLOSE STUDIO ]</button>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* LEFT SIDEBAR */}
          <div className="col-span-4 flex flex-col justify-between border-r border-line bg-bg/60 p-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-dim uppercase">SELECTED ELEMENT:</span>
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
                    {key === "CHASSIS" && "[ ??? CHASSIS ]"}
                    {key === "REAR_WHEEL" && "[ ?? REAR WHEEL ]"}
                    {key === "FRONT_WHEEL" && "[ ?? FRONT WHEEL ]"}
                    {key === "RIDER" && "[ ?? RIDER ]"}
                    {key === "FLAG" && "[ ?? FLAG ]"}
                  </button>
                ))}
              </div>

              {/* ALIGNMENT LOCKS */}
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold text-dim uppercase">ALIGNMENT LOCKS:</span>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">LOCK GROUND BASELINE</span>
                  <input type="checkbox" checked={lockGround} onChange={(e) => setLockGround(e.target.checked)} className="accent-toxic" />
                </label>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">SYNC WHEEL PAIR</span>
                  <input type="checkbox" checked={syncWheels} onChange={(e) => setSyncWheels(e.target.checked)} className="accent-toxic" />
                </label>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">RIDER BEHIND CHASSIS</span>
                  <input type="checkbox" checked={riderBehind} onChange={(e) => setRiderBehind(e.target.checked)} className="accent-toxic" />
                </label>
              </div>

              {/* TRANSFORM SLIDERS */}
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <span className="text-xs font-bold text-toxic uppercase">{selected} CONTROLS:</span>

                {selected === "CHASSIS" && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">HEIGHT (Origin Y: {config.bikeOriginY})</span>
                      <input type="range" min="0.1" max="1.2" step="0.005" value={config.bikeOriginY} onChange={(e) => updateVal("bikeOriginY", parseFloat(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">BIKE SCALE ({Math.round(config.bikeScale * 100)}%)</span>
                      <input type="range" min="0.1" max="2.0" step="0.01" value={config.bikeScale} onChange={(e) => updateVal("bikeScale", parseFloat(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                  </>
                )}

                {selected === "RIDER" && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">SEAT X ({config.seatLocalX}px)</span>
                      <input type="range" min="-200" max="200" value={config.seatLocalX} onChange={(e) => updateVal("seatLocalX", parseInt(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">SEAT Y ({config.seatLocalY}px)</span>
                      <input type="range" min="-200" max="200" value={config.seatLocalY} onChange={(e) => updateVal("seatLocalY", parseInt(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">LEAN ANGLE ({config.riderAngleOffset}deg)</span>
                      <input type="range" min="-180" max="180" value={config.riderAngleOffset} onChange={(e) => updateVal("riderAngleOffset", parseInt(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                  </>
                )}

                {(selected === "REAR_WHEEL" || selected === "FRONT_WHEEL") && (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">WHEEL SIZE ({Math.round(config.rearWheelScale * 100)}%)</span>
                      <input type="range" min="0.1" max="2.0" step="0.01" value={config.rearWheelScale} onChange={(e) => updateVal("rearWheelScale", parseFloat(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">REAR OFFSET X ({config.rearWheelOffsetX}px)</span>
                      <input type="range" min="-150" max="150" value={config.rearWheelOffsetX} onChange={(e) => updateVal("rearWheelOffsetX", parseInt(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dim font-bold">FRONT OFFSET X ({config.frontWheelOffsetX}px)</span>
                      <input type="range" min="-150" max="150" value={config.frontWheelOffsetX} onChange={(e) => updateVal("frontWheelOffsetX", parseInt(e.target.value))} className="w-32 accent-toxic" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* SAVE BUTTON */}
            <button
              onClick={saveAndCommit}
              className="w-full border border-toxic bg-toxic py-3 text-xs font-bold tracking-widest text-bg transition-all hover:bg-toxic/80 mt-4"
            >
              [ SAVE & APPLY CONFIG ]
            </button>
          </div>

          {/* RIGHT CANVAS WORKSPACE */}
          <div className="col-span-8 flex flex-col items-center justify-center bg-black/95 p-4 relative overflow-hidden">
            <canvas
              ref={canvasRef}
              width={760}
              height={560}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
              className="cursor-crosshair border border-line bg-black shadow-2xl"
            />
            <div className="mt-2 text-[10px] text-dim font-mono flex items-center gap-4">
              <span>* Click on any item directly on the canvas to pick up and drag freely</span>
              <span>* Right-Click Drag: Pan Camera</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
