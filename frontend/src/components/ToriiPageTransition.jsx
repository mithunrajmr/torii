// frontend/src/components/ToriiPageTransition.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Universal Torii Portal Page Transition Wrapper
 * Triggers a high-fidelity cinematic bloom/warp overlay matching final-4-upgrade.html
 * whenever the route path changes.
 */
export default function ToriiPageTransition({ children }) {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayChildren, setDisplayChildren] = useState(children);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Trigger Torii Portal transition on route change
    setIsTransitioning(true);

    const timer = setTimeout(() => {
      setDisplayChildren(children);
    }, 250);

    const endTimer = setTimeout(() => {
      setIsTransitioning(false);
    }, 550);

    return () => {
      clearTimeout(timer);
      clearTimeout(endTimer);
    };
  }, [location.pathname]);

  // Keep displayChildren updated if children update without location change
  useEffect(() => {
    if (!isTransitioning) {
      setDisplayChildren(children);
    }
  }, [children, isTransitioning]);

  return (
    <div className="relative w-full min-h-screen">
      {/* Dynamic Torii Portal Bloom Overlay */}
      {isTransitioning && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center bg-[#ecf1ff]/85 backdrop-blur-md animate-torii-portal-warp">
          <style>{`
            @keyframes torii-portal-warp {
              0% { opacity: 0; transform: scale(0.85); filter: brightness(0.5) blur(10px); }
              40% { opacity: 1; transform: scale(1.05); filter: brightness(1.8) blur(0px); }
              70% { opacity: 1; transform: scale(1); filter: brightness(1.2) blur(0px); }
              100% { opacity: 0; transform: scale(1.1); filter: brightness(1) blur(8px); }
            }

            @keyframes torii-speed-flash {
              0% { transform: scaleX(0.2); opacity: 0; }
              50% { transform: scaleX(1.2); opacity: 1; }
              100% { transform: scaleX(1.8); opacity: 0; }
            }

            .animate-torii-portal-warp {
              animation: torii-portal-warp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            .animate-torii-speed-flash {
              animation: torii-speed-flash 0.55s ease-out forwards;
            }
          `}</style>

          <div className="w-64 h-64 md:w-80 md:h-80 relative flex items-center justify-center">
            {/* Speed Lines Overlay */}
            <div className="absolute inset-0 flex items-center justify-between px-2 animate-torii-speed-flash">
              <div className="w-16 h-2 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full blur-[1px]" />
              <div className="w-16 h-2 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full blur-[1px]" />
            </div>

            {/* Glowing SVG Torii Gate Silhouette */}
            <svg viewBox="0 0 800 600" className="w-full h-full drop-shadow-[0_0_35px_rgba(0,209,172,0.6)]">
              <defs>
                <linearGradient id="portalTransGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0951d3" />
                  <stop offset="50%" stopColor="#00a3da" />
                  <stop offset="100%" stopColor="#00d1ac" />
                </linearGradient>
              </defs>

              {/* Glowing Arch */}
              <path d="M 310,520 L 310,340 C 310,280 350,250 400,250 C 450,250 490,280 490,340 L 490,520 Z" fill="url(#portalTransGrad)" opacity="0.4" />

              {/* Torii Gate Structure */}
              <g fill="url(#portalTransGrad)">
                <polygon points="190,190 250,190 230,550 170,550" />
                <polygon points="550,190 610,190 630,550 570,550" />
                <rect x="150" y="235" width="500" height="36" rx="4" />
                <path d="M 120,150 L 680,150 L 670,185 L 130,185 Z" />
                <path d="M 70,85 C 260,145 540,145 730,85 C 705,130 685,140 670,155 L 130,155 C 115,140 95,130 70,85 Z" />
              </g>

              {/* Center Glowing Orb */}
              <circle cx="400" cy="400" r="30" fill="#ffffff" opacity="0.9" className="animate-ping" />
            </svg>
          </div>
        </div>
      )}

      {/* Main Page Content */}
      <div className={`transition-opacity duration-300 ${isTransitioning ? 'opacity-40' : 'opacity-100'}`}>
        {displayChildren}
      </div>
    </div>
  );
}
