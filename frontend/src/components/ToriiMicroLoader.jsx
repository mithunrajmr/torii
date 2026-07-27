// frontend/src/components/ToriiMicroLoader.jsx
import React from 'react';

/**
 * Torii Gate Micro-Loader Component
 * Animated compact Torii gate icon with a spinning neon arc around the inner portal.
 */
export default function ToriiMicroLoader({ size = 20, className = '', color = '#00d1ac' }) {
  return (
    <div
      className={`inline-block flex-shrink-0 relative ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="Loading"
    >
      <style>{`
        @keyframes toriiSpinRing {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .torii-spinner-ring {
          transform-origin: 50px 60px;
          animation: toriiSpinRing 1.2s linear infinite;
        }
      `}</style>
      <svg
        className="w-full h-full overflow-visible"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Spinning Neon Arc */}
        <circle
          className="torii-spinner-ring"
          cx="50"
          cy="60"
          r="16"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="30 70"
        />
        {/* Gate Silhouette */}
        <g fill={color}>
          <rect x="20" y="25" width="10" height="65" rx="3" />
          <rect x="70" y="25" width="10" height="65" rx="3" />
          <rect x="14" y="38" width="72" height="8" rx="2" />
          <path d="M 6,18 Q 50,28 94,18 L 90,28 L 10,28 Z" />
        </g>
      </svg>
    </div>
  );
}
