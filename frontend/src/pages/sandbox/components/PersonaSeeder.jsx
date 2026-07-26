// frontend/src/pages/sandbox/components/PersonaSeeder.jsx
// Bento Card (Span 2×2): 6 one-click persona seeding buttons.
// Each button is an extruded neumorphic surface that physically depresses on click.
// Calls POST /api/sandbox/seed/:personaId and reports result via onToast.

import React, { useState } from 'react';
import { User, AlertTriangle, Clock, FileX, TrendingUp, Square } from 'lucide-react';

// ── Persona metadata ──────────────────────────────────────────────────────────
// Must match PERSONAS array in backend/src/sandbox/personaDefinitions.js
const PERSONAS = [
  {
    id: 'PAN_BLOCKED',
    label: 'PAN Blocked',
    sublabel: 'Account 1000000001',
    desc: '₹75K failed tx in last 2h',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    dotColor: 'bg-amber-400',
  },
  {
    id: 'AML_SMURFER',
    label: 'AML Smurfer',
    sublabel: 'Account 1000000002',
    desc: '4× sub-₹50K deposits / 72h',
    icon: TrendingUp,
    iconColor: 'text-rose-500',
    dotColor: 'bg-rose-400',
  },
  {
    id: 'DORMANT_ACC',
    label: 'Dormant Account',
    sublabel: 'Account 1000000003',
    desc: 'No transactions in 12+ months',
    icon: Clock,
    iconColor: 'text-slate-400',
    dotColor: 'bg-slate-400',
  },
  {
    id: 'SIGN_MISMATCH',
    label: 'Sign Mismatch',
    sublabel: 'Account 1000000004',
    desc: 'PAN name ≠ account name',
    icon: FileX,
    iconColor: 'text-orange-500',
    dotColor: 'bg-orange-400',
  },
  {
    id: 'CLEAN_HNW',
    label: 'Clean HNW',
    sublabel: 'Account 1000000005',
    desc: 'PAN linked · ₹8.75L balance',
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
    dotColor: 'bg-emerald-400',
  },
  {
    id: 'BLANK_SLATE',
    label: 'Blank Slate',
    sublabel: 'Account 1000000006',
    desc: 'Fresh account · zero history',
    icon: Square,
    iconColor: 'text-slate-400',
    dotColor: 'bg-slate-300',
  },
];

export default function PersonaSeeder({ onToast }) {
  // Track which persona is currently loading
  const [loading, setLoading] = useState(null);
  // Track last seeded for visual feedback
  const [lastSeeded, setLastSeeded] = useState(null);

  async function seedPersona(personaId) {
    if (loading) return;
    setLoading(personaId);
    try {
      const res = await fetch(`/api/sandbox/seed/${personaId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Seed failed');
      setLastSeeded(personaId);
      onToast?.(`✓ ${PERSONAS.find((p) => p.id === personaId)?.label} seeded — Account ${data.account?.account_number}`);
    } catch (err) {
      onToast?.(`Seed failed: ${err.message}`, 'error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="h-full bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] flex flex-col gap-5"
      aria-label="Persona Seeder"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Persona Seeder</span>
          <h2 className="text-base font-extrabold text-slate-800 mt-0.5">1-Click Account Setup</h2>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
      </div>

      {/* Instruction */}
      <p className="text-xs text-slate-500 leading-relaxed -mt-2">
        Seeds deterministic account data into PostgreSQL. Purges prior state for the same account number.
      </p>

      {/* 2×3 Button Grid */}
      <div className="grid grid-cols-2 gap-4 flex-1" role="list" aria-label="Available personas">
        {PERSONAS.map((persona) => {
          const Icon = persona.icon;
          const isLoading = loading === persona.id;
          const isSeeded = lastSeeded === persona.id && loading === null;

          return (
            <button
              key={persona.id}
              role="listitem"
              onClick={() => seedPersona(persona.id)}
              disabled={!!loading}
              aria-label={`Seed ${persona.label} persona`}
              aria-busy={isLoading}
              className={[
                // Base neumorphic extruded button
                'group relative flex flex-col items-start gap-1.5 p-4 rounded-2xl',
                'bg-[#e8ecf2] text-left',
                'shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff]',
                'transition-all duration-200',
                // Hover: slight lift
                'hover:shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]',
                // Active: physically depresses into canvas
                'active:shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]',
                // Disabled while another is loading
                loading && loading !== persona.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                // Seeded state: subtle blue accent ring
                isSeeded ? 'ring-2 ring-blue-500/40' : '',
                // Focus-visible ring for keyboard nav
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
              ].join(' ')}
            >
              {/* Status indicator dot */}
              <span
                className={`absolute top-3 right-3 w-2 h-2 rounded-full ${
                  isSeeded ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : persona.dotColor
                }`}
                aria-hidden="true"
              />

              {/* Icon */}
              <span
                className={`w-8 h-8 rounded-xl bg-[#e8ecf2] flex items-center justify-center shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] ${persona.iconColor}`}
                aria-hidden="true"
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </span>

              {/* Label */}
              <span className="text-xs font-extrabold text-slate-700 leading-tight">
                {persona.label}
              </span>

              {/* Sublabel */}
              <span className="text-[10px] font-mono text-slate-400 leading-tight">{persona.sublabel}</span>

              {/* Description */}
              <span className="text-[10px] text-slate-500 leading-snug hidden sm:block">{persona.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
