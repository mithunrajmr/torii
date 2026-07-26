// frontend/src/pages/landing/copilot/CopilotOrb.jsx
// Floating bottom-right circular toggle (fixed bottom-8 right-8 z-50).
// Collapsed: pulsing neumorphic orb with sparkle icon.
// Expanded: renders CopilotDrawer above the orb.

import React, { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import CopilotDrawer from './CopilotDrawer.jsx';

export default function CopilotOrb() {
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen((prev) => !prev);
  }

  return (
    <div
      className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4"
      aria-label="TORII Copilot"
    >
      {/* ── Drawer (above orb when open) ──────────────────────────────── */}
      {open && (
        <div
          className="animate-in slide-in-from-bottom-4 fade-in duration-200"
          data-testid="copilot-drawer-wrapper"
        >
          <CopilotDrawer onClose={() => setOpen(false)} />
        </div>
      )}

      {/* ── Floating Orb ───────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        data-testid="copilot-orb"
        aria-label={open ? 'Close TORII Copilot' : 'Open TORII Copilot'}
        aria-expanded={open}
        className={[
          'w-16 h-16 rounded-full bg-[#e8ecf2] flex items-center justify-center',
          'transition-all duration-300',
          open
            ? 'shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]'
            : 'shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] hover:shadow-[12px_12px_20px_#cbced1,-12px_-12px_20px_#ffffff] hover:-translate-y-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
          'active:shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]',
        ].join(' ')}
      >
        {open ? (
          <X className="w-6 h-6 text-slate-600" aria-hidden="true" />
        ) : (
          <div className="relative">
            <Sparkles className="w-7 h-7 text-blue-600" aria-hidden="true" />
            {/* Pulsing ring to draw attention */}
            <span
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400
                         ring-2 ring-[#e8ecf2] animate-pulse"
              aria-hidden="true"
            />
          </div>
        )}
      </button>
    </div>
  );
}
