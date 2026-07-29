// frontend/src/components/ToriiWordmark.jsx
import React, { useId } from 'react';

/**
 * Torii Custom Styled Wordmark Component
 * Recreates the exact brand typography from the photo:
 * - Beveled 'T' top bar with bold stem
 * - Smooth geometric 'o' with circular counter
 * - Elegant arch 'r'
 * - Dual vertical 'i' stems
 * - Connected cyan-to-teal gradient dot bridge over the 'ii' tittles
 */
export default function ToriiWordmark({ 
  className = "h-6 w-auto", 
  fill = "currentColor", 
  animated = false 
}) {
  const gradientId = useId ? useId().replace(/:/g, '') + '_toriiGrad' : 'toriiDotGrad';

  return (
    <svg
      className={`inline-block select-none overflow-visible ${className}`}
      viewBox="0 0 460 150"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Torii"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0080ff" />
          <stop offset="50%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#00d1ac" />
        </linearGradient>

        {animated && (
          <style>{`
            @keyframes torii-bridge-pulse {
              0%, 100% { filter: drop-shadow(0 0 3px rgba(0,209,172,0.4)); transform: scale(1); }
              50% { filter: drop-shadow(0 0 10px rgba(0,209,172,0.9)); transform: scale(1.03); }
            }
            .torii-bridge-glow {
              transform-origin: 401.5px 30px;
              animation: torii-bridge-pulse 2.5s ease-in-out infinite;
            }
          `}</style>
        )}
      </defs>

      {/* Main Text Stems (T, o, r, i, i) */}
      <g fill={fill}>
        {/* Letter 'T': Sloped/beveled top-left bar + centered stem */}
        <path d="M 34,24 L 150,24 L 150,48 L 95,48 L 95,140 L 65,140 L 65,48 L 10,48 Z" />

        {/* Letter 'o': Geometric circle with inner counter */}
        <path fillRule="evenodd" d="M 205,60 C 228,60 246,78 246,100 C 246,122 228,140 205,140 C 182,140 164,122 164,100 C 164,78 182,60 205,60 Z M 205,82 C 215,82 222,89 222,100 C 222,111 215,118 205,118 C 195,118 188,111 188,100 C 188,89 195,82 205,82 Z" />

        {/* Letter 'r': Stem + top right arch */}
        <path d="M 265,60 L 293,60 L 293,76 C 304,64 319,60 334,62 L 334,88 C 320,86 306,91 293,101 L 293,140 L 265,140 Z" />

        {/* Letter 'i' (first vertical stem) */}
        <rect x="360" y="60" width="28" height="80" rx="2" />

        {/* Letter 'i' (second vertical stem) */}
        <rect x="415" y="60" width="28" height="80" rx="2" />
      </g>

      {/* Connected Gradient Dot Bridge over both 'i's (Ultra-smooth 5px pinched waist) */}
      <path
        className={animated ? "torii-bridge-glow" : ""}
        fill={`url(#${gradientId})`}
        d="M 387,19.5 C 396,27.5 407,27.5 416,19.5 A 17,17 0 1,1 416,40.5 C 407,32.5 396,32.5 387,40.5 A 17,17 0 1,1 387,19.5 Z"
      />
    </svg>
  );
}
