// frontend/src/pages/landing/copilot/CopilotOrb.jsx
// Integrated Morphing Torii Gate Launcher (based on asssiteant.html)
// Features zero-gravity levitation physics, glassmorphic capsule hover expansion,
// dual concentric spinning HUD orbital rings, and smooth state morphing.

import React, { useState } from 'react';
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
      {/* ── Dynamic Styles matching asssiteant.html ─────────────────────── */}
      <style>{`
        /* Zero-Gravity Levitation Physics */
        @keyframes toriiFloatLauncher {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .torii-levitate-wrapper {
          animation: toriiFloatLauncher 4s ease-in-out infinite;
        }

        /* MAIN MORPHING BUTTON */
        .torii-chat-launcher-btn {
          height: 64px;
          border-radius: 32px;
          background: linear-gradient(135deg, rgba(9, 81, 211, 0.25), rgba(0, 209, 172, 0.25));
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 209, 172, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 0;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37),
                      0 0 20px rgba(0, 209, 172, 0.2);
          transition: border-color 0.3s ease,
                      box-shadow 0.3s ease,
                      transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                      background 0.3s ease;
          outline: none;
          overflow: hidden;
        }

        /* Button Hover & Active States */
        .torii-chat-launcher-btn:hover {
          transform: scale(1.04);
          border-color: #00d1ac;
          background: linear-gradient(135deg, rgba(9, 81, 211, 0.35), rgba(0, 209, 172, 0.35));
          box-shadow: 0 12px 35px 0 rgba(0, 0, 0, 0.5),
                      0 0 30px rgba(0, 209, 172, 0.5);
        }
        .torii-chat-launcher-btn:active {
          transform: scale(0.98) !important;
        }

        /* INTEGRATED EXPANDING TEXT */
        .torii-integrated-label {
          display: grid;
          grid-template-columns: 0fr;
          transition: grid-template-columns 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      margin 0.4s cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 0.3s ease;
          opacity: 0;
          margin-left: 0;
          margin-right: 0;
        }
        /* Text expands smoothly out from the core when hovering the button */
        .torii-chat-launcher-btn:hover .torii-integrated-label {
          grid-template-columns: 1fr;
          opacity: 1;
          margin-left: 24px;
          margin-right: 4px;
        }
        .torii-label-content {
          overflow: hidden;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #ffffff;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .torii-status-dot {
          width: 8px;
          height: 8px;
          background-color: #00d1ac;
          border-radius: 50%;
          box-shadow: 0 0 8px #00d1ac;
          flex-shrink: 0;
          animation: toriiPulseDot 1.5s infinite;
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }
        .torii-status-dot.is-open {
          background-color: #ef4444;
          box-shadow: 0 0 8px #ef4444;
        }
        @keyframes toriiPulseDot {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        /* LAUNCHER CORE (FIXED 64x64 RIGHT ICON) */
        .torii-launcher-core {
          width: 64px;
          height: 64px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
        }

        /* OUTER CONCENTRIC HUD RINGS */
        .torii-orbital-svg {
          width: 100%;
          height: 100%;
          position: absolute;
          top: 0;
          left: 0;
          pointer-events: none;
        }
        @keyframes toriiSpinClockwise {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes toriiSpinCounter {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
        .torii-hud-outer-ring {
          transform-origin: 32px 32px;
          animation: toriiSpinClockwise 10s linear infinite;
          transition: animation-duration 0.3s;
        }
        .torii-hud-inner-ring {
          transform-origin: 32px 32px;
          animation: toriiSpinCounter 6s linear infinite;
        }
        /* Rings spin faster on button hover */
        .torii-chat-launcher-btn:hover .torii-hud-outer-ring {
          animation-duration: 3s;
        }
        .torii-chat-launcher-btn:hover .torii-hud-inner-ring {
          animation-duration: 2s;
        }

        /* CORE TOGGLE (OPEN vs CLOSED STATE) */
        .torii-icon-layer {
          position: absolute;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          pointer-events: none;
        }
        .torii-icon-chat-core {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }
        .torii-icon-close {
          opacity: 0;
          transform: scale(0.5) rotate(-90deg);
        }

        /* Active State Morphing (When Chat is Open) */
        .torii-chat-launcher-btn.is-open .torii-icon-chat-core {
          opacity: 0;
          transform: scale(0.5) rotate(90deg);
        }
        .torii-chat-launcher-btn.is-open .torii-icon-close {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }
        .torii-chat-launcher-btn.is-open {
          background: linear-gradient(135deg, rgba(220, 38, 38, 0.25), rgba(239, 68, 68, 0.25));
          border-color: rgba(239, 68, 68, 0.6);
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.3);
        }

        /* TORII GATE LOGO ANIMATIONS */
        .torii-gate-loader-svg {
          width: 36px;
          height: 36px;
          overflow: visible;
        }
        @keyframes toriiGateLoaderPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 5px rgba(0, 212, 170, 0.3));
          }
          50% {
            transform: scale(1.04);
            filter: drop-shadow(0 0 18px rgba(0, 212, 170, 0.85));
          }
        }
        .torii-gate-pulsing {
          transform-origin: 400px 320px;
          animation: toriiGateLoaderPulse 2s ease-in-out infinite;
        }
        @keyframes toriiGateLoopCheck {
          0% { stroke-dashoffset: 60; opacity: 0; }
          20% { stroke-dashoffset: 0; opacity: 1; }
          70% { stroke-dashoffset: 0; opacity: 1; }
          100% { stroke-dashoffset: -60; opacity: 0; }
        }
        .torii-gate-loading-check {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: toriiGateLoopCheck 2s cubic-bezier(0.65, 0, 0.45, 1) infinite;
        }
        @keyframes toriiGatePortalLight {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        .torii-gate-portal-bg {
          animation: toriiGatePortalLight 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Drawer (above orb when open) ────────────────────────────────── */}
      {open && (
        <div
          className="animate-in slide-in-from-bottom-4 fade-in duration-200"
          data-testid="copilot-drawer-wrapper"
        >
          <CopilotDrawer onClose={() => setOpen(false)} />
        </div>
      )}

      {/* ── Levitating Morphing Capsule Button ────────────────────────────── */}
      <div className="torii-levitate-wrapper">
        <button
          onClick={toggle}
          data-testid="copilot-orb"
          aria-label={open ? 'Close TORII Copilot' : 'Open TORII Copilot'}
          aria-expanded={open}
          className={`torii-chat-launcher-btn ${open ? 'is-open' : ''}`}
        >
          {/* Left Side: Integrated Expanding Label */}
          <div className="torii-integrated-label">
            <div className="torii-label-content">
              <div className={`torii-status-dot ${open ? 'is-open' : ''}`} />
              <span>{open ? 'Close Assistant' : 'Portal Assistant Online'}</span>
            </div>
          </div>

          {/* Right Side: Circular 64x64 HUD Core */}
          <div className="torii-launcher-core">
            {/* Outer Concentric HUD Rings */}
            <svg className="torii-orbital-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hudGradOrb" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0951d3" />
                  <stop offset="100%" stopColor="#00d1ac" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0, 209, 172, 0.15)" strokeWidth="1" />
              <circle className="torii-hud-outer-ring" cx="32" cy="32" r="28" fill="none" stroke="url(#hudGradOrb)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="25 15 10 15 5 15" />
              <circle className="torii-hud-inner-ring" cx="32" cy="32" r="22" fill="none" stroke="#00d1ac" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="15 40 10 20" opacity="0.7" />
            </svg>

            {/* STATE 1: Animated Torii Gate Logo */}
            <div className="torii-icon-layer torii-icon-chat-core">
              <svg className="torii-gate-loader-svg" viewBox="100 80 600 480" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="mainGradientOrb" x1="5%" y1="0%" x2="95%" y2="0%">
                    <stop offset="0%" stopColor="#0951d3" />
                    <stop offset="45%" stopColor="#00a3da" />
                    <stop offset="100%" stopColor="#00d1ac" />
                  </linearGradient>
                  <linearGradient id="archGradientOrb" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#72eee0" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                  </linearGradient>
                </defs>

                {/* CENTER PORTAL GLOW */}
                <path className="torii-gate-portal-bg" d="M 310,520 L 310,340 C 310,280 350,250 400,250 C 450,250 490,280 490,340 L 490,520 Z" fill="url(#archGradientOrb)" />
                <path d="M 340,500 L 340,350 C 340,300 365,280 400,280 C 435,280 460,300 460,350 L 460,500 Z" fill="#ffffff" opacity="0.9" />

                {/* TORII GATE */}
                <g className="torii-gate-pulsing" fill="url(#mainGradientOrb)">
                  <polygon points="190,190 250,190 230,550 170,550" />
                  <polygon points="550,190 610,190 630,550 570,550" />
                  <rect x="150" y="235" width="500" height="36" rx="4" />
                  <path d="M 120,150 L 680,150 L 670,185 L 130,185 Z" />
                  <path d="M 70,85 C 260,145 540,145 730,85 C 705,130 685,140 670,155 L 130,155 C 115,140 95,130 70,85 Z" />
                </g>

                {/* CENTER LOOPING CHECKMARK */}
                <circle cx="400" cy="390" r="28" fill="none" stroke="#00d1ac" strokeWidth="8" opacity="0.3" />
                <polyline className="torii-gate-loading-check" points="385,390 395,400 418,377" fill="none" stroke="#00d1ac" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            {/* STATE 2: Close (X) Icon */}
            <div className="torii-icon-layer torii-icon-close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
