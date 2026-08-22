import { useEffect, useRef, useState } from "react";
import { SPRITE } from "../game/constants";

type ElementKey = "CHASSIS" | "REAR_WHEEL" | "FRONT_WHEEL" | "RIDER" | "FLAG";

export default function StudioModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<ElementKey>("REAR_WHEEL");
  const [isGrouped, setIsGrouped] = useState(false); // Independent mode by default!
  const [syncWheels, setSyncWheels] = useState(true);
  const [riderBehind, setRiderBehind] = useState(false);
  
  // Independent World Coordinates for every single component
  const [config, setConfig] = useState({
    ...SPRITE,
    // Independent Positions in Canvas World Space
    chassisX: 0,
    chassisY: 0,
    rearWheelX: -56,
    rearWheelY: 18,
    frontWheelX: 56,
    frontWheelY: 18,
    riderX: -5,
    riderY: -18,
    flagX: -180,
    flagY: 0,
    // Angles
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

  // Asset Lock State (Freezes asset from accidental edits)
  const [lockedMap, setLockedMap] = useState<{ [key in ElementKey]: boolean }>({
    CHASSIS: false,
    REAR_WHEEL: false,
    FRONT_WHEEL: false,
    RIDER: false,
    FLAG: false
  });

  // Nudge Function with Micro-Pixel Floating-Point Precision
  const nudge = (dx: number, dy: number, dAngle = 0) => {
    if (lockedMap[selected]) return; // Blocked if asset is locked!

    setConfig((prev) => {
      const fix = (v: number) => parseFloat(v.toFixed(1));
      if (selected === "CHASSIS") {
        return { ...prev, chassisX: fix(prev.chassisX + dx), chassisY: fix(prev.chassisY + dy), bikeAngle: fix(prev.bikeAngle + dAngle) };
      } else if (selected === "REAR_WHEEL") {
        return { ...prev, rearWheelX: fix(prev.rearWheelX + dx), rearWheelY: fix(prev.rearWheelY + dy), rearWheelAngle: fix(prev.rearWheelAngle + dAngle) };
      } else if (selected === "FRONT_WHEEL") {
        return { ...prev, frontWheelX: fix(prev.frontWheelX + dx), frontWheelY: fix(prev.frontWheelY + dy), frontWheelAngle: fix(prev.frontWheelAngle + dAngle) };
      } else if (selected === "RIDER") {
        return { ...prev, riderX: fix(prev.riderX + dx), riderY: fix(prev.riderY + dy), riderAngleOffset: fix(prev.riderAngleOffset + dAngle) };
      } else if (selected === "FLAG") {
        return { ...prev, flagX: fix(prev.flagX + dx), flagY: fix(prev.flagY + dy), flagAngle: fix(prev.flagAngle + dAngle) };
      }
      return prev;
    });
  };

  // KEYBOARD ARROW KEYS 1PX & SHIFT+ARROW 0.1PX MICRO-PIXEL NUDGE LISTENER
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;

      // Shift + Arrow = 0.1px Micro-Pixel Sub-pixel precision!
      // Plain Arrow = 1.0px Precision step!
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
  }, [isOpen, selected, config, lockedMap]);

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
    for (let x = -1000; x <= canvas.width + 1000; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, -1000);
      ctx.lineTo(x, canvas.height + 1000);
      ctx.stroke();
    }
    for (let y = -1000; y <= canvas.height + 1000; y += 20) {
      ctx.beginPath();
      ctx.moveTo(-1000, y);
      ctx.lineTo(canvas.width + 1000, y);
      ctx.stroke();
    }

    // Major 100px Grid Lines
    ctx.strokeStyle = "#242730";
    ctx.lineWidth = 1.5 / zoom;
    ctx.fillStyle = "#6e727e";
    ctx.font = `${Math.round(10 / Math.max(0.6, zoom))}px monospace`;

    for (let x = -1000; x <= canvas.width + 1000; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, -1000);
      ctx.lineTo(x, canvas.height + 1000);
      ctx.stroke();
      ctx.fillText(`${x}px`, x + 4, 14);
    }
    for (let y = -1000; y <= canvas.height + 1000; y += 100) {
      ctx.beginPath();
      ctx.moveTo(-1000, y);
      ctx.lineTo(canvas.width + 1000, y);
      ctx.stroke();
      ctx.fillText(`${y}px`, 4, y - 4);
    }

    // Ground Baseline
    const groundY = 360;
    ctx.strokeStyle = "#b6ff00";
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(-1000, groundY);
    ctx.lineTo(canvas.width + 1000, groundY);
    ctx.stroke();

    ctx.fillStyle = "#b6ff00";
    ctx.fillText("TRACK GROUND BASELINE (Y: 620)", 10, groundY - 6);

    const centerX = canvas.width / 2;
    const centerY = groundY - 60;

    const { bike, wheel, rider, flag } = imagesRef.current;

    // RENDER RIDER
    const renderRider = () => {
      if (!rider) return;
      const rw = rider.width * config.riderScale;
      const rh = rider.height * config.riderScale;
      const rx = centerX + config.riderX;
      const ry = centerY + config.riderY;

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
      const fw = flag.width * config.flagScale;
      const fh = flag.height * config.flagScale;
      const fx = centerX + config.flagX;
      const fy = groundY - fh + config.flagY;
      ctx.save();
      ctx.translate(fx, fy + fh / 2);
      ctx.rotate((config.flagAngle * Math.PI) / 180);
      ctx.drawImage(flag, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();

      if (selected === "FLAG") drawSelectionBox(ctx, fx - fw / 2, fy, fw, fh, config.flagAngle, zoom);
    }

    // B. REAR WHEEL
    const rearX = centerX + config.rearWheelX;
    const rearY = centerY + config.rearWheelY;
    if (wheel) {
      const ww = wheel.width * config.rearWheelScale;
      const wh = wheel.height * config.rearWheelScale;

      ctx.save();
      ctx.translate(rearX, rearY);
      ctx.rotate((config.rearWheelAngle * Math.PI) / 180);
      ctx.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
      ctx.restore();

      // Axle Guide Line to Ground
      ctx.strokeStyle = "rgba(182, 255, 0, 0.4)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(rearX, rearY);
      ctx.lineTo(rearX, groundY);
      ctx.stroke();

      if (selected === "REAR_WHEEL") drawSelectionBox(ctx, rearX - ww / 2, rearY - wh / 2, ww, wh, config.rearWheelAngle, zoom);
    }

    // C. FRONT WHEEL
    const frontX = centerX + config.frontWheelX;
    const frontY = centerY + config.frontWheelY;
    if (wheel) {
      const ww = wheel.width * config.frontWheelScale;
      const wh = wheel.height * config.frontWheelScale;

      ctx.save();
      ctx.translate(frontX, frontY);
      ctx.rotate((config.frontWheelAngle * Math.PI) / 180);
      ctx.drawImage(wheel, -ww / 2, -wh / 2, ww, wh);
      ctx.restore();

      // Axle Guide Line to Ground
      ctx.strokeStyle = "rgba(182, 255, 0, 0.4)";
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      ctx.moveTo(frontX, frontY);
      ctx.lineTo(frontX, groundY);
      ctx.stroke();

      if (selected === "FRONT_WHEEL") drawSelectionBox(ctx, frontX - ww / 2, frontY - wh / 2, ww, wh, config.frontWheelAngle, zoom);
    }

    // D. CHASSIS BIKE (INDEPENDENT WORLD POSITION)
    const chassisWorldX = centerX + config.chassisX;
    const chassisWorldY = centerY + config.chassisY;
    if (bike) {
      const bw = bike.width * config.bikeScale;
      const bh = bike.height * config.bikeScale;
      const bx = chassisWorldX - bw * config.bikeOriginX;
      const by = chassisWorldY - bh * config.bikeOriginY;

      ctx.save();
      ctx.translate(chassisWorldX, chassisWorldY);
      ctx.rotate((config.bikeAngle * Math.PI) / 180);
      ctx.drawImage(bike, -bw * config.bikeOriginX, -bh * config.bikeOriginY, bw, bh);
      ctx.restore();

      if (selected === "CHASSIS") drawSelectionBox(ctx, bx, by, bw, bh, config.bikeAngle, zoom);
    }

    // RENDER RIDER (IN FRONT BY DEFAULT)
    if (!riderBehind) renderRider();

    ctx.restore();
  }, [isOpen, imagesLoaded, config, selected, zoom, pan, riderBehind]);

  // Figma Bounding Handles (Red when Locked, Neon Green when Unlocked)
  const drawSelectionBox = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    angle: number,
    currentZoom: number,
    isLocked?: boolean
  ) => {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((angle * Math.PI) / 180);

    const strokeColor = isLocked ? "#ff3355" : "#b6ff00";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2 / currentZoom;
    ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = strokeColor;
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
    if (lockedMap[selected]) return; // Blocked if asset is locked!

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

  const toggleLock = (key: ElementKey) => {
    setLockedMap((prev) => ({ ...prev, [key]: !prev[key] }));
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

  // 100% INDEPENDENT PIXEL MOUSE DRAG ENGINE
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

    let newlySelected: ElementKey = selected;

    // Hit Testing each independent object directly
    if (rider) {
      const rw = Math.max(40, rider.width * config.riderScale);
      const rh = Math.max(40, rider.height * config.riderScale);
      const rx = centerX + config.riderX;
      const ry = centerY + config.riderY;
      if (Math.abs(pos.x - rx) < rw && Math.abs(pos.y - ry) < rh) {
        newlySelected = "RIDER";
      }
    }
    if (wheel) {
      const ww = Math.max(40, wheel.width * config.rearWheelScale);
      const rearX = centerX + config.rearWheelX;
      const rearY = centerY + config.rearWheelY;
      if (Math.hypot(pos.x - rearX, pos.y - rearY) < ww) {
        newlySelected = "REAR_WHEEL";
      }

      const frontX = centerX + config.frontWheelX;
      const frontY = centerY + config.frontWheelY;
      if (Math.hypot(pos.x - frontX, pos.y - frontY) < ww) {
        newlySelected = "FRONT_WHEEL";
      }
    }
    if (bike) {
      const bw = Math.max(50, bike.width * config.bikeScale);
      const bh = Math.max(50, bike.height * config.bikeScale);
      const bx = centerX + config.chassisX;
      const by = centerY + config.chassisY;
      if (Math.abs(pos.x - bx) < bw && Math.abs(pos.y - by) < bh) {
        newlySelected = "CHASSIS";
      }
    }

    setSelected(newlySelected);

    if (!lockedMap[newlySelected]) {
      isDraggingRef.current = true;
      startMouseWorldRef.current = pos;
      startConfigRef.current = { ...config };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanningRef.current) {
      setPan({ x: e.clientX - startPanRef.current.x, y: e.clientY - startPanRef.current.y });
      return;
    }

    if (!isDraggingRef.current || lockedMap[selected]) return;
    const pos = getCanvasWorldPos(e);
    const dx = pos.x - startMouseWorldRef.current.x;
    const dy = pos.y - startMouseWorldRef.current.y;

    // SMOOTH SUBPIXEL MOVEMENT ENGINE (0.1px Micro Precision)
    const fix = (v: number) => parseFloat(v.toFixed(1));

    if (selected === "CHASSIS") {
      updateVal("chassisX", fix(startConfigRef.current.chassisX + dx));
      updateVal("chassisY", fix(startConfigRef.current.chassisY + dy));
      if (isGrouped) {
        updateVal("rearWheelX", fix(startConfigRef.current.rearWheelX + dx));
        updateVal("rearWheelY", fix(startConfigRef.current.rearWheelY + dy));
        updateVal("frontWheelX", fix(startConfigRef.current.frontWheelX + dx));
        updateVal("frontWheelY", fix(startConfigRef.current.frontWheelY + dy));
        updateVal("riderX", fix(startConfigRef.current.riderX + dx));
        updateVal("riderY", fix(startConfigRef.current.riderY + dy));
      }
    } else if (selected === "REAR_WHEEL") {
      updateVal("rearWheelX", fix(startConfigRef.current.rearWheelX + dx));
      updateVal("rearWheelY", fix(startConfigRef.current.rearWheelY + dy));
    } else if (selected === "FRONT_WHEEL") {
      updateVal("frontWheelX", fix(startConfigRef.current.frontWheelX + dx));
      updateVal("frontWheelY", fix(startConfigRef.current.frontWheelY + dy));
    } else if (selected === "RIDER") {
      updateVal("riderX", fix(startConfigRef.current.riderX + dx));
      updateVal("riderY", fix(startConfigRef.current.riderY + dy));
    } else if (selected === "FLAG") {
      updateVal("flagX", fix(startConfigRef.current.flagX + dx));
      updateVal("flagY", fix(startConfigRef.current.flagY + dy));
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => parseFloat(Math.max(0.2, Math.min(6.0, z * factor)).toFixed(2)));
  };

  const saveAndCommit = async () => {
    // Convert Independent World Positions back to relative constants offsets
    const exportConfig = {
      bikeScale: config.bikeScale,
      bikeOriginX: 0.5,
      bikeOriginY: 0.76,
      wheelScale: config.rearWheelScale,
      rearWheelScale: config.rearWheelScale,
      frontWheelScale: config.frontWheelScale,
      rearWheelOffsetX: parseFloat((config.rearWheelX - config.chassisX).toFixed(1)),
      rearWheelOffsetY: parseFloat((config.rearWheelY - config.chassisY).toFixed(1)),
      frontWheelOffsetX: parseFloat((config.frontWheelX - config.chassisX).toFixed(1)),
      frontWheelOffsetY: parseFloat((config.frontWheelY - config.chassisY).toFixed(1)),
      riderScale: config.riderScale,
      ragdollScale: config.ragdollScale,
      riderOriginY: config.riderOriginY,
      riderAngleOffset: config.riderAngleOffset,
      seatLocalX: config.riderX - config.chassisX,
      seatLocalY: config.riderY - config.chassisY,
      flagScale: config.flagScale
    };

    const jsonStr = JSON.stringify(exportConfig, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert("Saved & Calculated Relative Offsets JSON to Clipboard!");
  };

  if (!isOpen) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/85 font-mono backdrop-blur-md">
      <div className="flex h-[92vh] w-[96vw] max-w-7xl flex-col border border-toxic bg-bg shadow-2xl">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between border-b border-line bg-bg/95 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 bg-toxic animate-pulse"></span>
            <span className="text-xs font-bold tracking-widest text-toxic uppercase">100% INDEPENDENT PIECE STUDIO</span>
          </div>

          {/* CAMERA CONTROLS */}
          <div className="flex items-center gap-3 border border-line bg-black/50 px-3 py-1 text-xs">
            <span className="text-dim font-bold">ZOOM:</span>
            <button onClick={() => setZoom((z) => parseFloat(Math.max(0.2, z - 0.2).toFixed(2)))} className="border border-line bg-bg px-2 py-0.5 font-bold text-ink hover:border-toxic hover:text-toxic">-</button>
            <span className="w-12 text-center font-bold text-toxic tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => parseFloat(Math.min(6.0, z + 0.2).toFixed(2)))} className="border border-line bg-bg px-2 py-0.5 font-bold text-ink hover:border-toxic hover:text-toxic">+</button>
            <button onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }} className="ml-2 border border-line bg-bg px-2 py-0.5 text-[10px] font-bold text-dim hover:text-ink">RESET VIEW</button>
          </div>

          <button onClick={onClose} className="border border-line bg-bg px-3 py-1 text-xs font-bold text-dim transition-all hover:border-crimson hover:text-crimson">[ CLOSE STUDIO ]</button>
        </div>

        {/* WORKSPACE CONTENT */}
        <div className="grid flex-1 grid-cols-12 overflow-hidden">
          {/* LEFT SIDEBAR */}
          <div className="col-span-4 flex flex-col justify-between border-r border-line bg-bg/60 p-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold text-dim uppercase">SELECT & LOCK ELEMENT:</span>
              <div className="grid grid-cols-2 gap-2">
                {(["CHASSIS", "REAR_WHEEL", "FRONT_WHEEL", "RIDER", "FLAG"] as ElementKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`border p-2 text-xs font-bold transition-all flex items-center justify-between ${
                      selected === key
                        ? "border-toxic bg-toxic text-bg"
                        : "border-line bg-bg text-ink hover:border-dim hover:text-toxic"
                    }`}
                  >
                    <span>
                      {key === "CHASSIS" && "[ 🏍️ CHASSIS ]"}
                      {key === "REAR_WHEEL" && "[ 🛞 REAR ]"}
                      {key === "FRONT_WHEEL" && "[ 🛞 FRONT ]"}
                      {key === "RIDER" && "[ 👤 RIDER ]"}
                      {key === "FLAG" && "[ 🚩 FLAG ]"}
                    </span>
                    {lockedMap[key] && <span className="text-crimson font-bold">🔒</span>}
                  </button>
                ))}
              </div>

              {/* ASSET LOCK TOGGLE CARD */}
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold text-dim uppercase">SELECTED ASSET LOCK:</span>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className={`font-bold ${lockedMap[selected] ? "text-crimson" : "text-toxic"}`}>
                    {lockedMap[selected] ? "🔒 ASSET LOCKED (FROZEN)" : "🔓 ASSET UNLOCKED (EDITABLE)"}
                  </span>
                  <input
                    type="checkbox"
                    checked={lockedMap[selected]}
                    onChange={() => toggleLock(selected)}
                    className="accent-crimson"
                  />
                </label>
              </div>

              {/* ASSEMBLY MODE & TOGGLES */}
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <span className="text-xs font-bold text-dim uppercase">ASSEMBLY MODE & CONTROLS:</span>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-toxic font-bold">{isGrouped ? "🔒 GROUPED (MOVE TOGETHER)" : "🔓 INDEPENDENT (MOVE PIECES SEPARATELY)"}</span>
                  <input type="checkbox" checked={isGrouped} onChange={(e) => setIsGrouped(e.target.checked)} className="accent-toxic" />
                </label>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">SYNC WHEEL SIZES</span>
                  <input type="checkbox" checked={syncWheels} onChange={(e) => setSyncWheels(e.target.checked)} className="accent-toxic" />
                </label>
                <label className="flex items-center justify-between border border-line bg-bg p-2 cursor-pointer text-xs">
                  <span className="text-ink font-bold">RIDER BEHIND CHASSIS</span>
                  <input type="checkbox" checked={riderBehind} onChange={(e) => setRiderBehind(e.target.checked)} className="accent-toxic" />
                </label>
              </div>

              {/* TRANSFORM SLIDERS & NUMERIC INPUTS WITH ROTATION */}
              <div className="flex flex-col gap-3 border-t border-line pt-3">
                <span className="text-xs font-bold text-toxic uppercase">{selected} CONTROLS & ROTATION:</span>

                {selected === "CHASSIS" && (
                  <>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">BIKE X:</span>
                      <input disabled={lockedMap.CHASSIS} type="number" step="0.1" value={config.chassisX} onChange={(e) => updateVal("chassisX", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.CHASSIS} type="range" min="-400" max="400" step="0.1" value={config.chassisX} onChange={(e) => updateVal("chassisX", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">BIKE Y:</span>
                      <input disabled={lockedMap.CHASSIS} type="number" step="0.1" value={config.chassisY} onChange={(e) => updateVal("chassisY", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.CHASSIS} type="range" min="-400" max="400" step="0.1" value={config.chassisY} onChange={(e) => updateVal("chassisY", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">ANGLE:</span>
                      <input disabled={lockedMap.CHASSIS} type="number" step="0.5" value={config.bikeAngle} onChange={(e) => updateVal("bikeAngle", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.CHASSIS} type="range" min="-180" max="180" step="0.5" value={config.bikeAngle} onChange={(e) => updateVal("bikeAngle", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">SCALE:</span>
                      <input disabled={lockedMap.CHASSIS} type="number" step="0.01" value={config.bikeScale} onChange={(e) => updateVal("bikeScale", parseFloat(e.target.value) || 0.1)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.CHASSIS} type="range" min="0.05" max="2.5" step="0.01" value={config.bikeScale} onChange={(e) => updateVal("bikeScale", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                  </>
                )}

                {selected === "REAR_WHEEL" && (
                  <>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">REAR X:</span>
                      <input disabled={lockedMap.REAR_WHEEL} type="number" step="0.1" value={config.rearWheelX} onChange={(e) => updateVal("rearWheelX", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.REAR_WHEEL} type="range" min="-400" max="400" step="0.1" value={config.rearWheelX} onChange={(e) => updateVal("rearWheelX", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">REAR Y:</span>
                      <input disabled={lockedMap.REAR_WHEEL} type="number" step="0.1" value={config.rearWheelY} onChange={(e) => updateVal("rearWheelY", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.REAR_WHEEL} type="range" min="-400" max="400" step="0.1" value={config.rearWheelY} onChange={(e) => updateVal("rearWheelY", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">ANGLE:</span>
                      <input disabled={lockedMap.REAR_WHEEL} type="number" step="0.5" value={config.rearWheelAngle} onChange={(e) => updateVal("rearWheelAngle", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.REAR_WHEEL} type="range" min="-180" max="180" step="0.5" value={config.rearWheelAngle} onChange={(e) => updateVal("rearWheelAngle", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">SCALE:</span>
                      <input disabled={lockedMap.REAR_WHEEL} type="number" step="0.01" value={config.rearWheelScale} onChange={(e) => updateVal("rearWheelScale", parseFloat(e.target.value) || 0.1)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.REAR_WHEEL} type="range" min="0.05" max="2.5" step="0.01" value={config.rearWheelScale} onChange={(e) => updateVal("rearWheelScale", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                  </>
                )}

                {selected === "FRONT_WHEEL" && (
                  <>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">FRONT X:</span>
                      <input disabled={lockedMap.FRONT_WHEEL} type="number" step="0.1" value={config.frontWheelX} onChange={(e) => updateVal("frontWheelX", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.FRONT_WHEEL} type="range" min="-400" max="400" step="0.1" value={config.frontWheelX} onChange={(e) => updateVal("frontWheelX", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">FRONT Y:</span>
                      <input disabled={lockedMap.FRONT_WHEEL} type="number" step="0.1" value={config.frontWheelY} onChange={(e) => updateVal("frontWheelY", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.FRONT_WHEEL} type="range" min="-400" max="400" step="0.1" value={config.frontWheelY} onChange={(e) => updateVal("frontWheelY", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">ANGLE:</span>
                      <input disabled={lockedMap.FRONT_WHEEL} type="number" step="0.5" value={config.frontWheelAngle} onChange={(e) => updateVal("frontWheelAngle", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.FRONT_WHEEL} type="range" min="-180" max="180" step="0.5" value={config.frontWheelAngle} onChange={(e) => updateVal("frontWheelAngle", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">SCALE:</span>
                      <input disabled={lockedMap.FRONT_WHEEL} type="number" step="0.01" value={config.frontWheelScale} onChange={(e) => updateVal("frontWheelScale", parseFloat(e.target.value) || 0.1)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.FRONT_WHEEL} type="range" min="0.05" max="2.5" step="0.01" value={config.frontWheelScale} onChange={(e) => updateVal("frontWheelScale", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                  </>
                )}

                {selected === "RIDER" && (
                  <>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">RIDER X:</span>
                      <input disabled={lockedMap.RIDER} type="number" step="0.1" value={config.riderX} onChange={(e) => updateVal("riderX", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.RIDER} type="range" min="-400" max="400" step="0.1" value={config.riderX} onChange={(e) => updateVal("riderX", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">RIDER Y:</span>
                      <input disabled={lockedMap.RIDER} type="number" step="0.1" value={config.riderY} onChange={(e) => updateVal("riderY", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.RIDER} type="range" min="-400" max="400" step="0.1" value={config.riderY} onChange={(e) => updateVal("riderY", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">RIDER ANGLE:</span>
                      <input disabled={lockedMap.RIDER} type="number" step="0.5" value={config.riderAngleOffset} onChange={(e) => updateVal("riderAngleOffset", parseFloat(e.target.value) || 0)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.RIDER} type="range" min="-180" max="180" step="0.5" value={config.riderAngleOffset} onChange={(e) => updateVal("riderAngleOffset", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-dim font-bold">SCALE:</span>
                      <input disabled={lockedMap.RIDER} type="number" step="0.01" value={config.riderScale} onChange={(e) => updateVal("riderScale", parseFloat(e.target.value) || 0.1)} className="w-20 border border-line bg-black px-2 py-1 text-toxic font-bold disabled:opacity-50" />
                      <input disabled={lockedMap.RIDER} type="range" min="0.05" max="2.5" step="0.01" value={config.riderScale} onChange={(e) => updateVal("riderScale", parseFloat(e.target.value))} className="w-24 accent-toxic disabled:opacity-50" />
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
              [ CALCULATE & SAVE CONFIG ]
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
              <span>* ?? Independent Mode Active: Place wheels first, then move bike & rider onto wheels</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
