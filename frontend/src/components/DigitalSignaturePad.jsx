// frontend/src/components/DigitalSignaturePad.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Edit3, RotateCcw, CheckCircle2, Type, PenTool } from 'lucide-react';

export default function DigitalSignaturePad({ onSave, initialName = '' }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [useTypeMode, setUseTypeMode] = useState(false);
  const [typedSignature, setTypedSignature] = useState(initialName);
  const [previewUrl, setPreviewUrl] = useState(null);

  const initContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return null;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Bold Midnight Black Ink
    return ctx;
  }, []);

  useEffect(() => {
    if (!useTypeMode) {
      initContext();
    }
  }, [useTypeMode, initContext]);

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    const ctx = initContext();
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const ctx = initContext();
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e);

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current) {
      try {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setPreviewUrl(dataUrl);
        if (onSave) onSave(dataUrl);
      } catch (_) {}
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    setPreviewUrl(null);
    if (onSave) onSave(null);
  };

  const handleTypedChange = (e) => {
    const val = e.target.value;
    setTypedSignature(val);
    if (val.trim()) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="100%" height="100%" fill="#ffffff"/><text x="20" y="65" font-family="'Dancing Script', 'Brush Script MT', cursive, serif" font-size="36" font-weight="bold" fill="#0f172a">${val.trim()}</text></svg>`;
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(svg);
      setPreviewUrl(dataUrl);
      if (onSave) onSave(dataUrl);
    } else {
      setPreviewUrl(null);
      if (onSave) onSave(null);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3" data-testid="digital-signature-pad">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Edit3 className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-slate-200">Digital Customer Signature</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setUseTypeMode(!useTypeMode);
            clearCanvas();
          }}
          className="text-[10px] text-cyan-400 font-semibold hover:underline flex items-center space-x-1"
        >
          {useTypeMode ? (
            <>
              <Edit3 className="w-3 h-3" />
              <span>Switch to Draw</span>
            </>
          ) : (
            <>
              <Type className="w-3 h-3" />
              <span>Type Signature</span>
            </>
          )}
        </button>
      </div>

      {/* Signature Box */}
      {!useTypeMode ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-28 bg-white rounded-xl border-2 border-slate-300 touch-none cursor-crosshair shadow-inner"
          />
          {!hasDrawn && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center space-y-1">
              <PenTool className="w-5 h-5 text-slate-400 opacity-60" />
              <span className="text-xs text-slate-400 font-medium italic">Sign inside box using touch or mouse</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={typedSignature}
            onChange={handleTypedChange}
            placeholder="Type your full legal name"
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-600 rounded-xl text-sm font-semibold text-white focus:border-blue-500 outline-none"
          />
          {typedSignature.trim() && (
            <div className="p-3 bg-white rounded-xl text-center border border-slate-300 shadow-inner">
              <span className="text-3xl font-serif text-slate-900 italic tracking-wider font-bold">
                {typedSignature.trim()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer / Controls */}
      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs text-slate-400 hover:text-red-400 flex items-center space-x-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>

        {previewUrl && (
          <div className="flex items-center space-x-2">
            <div className="bg-white px-2 py-0.5 rounded-lg border border-slate-300 flex items-center">
              <img src={previewUrl} alt="Signature Preview" className="h-6 object-contain" />
            </div>
            <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Signature Attached</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
