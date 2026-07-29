// frontend/src/pages/landing/LandingMaster.jsx
// Root responsive 4-column Neo-Bento CSS Grid container for the Master Landing Hub.
//
// Grid layout (4-col @ lg):
//   Row 1-2: [HeroPulseCard 2×2] [WorkspaceCards 2×2 (2-col sub-grid)]
//   Row 3:   [SectionGRadar 4×1 — full width]
//   Row 4-5: [DomainShowcase 4×2 — full width]
//   Row 6:   [MetricsWell 1×1] [footer 3×1]
//
// Floating: CopilotOrb (fixed, outside grid)

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Sparkles, Mic } from 'lucide-react';
import HeroPulseCard from './components/HeroPulseCard.jsx';
import ToriiMiniLogo from '../../components/ToriiMiniLogo.jsx';
import ToriiWordmark from '../../components/ToriiWordmark.jsx';

import WorkspaceCards from './components/WorkspaceCards.jsx';
import SectionGRadar from './components/SectionGRadar.jsx';
import DomainShowcase from './components/DomainShowcase.jsx';
import MetricsWell from './components/MetricsWell.jsx';
import CopilotOrb from './copilot/CopilotOrb.jsx';

export default function LandingMaster() {
  const [radarRefreshKey, setRadarRefreshKey] = React.useState(0);
  const [priming, setPriming] = useState(false);
  const [primeStatus, setPrimeStatus] = useState(null); // null | 'ok' | 'error'

  function triggerRadarRefresh() {
    setRadarRefreshKey((k) => k + 1);
  }

  // One-click demo primer: seeds all 5 personas then creates demo teller tickets.
  async function handlePrimeDemo() {
    if (priming) return;
    setPriming(true);
    setPrimeStatus(null);
    try {
      // Seed all 5 personas sequentially
      const personaIds = ['PAN_BLOCKED', 'AML_SMURFER', 'DORMANT_ACC', 'SIGN_MISMATCH', 'CLEAN_HNW'];
      await Promise.all(
        personaIds.map((id) => fetch(`/api/sandbox/seed/${id}`, { method: 'POST' }))
      );
      // Seed teller tickets
      await fetch('/api/sandbox/seed-tickets', { method: 'POST' });
      setPrimeStatus('ok');
      triggerRadarRefresh();
      setTimeout(() => setPrimeStatus(null), 4000);
    } catch {
      setPrimeStatus('error');
      setTimeout(() => setPrimeStatus(null), 4000);
    } finally {
      setPriming(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#e8ecf2] font-sans text-slate-800">

      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <Link to="/" className="flex items-center gap-3 group hover:opacity-90 transition-opacity">
          <ToriiMiniLogo className="w-10 h-10 group-hover:scale-105 transition-transform" />
          <div>
            <h1 className="text-base font-extrabold tracking-tight leading-tight flex items-center">
              <span className="sr-only">TORII</span>
              <ToriiWordmark className="h-6 w-auto" fill="white" animated />
            </h1>
            <p className="text-[10px] text-blue-400 font-semibold tracking-widest uppercase">
              Autonomous Branch Compliance Engine
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* One-click demo primer */}
          <button
            onClick={handlePrimeDemo}
            disabled={priming}
            aria-label="Prime demo: seed all personas and create teller tickets"
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
              primeStatus === 'ok'
                ? 'bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.4)]'
                : primeStatus === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-[0_4px_12px_rgba(245,158,11,0.4)]',
              priming ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {priming ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Rocket className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {primeStatus === 'ok'
              ? '✓ Demo Ready!'
              : primeStatus === 'error'
                ? '✗ Retry'
                : priming
                  ? 'Priming…'
                  : '⚡ Prime Demo'}
          </button>

          {/* Gemini OCR Lab Studio Direct Link */}
          <Link
            to="/ocr-demo"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            TORII Vision Lab
          </Link>

          {/* Voice & Audio Testing Studio Link */}
          <Link
            to="/voice-lab"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-[0_4px_12px_rgba(79,70,229,0.4)]"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-200" />
            TORII Voice Lab
          </Link>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" aria-hidden="true" />
            System Online
          </div>
        </div>
      </header>

      {/* ── Bento Grid ──────────────────────────────────────────────────── */}
      <main
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 lg:p-8"
        aria-label="TORII Landing Hub"
      >

        {/* ── Hero Pulse Card: 2×2 ─────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2">
          <HeroPulseCard />
        </div>

        {/* ── Workspace Launchpads: 2×2 ────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2">
          <WorkspaceCards />
        </div>

        {/* ── Section G Radar: full-width 4×1 ──────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <SectionGRadar refreshKey={radarRefreshKey} />
        </div>

        {/* ── Domain Showcase: full-width ───────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
          <DomainShowcase onSeedComplete={triggerRadarRefresh} />
        </div>

        {/* ── Metrics Well: 1×1 ────────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-1 lg:col-span-1">
          <MetricsWell />
        </div>

        {/* ── Footer info: 3×1 ─────────────────────────────────────────── */}
        <div
          className="col-span-1 md:col-span-1 lg:col-span-3 bg-[#e8ecf2] rounded-3xl p-5
                     shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]
                     flex items-center justify-between"
          aria-label="System information"
        >
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
              IBM watsonx Hackathon Build
            </p>
            <p className="text-sm text-slate-600 leading-relaxed">
              5 Omni-Issue domains · AI agent swarm · PII-safe audit trail · 34s avg resolution
            </p>
          </div>
          <div
            className="hidden lg:flex w-12 h-12 rounded-2xl bg-[#e8ecf2] items-center justify-center flex-shrink-0
                       shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]"
            aria-hidden="true"
          >
            <span className="text-2xl">🏦</span>
          </div>
        </div>

      </main>

      {/* ── Floating Copilot Orb (fixed, outside grid) ──────────────────── */}
      <CopilotOrb />
    </div>
  );
}
