// frontend/src/pages/sandbox/components/ChaosControl.jsx
// Bento Card (Span 2×1): Toggle switches and latency slider for API chaos injection.
// Wired to POST /api/sandbox/chaos and GET /api/sandbox/chaos.

import React, { useState, useEffect } from 'react';
import { Zap, WifiOff, Clock, ServerCrash } from 'lucide-react';

// Allowed HTTP error codes to force
const HTTP_ERROR_OPTIONS = [
  { code: null,  label: 'None' },
  { code: 500,   label: '500 Internal Error' },
  { code: 503,   label: '503 Unavailable' },
  { code: 429,   label: '429 Rate Limited' },
  { code: 408,   label: '408 Timeout' },
];

export default function ChaosControl({ onToast }) {
  const [delayMs, setDelayMs]             = useState(0);
  const [forceHttpError, setForceHttpError] = useState(null);
  const [isActive, setIsActive]           = useState(false);
  const [saving, setSaving]               = useState(false);

  // Load current chaos rules on mount
  useEffect(() => {
    fetch('/api/sandbox/chaos')
      .then((r) => r.json())
      .then(({ rules, active }) => {
        setDelayMs(rules.cbsDelayMs ?? 0);
        setForceHttpError(rules.forceHttpError ?? null);
        setIsActive(active);
      })
      .catch(() => {});
  }, []);

  async function applyChaos() {
    setSaving(true);
    try {
      const res = await fetch('/api/sandbox/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cbsDelayMs: delayMs, forceHttpError }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to set chaos rules');
      setIsActive(data.rules.cbsDelayMs > 0 || !!data.rules.forceHttpError);
      onToast?.(data.message, delayMs === 0 && !forceHttpError ? 'success' : 'warn');
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function clearChaos() {
    setDelayMs(0);
    setForceHttpError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/sandbox/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cbsDelayMs: 0, forceHttpError: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setIsActive(false);
      onToast?.('Chaos disabled — all CBS routes running normally.');
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="h-full bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] flex flex-col gap-5"
      aria-label="Chaos Control Panel"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Chaos Engineering</span>
          <h2 className="text-base font-extrabold text-slate-800 mt-0.5 flex items-center gap-2">
            CBS Latency & Failure Sim
            {isActive && (
              <span className="text-[10px] font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-300">
                ACTIVE
              </span>
            )}
          </h2>
        </div>
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isActive
              ? 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
              : 'bg-slate-300'
          }`}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-col gap-5 flex-1">

        {/* ── CBS Delay Slider ─────────────────────────────────────────── */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            CBS Response Delay
            <span
              className="ml-auto font-mono font-bold text-blue-600 bg-[#e8ecf2] px-2 py-0.5 rounded-lg shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-[11px]"
              aria-live="polite"
              aria-label={`Current delay: ${delayMs} milliseconds`}
            >
              {delayMs}ms
            </span>
          </legend>
          <input
            type="range"
            min={0}
            max={5000}
            step={250}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            aria-label={`CBS delay in milliseconds, current value ${delayMs}`}
            className="w-full h-2 rounded-full appearance-none cursor-pointer
              bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]
              accent-blue-600
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0ms</span><span>1s</span><span>2.5s</span><span>5s</span>
          </div>
        </fieldset>

        {/* ── Force HTTP Error ─────────────────────────────────────────── */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <ServerCrash className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            Force HTTP Error Code
          </legend>
          <div
            className="bg-[#e8ecf2] rounded-xl p-1 shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] flex flex-wrap gap-1"
            role="radiogroup"
            aria-label="Select forced HTTP error code"
          >
            {HTTP_ERROR_OPTIONS.map((opt) => (
              <button
                key={opt.code ?? 'none'}
                role="radio"
                aria-checked={forceHttpError === opt.code}
                onClick={() => setForceHttpError(opt.code)}
                className={[
                  'flex-1 min-w-[60px] py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                  forceHttpError === opt.code
                    ? 'bg-[#e8ecf2] text-blue-600 shadow-[inset_2px_2px_5px_#cbced1,inset_-2px_-2px_5px_#ffffff]'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────────────── */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={applyChaos}
          disabled={saving}
          aria-label="Apply chaos rules"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
            bg-blue-600 text-white text-xs font-bold
            shadow-[0_6px_16px_rgba(37,99,235,0.35)] hover:bg-blue-500
            active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]"
        >
          <Zap className="w-3.5 h-3.5" aria-hidden="true" />
          {saving ? 'Applying…' : 'Apply Rules'}
        </button>

        {isActive && (
          <button
            onClick={clearChaos}
            disabled={saving}
            aria-label="Clear all chaos rules"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
              bg-[#e8ecf2] text-slate-600 text-xs font-bold
              shadow-[5px_5px_10px_#cbced1,-5px_-5px_10px_#ffffff]
              hover:shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff]
              active:shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]
              transition-all duration-200 disabled:opacity-50
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]"
          >
            <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
            Clear Chaos
          </button>
        )}
      </div>
    </div>
  );
}
