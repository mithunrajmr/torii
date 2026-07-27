// frontend/src/pages/landing/components/WorkspaceCards.jsx
// 4x Span 1x1: Extruded neumorphic launchpad cards for /kiosk, /mobile, /teller, /sandbox.
// Opens each workspace in the same tab. Hint text shows demo credentials / how-to.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Smartphone, UserCheck, FlaskConical, Bug, ExternalLink } from 'lucide-react';

const WORKSPACES = [
  {
    id: 'kiosk',
    route: '/kiosk',
    label: 'Kiosk Portal',
    sublabel: 'Branch Triage',
    desc: 'Proactive customer auth & QR handoff',
    hint: 'Account: 1000000001 · OTP via email',
    icon: Monitor,
    iconBg: 'bg-blue-600',
    accentDot: 'bg-blue-400',
    requiresAuth: true,
  },
  {
    id: 'debug',
    route: '/debug/agents',
    label: 'Agent Debug Console',
    sublabel: 'Live AI Inspector',
    desc: 'Test all 6 WXO agents & inspect SSE output',
    hint: 'Real DB & Manual Modes',
    icon: Bug,
    iconBg: 'bg-indigo-600',
    accentDot: 'bg-indigo-400',
    requiresAuth: false,
  },
  {
    id: 'teller',
    route: '/teller',
    label: 'Teller HITL',
    sublabel: 'Review Dashboard',
    desc: 'AI-prepared ticket queue & approvals',
    hint: 'TELLER001 · torii2024',
    icon: UserCheck,
    iconBg: 'bg-violet-600',
    accentDot: 'bg-violet-400',
    requiresAuth: true,
  },
  {
    id: 'sandbox',
    route: '/sandbox',
    label: 'Dev Sandbox',
    sublabel: 'Mock CBS Control',
    desc: 'Seed personas, inject errors, chaos test',
    hint: 'No auth required',
    icon: FlaskConical,
    iconBg: 'bg-amber-600',
    accentDot: 'bg-amber-400',
    requiresAuth: false,
  },
];

export default function WorkspaceCards() {
  const navigate = useNavigate();
  const [pressing, setPressing] = useState(null);

  function handleClick(workspace) {
    setPressing(workspace.id);
    setTimeout(() => {
      setPressing(null);
      navigate(workspace.route);
    }, 150);
  }

  return (
    <div
      className="h-full grid grid-cols-2 gap-4"
      aria-label="Workspace launchpads"
      role="navigation"
    >
      {WORKSPACES.map((ws) => {
        const Icon = ws.icon;
        const isPressed = pressing === ws.id;

        return (
          <button
            key={ws.id}
            onClick={() => handleClick(ws)}
            data-testid={`workspace-${ws.id}`}
            aria-label={`Open ${ws.label} workspace`}
            className={[
              'group flex flex-col items-start gap-2 p-4 rounded-2xl bg-[#e8ecf2] text-left',
              'transition-all duration-200 cursor-pointer',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
              isPressed
                ? 'shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]'
                : 'shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] active:shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]',
            ].join(' ')}
          >
            {/* Icon + external-link badge */}
            <div className="flex items-start justify-between w-full">
              <div
                className={`w-9 h-9 rounded-xl ${ws.iconBg} flex items-center justify-center flex-shrink-0
                           shadow-[0_4px_10px_rgba(0,0,0,0.15)]`}
                aria-hidden="true"
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-400 transition-colors mt-1" aria-hidden="true" />
            </div>

            {/* Labels */}
            <div className="min-w-0 w-full">
              <p className="text-xs font-extrabold text-slate-800 leading-tight truncate">{ws.label}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-tight mt-0.5">
                {ws.sublabel}
              </p>
            </div>

            {/* Description */}
            <p className="text-[10px] text-slate-500 leading-snug">{ws.desc}</p>

            {/* Hint / credentials */}
            <div
              className="w-full bg-[#e8ecf2] rounded-xl px-2 py-1
                         shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]"
            >
              <p className="text-[9px] font-mono text-slate-500 truncate leading-tight">
                {ws.requiresAuth ? '🔐 ' : '✓ '}{ws.hint}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
