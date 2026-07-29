// frontend/src/components/ToriiMiniLogo.jsx
import React from 'react';

/**
 * Animated Torii Gate Mini Loading Logo (from logo-small.html)
 */
export default function ToriiMiniLogo({ className = 'w-9 h-9', size = 'md' }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <style>{`
        @keyframes loader-pulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 4px rgba(0, 212, 170, 0.4));
          }
          50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 12px rgba(0, 212, 170, 0.9));
          }
        }
        .pulsing-gate-mini {
          transform-origin: 400px 320px;
          animation: loader-pulse 2s ease-in-out infinite;
        }

        @keyframes loop-check {
          0% { stroke-dashoffset: 60; opacity: 0; }
          20% { stroke-dashoffset: 0; opacity: 1; }
          70% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -60; opacity: 0; }
        }
        .loading-check-mini {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: loop-check 2s cubic-bezier(0.65, 0, 0.45, 1) infinite;
        }

        @keyframes portal-light {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .portal-bg-mini {
          animation: portal-light 2s ease-in-out infinite;
        }
      `}</style>

      <svg className="w-full h-full overflow-visible" viewBox="100 80 600 480" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="mainGradientMini" x1="5%" y1="0%" x2="95%" y2="0%">
            <stop offset="0%" stopColor="#0951d3" />
            <stop offset="45%" stopColor="#00a3da" />
            <stop offset="100%" stopColor="#00d1ac" />
          </linearGradient>
          <linearGradient id="archGradientMini" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#72eee0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* CENTER PORTAL GLOW */}
        <path className="portal-bg-mini" d="M 310,520 L 310,340 C 310,280 350,250 400,250 C 450,250 490,280 490,340 L 490,520 Z" fill="url(#archGradientMini)" />
        <path d="M 340,500 L 340,350 C 340,300 365,280 400,280 C 435,280 460,300 460,350 L 460,500 Z" fill="#ffffff" opacity="0.9" />

        {/* TORII GATE */}
        <g className="pulsing-gate-mini" fill="url(#mainGradientMini)">
          <polygon points="190,190 250,190 230,550 170,550" />
          <polygon points="550,190 610,190 630,550 570,550" />
          <rect x="150" y="235" width="500" height="36" rx="4" />
          <path d="M 120,150 L 680,150 L 670,185 L 130,185 Z" />
          <path d="M 70,85 C 260,145 540,145 730,85 C 705,130 685,140 670,155 L 130,155 C 115,140 95,130 70,85 Z" />
        </g>

        {/* CENTER LOOPING CHECKMARK */}
        <circle cx="400" cy="390" r="28" fill="none" stroke="#00d1ac" strokeWidth="8" opacity="0.3" />
        <polyline className="loading-check-mini" points="385,390 395,400 418,377" fill="none" stroke="#00d1ac" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
