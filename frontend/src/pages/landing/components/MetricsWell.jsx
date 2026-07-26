// frontend/src/pages/landing/components/MetricsWell.jsx
// Span 1x1: Depressed inset well showing 34s resolution & 90% teller ROI metrics.
// Pure neumorphic inset surface — no external data dependency.

import React from 'react';
import { TrendingUp, Clock, ShieldCheck } from 'lucide-react';

const METRICS = [
  {
    icon: Clock,
    iconColor: 'text-blue-500',
    value: '34s',
    label: 'Avg Resolution Time',
    sub: 'vs 18 min manual',
  },
  {
    icon: TrendingUp,
    iconColor: 'text-emerald-500',
    value: '90%',
    label: 'Teller Time Saved',
    sub: 'per compliance case',
  },
  {
    icon: ShieldCheck,
    iconColor: 'text-violet-500',
    value: '100%',
    label: 'Audit Trail Coverage',
    sub: 'PII-redacted logs',
  },
];

export default function MetricsWell() {
  return (
    <div
      className="h-full bg-[#e8ecf2] rounded-3xl p-5 shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff] flex flex-col gap-4"
      aria-label="Key performance metrics"
    >
      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        Live ROI Metrics
      </span>

      <div className="flex flex-col gap-3 flex-1 justify-center">
        {METRICS.map(({ icon: Icon, iconColor, value, label, sub }) => (
          <div key={label} className="flex items-center gap-3">
            {/* Inset icon well */}
            <div
              className="w-9 h-9 rounded-xl bg-[#e8ecf2] flex items-center justify-center flex-shrink-0
                         shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]"
              aria-hidden="true"
            >
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-800 leading-none">{value}</span>
                <span className="text-[10px] text-slate-400 leading-none truncate">{sub}</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
