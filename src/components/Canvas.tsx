import React, { useRef, useState, useEffect } from "react";
import { Trash2, Eraser, Edit2, RotateCcw, Download, Sparkles, Paintbrush, PaintBucket } from "lucide-react";
import { motion } from "motion/react";

interface CanvasProps {
  onSave: (base64Png: string) => void;
  isSubmitting: boolean;
  themeText: string;
  onDrawingUpdate?: (base64Png: string) => void;
}

export default function Canvas({ onSave, isSubmitting, themeText, onDrawingUpdate }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState<"pencil" | "neon" | "spray" | "stamp" | "eraser">("pencil");
  const [color, setColor] = useState("#c53030"); // Classic cinnabar red by default
  const [brushSize, setBrushSize] = useState(6);
  
  // Stamp presets for amusing streamer stickers
  const stampsPreset = ["🌟", "❤️", "👑", "🐶", "💩", "🍊", "🔥", "👻", "👾", "🎨", "🐸", "🍕", "🍌", "💥"];
  const [selectedStamp, setSelectedStamp] = useState("🌟");
  
  // History stack for Undo action!
  const [history, setHistory] = useState<string[]>([]);

  // Classic historical Renaissance pigments catalog!
  const colorPresets = [
    { value: "#ffffff", name: "Белила" },
    { value: "#ebd08f", name: "Охра" },
    { value: "#c53030", name: "Киноварь" },
    { value: "#1a365d", name: "Лазурит" },
    { value: "#2f855a", name: "Зелень" },
    { value: "#513a29", name: "Умбра" },
    { value: "#110b08", name: "Сажа" },
    { value: "#a855f7", name: "Мурмура" } // Twitch purple representation
  ];

  // Configure canvas after mounting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Double resolution for crisp High-DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Clear background to white so evaluation is clean
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.scale(2, 2);
    context.lineCap = "round";
    context.lineJoin = "round";
    contextRef.current = context;

    // Record the first clean white slate in history
    saveHistoryState();

    // Resize listener for fluid response
    const handleResize = () => {
      // Create offscreen image to protect drawing
      const tempImage = new Image();
      tempImage.src = canvas.toDataURL();

      const newRect = canvas.getBoundingClientRect();
      canvas.width = newRect.width * 2;
      canvas.height = newRect.height * 2;
      canvas.style.width = `${newRect.width}px`;
      canvas.style.height = `${newRect.height}px`;

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(2, 2);
      context.lineCap = "round";
      context.lineJoin = "round";

      tempImage.onload = () => {
        context.drawImage(tempImage, 0, 0, newRect.width, newRect.height);
      };
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const saveHistoryState = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL();
    setHistory((prev) => [...prev.slice(-30), dataUrl]); // Cap historical edits to 30 elements
  };

  const setupContextStyle = () => {
    const ctx = contextRef.current;
    if (!ctx) return;

    // Default cleanup
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    if (activeTool === "eraser") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = brushSize;
    } else if (activeTool === "pencil") {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    } else if (activeTool === "neon") {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.shadowBlur = brushSize;
      ctx.shadowColor = color;
    } else if (activeTool === "spray" || activeTool === "stamp") {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!contextRef.current || !canvasRef.current) return;

    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (activeTool === "stamp") {
      // Print the stamp instantly and don't draw drag lines
      contextRef.current.save();
      contextRef.current.fillStyle = color;
      contextRef.current.font = `${brushSize * 3}px sans-serif`;
      contextRef.current.textAlign = "center";
      contextRef.current.textBaseline = "middle";
      contextRef.current.fillText(selectedStamp, x, y);
      contextRef.current.restore();
      saveHistoryState();
      
      if (onDrawingUpdate && canvasRef.current) {
        onDrawingUpdate(canvasRef.current.toDataURL("image/png"));
      }
      return;
    }

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);

    // Apply color and brush styles
    setupContextStyle();

    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;
    if (activeTool === "stamp") return;

    let clientX: number;
    let clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (activeTool === "spray") {
      // Custom spray splatter effect
      const density = Math.min(brushSize * 2, 40);
      contextRef.current.fillStyle = color;
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (brushSize + 1);
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        contextRef.current.fillRect(px, py, 1.5, 1.5);
      }
    } else {
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    contextRef.current?.closePath();
    setIsDrawing(false);
    saveHistoryState();
    if (onDrawingUpdate && canvasRef.current) {
      onDrawingUpdate(canvasRef.current.toDataURL("image/png"));
    }
  };

  const undo = () => {
    if (history.length <= 1 || !canvasRef.current || !contextRef.current) return;
    
    const previousStateSrc = history[history.length - 2];
    const image = new Image();
    image.src = previousStateSrc;
    image.onload = () => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      contextRef.current!.clearRect(0, 0, rect.width, rect.height);
      contextRef.current!.fillStyle = "#ffffff";
      contextRef.current!.fillRect(0, 0, rect.width, rect.height);
      contextRef.current!.drawImage(image, 0, 0, rect.width, rect.height);
      setHistory((prev) => prev.slice(0, -1));
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;
    const rect = canvas.getBoundingClientRect();
    contextRef.current.clearRect(0, 0, rect.width, rect.height);
    contextRef.current.fillStyle = "#ffffff";
    contextRef.current.fillRect(0, 0, rect.width, rect.height);
    saveHistoryState();
    if (onDrawingUpdate) {
      onDrawingUpdate(canvas.toDataURL("image/png"));
    }
  };

  const fillCanvasBackground = () => {
    const canvas = canvasRef.current;
    if (!canvas || !contextRef.current) return;
    const rect = canvas.getBoundingClientRect();
    
    // Clear and fill entirely with color
    contextRef.current.save();
    contextRef.current.fillStyle = color;
    contextRef.current.fillRect(0, 0, rect.width, rect.height);
    contextRef.current.restore();
    
    saveHistoryState();
    if (onDrawingUpdate) {
      onDrawingUpdate(canvasRef.current.toDataURL("image/png"));
    }
  };

  const handleSubmit = () => {
    if (!canvasRef.current) return;
    const b64Data = canvasRef.current.toDataURL("image/png");
    onSave(b64Data);
  };

  const localDownloadPNG = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `chatdraw-renaissance-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full bg-[#141211] border border-[#c5a880]/15 rounded-2xl p-4 shadow-xl">
      {/* Canvas Tool Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 border border-[#c5a880]/10 rounded-xl p-3">
        {/* Tools Selectors */}
        <div className="flex flex-wrap items-center gap-1.5 bg-stone-900/60 p-1 border border-stone-800/80 rounded-lg">
          <button
            onClick={() => setActiveTool("pencil")}
            className={`p-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              activeTool === "pencil"
                ? "bg-[#b08149]/20 text-[#ebd6b7] border border-[#c5a880]/30"
                : "text-stone-400 hover:text-stone-200"
            }`}
            title="Кисть художника"
          >
            <Paintbrush className="w-4 h-4" />
            <span className="hidden sm:inline">Обычная</span>
          </button>

          <button
            onClick={() => setActiveTool("neon")}
            className={`p-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              activeTool === "neon"
                ? "bg-[#b08149]/20 text-[#ebd6b7] border border-[#c5a880]/30"
                : "text-stone-400 hover:text-stone-200"
            }`}
            title="Неоновое свечение"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Свечение</span>
          </button>

          <button
            onClick={() => setActiveTool("spray")}
            className={`p-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              activeTool === "spray"
                ? "bg-[#b08149]/20 text-[#ebd6b7] border border-[#c5a880]/30"
                : "text-stone-400 hover:text-stone-200"
            }`}
            title="Спрей баллончик"
          >
            <span className="text-sm">💨</span>
            <span className="hidden sm:inline">Спрей</span>
          </button>

          <button
            onClick={() => setActiveTool("stamp")}
            className={`p-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              activeTool === "stamp"
                ? "bg-[#b08149]/20 text-[#ebd6b7] border border-[#c5a880]/30"
                : "text-stone-400 hover:text-stone-200"
            }`}
            title="Штампы эмоджи"
          >
            <span className="text-sm">{selectedStamp}</span>
            <span className="hidden sm:inline">Штамп</span>
          </button>
          
          <button
            onClick={() => setActiveTool("eraser")}
            className={`p-2 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
              activeTool === "eraser"
                ? "bg-[#b08149]/20 text-[#ebd6b7] border border-[#c5a880]/30"
                : "text-stone-400 hover:text-stone-200"
            }`}
            title="Ластик"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline">Ластик</span>
          </button>
        </div>

        {/* Fill background utility tool */}
        <button
          onClick={fillCanvasBackground}
          className="p-2.5 border border-[#c5a880]/20 bg-stone-900/60 hover:bg-[#b08149]/10 text-[#ebd6b7] rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
          title="Залить весь холст текущим цветом"
        >
          <PaintBucket className="w-4 h-4" />
          <span>Залить фон</span>
        </button>

        {/* Brush Size selector */}
        <div className="flex items-center gap-2.5 bg-stone-900/60 px-3 py-1.5 border border-stone-800/80 rounded-lg">
          <span className="text-[10px] font-mono text-stone-400 select-none">РАЗМЕР:</span>
          <input
            type="range"
            min="1"
            max="60"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-16 md:w-28 accent-amber-500 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-stone-200 min-w-[20px] text-center">{brushSize}px</span>
        </div>

        {/* Color Presets Palette */}
        {activeTool !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-stone-900/60 p-1 border border-stone-800/80 rounded-lg max-w-[280px] overflow-x-auto">
            {colorPresets.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-5 h-5 rounded-full border transition-all cursor-pointer relative group shrink-0 ${
                  color === c.value 
                    ? "border-white scale-110 shadow" 
                    : "border-stone-900 hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            
            {/* Native picker */}
            <div className="relative w-5 h-5 rounded-full border border-stone-900 flex items-center justify-center overflow-hidden cursor-pointer bg-conic shrink-0" title="Выбрать цвет">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div 
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
        )}

        {/* Canvas Utilities: Undo / Clear / Save PNG */}
        <div className="flex items-center gap-1.5 font-mono">
          <button
            onClick={undo}
            disabled={history.length <= 1}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              history.length > 1
                ? "border-stone-800 text-stone-300 hover:bg-stone-800 hover:text-white"
                : "border-stone-900 text-stone-700 cursor-not-allowed"
            }`}
            title="Назад (Undo)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={clearCanvas}
            className="p-2 border border-stone-800 text-red-500 hover:bg-red-950/20 hover:border-red-900/30 rounded-lg transition-all cursor-pointer"
            title="Очистить холст"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={localDownloadPNG}
            className="p-2 border border-stone-800 text-stone-400 hover:bg-stone-950 hover:text-stone-200 rounded-lg transition-all cursor-pointer"
            title="Скачать эскиз"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stamp Picker sub-panel when Stamp Tool is active */}
      {activeTool === "stamp" && (
        <motion.div 
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/60 border border-[#c5a880]/15 rounded-xl p-3 flex flex-wrap items-center gap-2"
        >
          <span className="text-[10px] font-mono text-stone-400 uppercase tracking-wider mr-2 select-none">ВЫБЕРИТЕ ШТАМП:</span>
          {stampsPreset.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStamp(st)}
              className={`text-xl hover:scale-125 transition-all p-1.5 rounded-lg border cursor-pointer ${
                selectedStamp === st 
                  ? "bg-[#b08149]/20 border-[#c5a880]/40 scale-110" 
                  : "border-transparent text-stone-300"
              }`}
            >
              {st}
            </button>
          ))}
        </motion.div>
      )}

      {/* Frame painting workspace */}
      <div className="relative flex-1 min-h-[400px] painting-frame p-2 rounded-xl overflow-hidden cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full block bg-white"
        />
        
        {/* Floating guidance topic banner */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 bg-stone-950/90 backdrop-blur px-4 py-1.5 border border-[#c5a880]/20 rounded-full max-w-[85%] text-center pointer-events-none select-none shadow-md">
          <p className="text-[9px] tracking-wider text-[#c5a880] uppercase font-mono font-bold leading-none">НАДКОНСТРУКЦИЯ</p>
          <p className="text-xs font-semibold text-stone-200 mt-0.5 truncate max-w-[260px] italic">«{themeText || "Свободное творение"}»</p>
        </div>
      </div>

      {/* Finish submit action bar */}
      <div className="flex items-center justify-end">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`px-8 py-3.5 rounded-full font-bold transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
            isSubmitting
              ? "bg-stone-800 text-stone-500 cursor-wait border border-stone-900"
              : "bg-[#fbb03b] hover:bg-amber-400 text-stone-950"
          }`}
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-stone-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              ВЕРДИКТ ФОРМИРУЕТСЯ...
            </>
          ) : (
            "ОТПРАВИТЬ ШЕДЕВР НА СУД СТРИМА"
          )}
        </motion.button>
      </div>
    </div>
  );
}
