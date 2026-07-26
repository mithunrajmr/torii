// frontend/src/pages/landing/components/HeroPulseCard.jsx
// Span 2x2: TORII system overview with live AI swarm telemetry inset well
// and primary "Launch Triage" CTA button.
// Neumorphic extruded surface with pulsing status beacon.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Brain, Eye, Shield, TrendingUp } from 'lucide-react';

// Swarm agent telemetry items — simulated live status
const SWARM_AGENTS = [
  { id: 'vision',   label: 'Vision OCR',     icon: Eye,       color: 'text-blue-500',    dot: 'bg-blue-400' },
  { id: 'watchdog', label: 'AML Watchdog',    icon: Shield,    color: 'text-rose-500',    dot: 'bg-rose-400' },
  { id: 'advisor',  label: 'Cross-sell AI',   icon: TrendingUp,color: 'text-emerald-500', dot: 'bg-emerald-400' },
  { id: 'regulator',label: 'PII Regulator',   icon: Brain,     color: 'text-violet-500',  dot: 'bg-violet-400' },
];

export default function HeroPulseCard() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(0);

  // Cycle the telemetry pulse tick every 2.5s to show "live" feel
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="h-full bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]
                 flex flex-col gap-5"
      aria-label="TORII system overview"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {/* Pulsing beacon */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              TORII Engine · Active
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 leading-tight tracking-tight">
            Autonomous Branch<br />Operations Engine
          </h1>
        </div>

        {/* Engine logo mark — inset well */}
        <div
          className="w-14 h-14 rounded-2xl bg-[#e8ecf2] flex items-center justify-center flex-shrink-0
                     shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]"
          aria-hidden="true"
        >
          <Zap className="w-7 h-7 text-blue-600" />
        </div>
      </div>

      {/* ── Descriptor ─────────────────────────────────────────────────── */}
      <p className="text-sm text-slate-600 leading-relaxed -mt-2">
        Intercepts branch compliance blocks in real time. AI swarm resolves PAN linking, AML checks
        and cross-sell in parallel — before the customer reaches a teller.
      </p>

      {/* ── Live AI Swarm Telemetry inset well ─────────────────────────── */}
      <div
        className="bg-[#e8ecf2] rounded-2xl p-4 shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]
                   flex flex-col gap-3"
        aria-label="AI swarm agent status"
      >
        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          AI Swarm · Live Telemetry
        </span>

        <div className="grid grid-cols-2 gap-2">
          {SWARM_AGENTS.map(({ id, label, icon: Icon, color, dot }, idx) => {
            // Stagger the "active" glow so agents appear to take turns processing
            const isActive = (pulse + idx) % 4 === 0;
            return (
              <div
                key={id}
                className="flex items-center gap-2 py-1"
                aria-label={`${label}: ${isActive ? 'processing' : 'standby'}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500 ${dot} ${
                    isActive ? 'shadow-[0_0_6px_currentColor] scale-125' : 'opacity-50'
                  }`}
                  aria-hidden="true"
                />
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold text-slate-600 truncate">{label}</span>
                <span className={`ml-auto text-[9px] font-bold tracking-wide ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
                  {isActive ? 'RUN' : 'IDLE'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Primary CTA ────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/kiosk')}
        className="mt-auto w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-extrabold
                   tracking-wide shadow-[4px_4px_8px_rgba(37,99,235,0.4),-2px_-2px_6px_rgba(255,255,255,0.3)]
                   hover:bg-blue-700 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
                   transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-label="Launch kiosk triage interface"
      >
        ⚡ Launch Triage Interface
      </button>
    </div>
  );
}
