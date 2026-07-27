// frontend/src/components/DigitalSignaturePad.jsx
import React, { useRef, useState, useEffect } from 'react';
import { Edit3, RotateCcw, CheckCircle2, Type } from 'lucide-react';

export default function DigitalSignaturePad({ onSave, initialName = '' }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [useTypeMode, setUseTypeMode] = useState(false);
  const [typedSignature, setTypedSignature] = useState(initialName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a'; // Deep blue ink
  }, [useTypeMode]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (hasSignature && onSave && canvasRef.current) {
      try {
        onSave(canvasRef.current.toDataURL('image/png'));
      } catch (_) {}
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
    if (onSave) onSave(null);
  };

  const handleTypedChange = (e) => {
    const val = e.target.value;
    setTypedSignature(val);
    if (val.trim() && onSave) {
      // Create SVG-based text data URL for typed signature
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><text x="10" y="50" font-family="Dancing Script, cursive, Brush Script MT, sans-serif" font-size="32" fill="#1e3a8a">${val.trim()}</text></svg>`;
      const encoded = 'data:image/svg+xml;base64,' + btoa(svg);
      onSave(encoded);
    }
  };

  return (
    <div className="bg-slate-800/90 border border-slate-700 p-4 rounded-2xl space-y-3" data-testid="digital-signature-pad">
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

      {!useTypeMode ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={320}
            height={100}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-24 bg-slate-100 rounded-xl border border-slate-300 touch-none cursor-crosshair"
          />
          {!hasSignature && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
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
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-sm font-semibold text-white focus:border-blue-500 outline-none"
          />
          {typedSignature.trim() && (
            <div className="p-3 bg-slate-100 rounded-xl text-center">
              <span className="text-2xl font-serif text-blue-900 italic tracking-wider">
                {typedSignature.trim()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={clearCanvas}
          className="text-xs text-slate-400 hover:text-red-400 flex items-center space-x-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
        {(hasSignature || (useTypeMode && typedSignature.trim())) && (
          <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Signature Attached</span>
          </span>
        )}
      </div>
    </div>
  );
}
