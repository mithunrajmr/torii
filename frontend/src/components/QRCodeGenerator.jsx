// frontend/src/components/QRCodeGenerator.jsx
// Reusable QR code canvas with built-in countdown timer (Spec §6).
// Props:
//   payload  {string}   — The URL or string to encode into the QR code.
//   timeout  {number}   — Countdown duration in seconds (default: 45).
//   onExpire {function} — Called with no args when the countdown reaches 0.

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export default function QRCodeGenerator({ payload, timeout = 45, onExpire }) {
  const canvasRef = useRef(null);
  const [timeRemaining, setTimeRemaining] = useState(timeout);

  // Render QR code onto canvas whenever payload changes
  useEffect(() => {
    if (!payload || !canvasRef.current) return;

    QRCode.toCanvas(canvasRef.current, payload, {
      width: 240,
      margin: 2,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    }).catch((err) => {
      console.error('[QRCodeGenerator] Canvas render failed:', err);
    });
  }, [payload]);

  // Countdown timer — starts fresh whenever payload or timeout changes.
  // The parent bumps a `key` prop to force a full remount for new QR codes,
  // but this effect also handles timeout-prop-only changes.
  useEffect(() => {
    setTimeRemaining(timeout);
    if (timeout <= 0) {
      onExpire?.();
      return;
    }

    const tick = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(tick);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [payload, timeout]); // reset on new payload (new QR) or timeout change

  const isUrgent = timeRemaining <= 10;

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* QR Canvas */}
      <div className="neo-inset p-4 rounded-3xl bg-white shadow-inner">
        <canvas ref={canvasRef} className="rounded-2xl" />
      </div>

      {/* Countdown badge */}
      <div
        className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-sm font-bold font-mono transition-colors ${
          isUrgent
            ? 'bg-red-100 text-red-600 border border-red-300'
            : 'bg-slate-100 text-slate-600 border border-slate-300'
        }`}
      >
        <span className={isUrgent ? 'animate-pulse' : ''}>{timeRemaining}s</span>
        <span className="text-xs font-normal opacity-70">remaining</span>
      </div>
    </div>
  );
}
