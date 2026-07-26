// frontend/src/pages/landing/copilot/ActionChip.jsx
// Neumorphic clickable pill button rendered inside Copilot chat replies.
// When clicked, routes the user to the specified action route.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function ActionChip({ label, route, icon: Icon }) {
  const navigate = useNavigate();
  const [pressed, setPressed] = useState(false);

  function handleClick() {
    setPressed(true);
    setTimeout(() => navigate(route), 200);
  }

  return (
    <button
      onClick={handleClick}
      data-testid={`action-chip-${route?.replace(/\//g, '-')}`}
      aria-label={`${label} — navigate to ${route}`}
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-extrabold',
        'bg-[#e8ecf2] text-blue-600 tracking-wide',
        'transition-all duration-150',
        pressed
          ? 'shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]'
          : 'shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff] hover:shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
      ].join(' ')}
    >
      {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
      {label}
      <ArrowRight className="w-3 h-3" aria-hidden="true" />
    </button>
  );
}
