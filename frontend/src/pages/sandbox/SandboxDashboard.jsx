// frontend/src/pages/sandbox/SandboxDashboard.jsx
// Master Bento Grid layout for the Mock CBS Sandbox control plane.
// 4-column Neo-Bento grid — canvas bg #e8ecf2, neumorphic shadows throughout.
//
// Grid layout (4 cols × 3 rows):
//   Row 1-2: PersonaSeeder  (col-span-2 row-span-2) | TxInjector (col-span-2 row-span-2)
//   Row 3:   LedgerInspector (col-span-4 row-span-2)
//   Row 5:   ChaosControl (col-span-2 row-span-1) | header stat cards (col-span-2)

import React, { useState } from 'react';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import PersonaSeeder from './components/PersonaSeeder.jsx';
import TxInjector from './components/TxInjector.jsx';
import LedgerInspector from './components/LedgerInspector.jsx';
import ChaosControl from './components/ChaosControl.jsx';

export default function SandboxDashboard() {
  // Shared toast state — components can push a notification up
  const [toast, setToast] = useState(null);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  return (
    <div className="min-h-screen bg-[#e8ecf2] font-sans text-slate-800">

      {/* ── Top Header Bar ──────────────────────────────────────────────── */}
      <header className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_4px_12px_rgba(37,99,235,0.5)]">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight leading-tight">
              CBS Sandbox Control Plane
            </h1>
            <p className="text-[10px] text-amber-400 font-semibold tracking-widest uppercase">
              Dev / Demo Mode Only
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold px-4 py-2 rounded-full">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Sandbox — Not Production Data</span>
        </div>
      </header>

      {/* ── Global Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl text-sm font-semibold shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] transition-all duration-300 ${
            toast.type === 'error'
              ? 'bg-red-100 text-red-700 border border-red-200'
              : toast.type === 'warn'
              ? 'bg-amber-100 text-amber-700 border border-amber-200'
              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          }`}
          role="alert"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}

      {/* ── Bento Grid ──────────────────────────────────────────────────── */}
      {/* 
        Layout on large screens (4-col):
          [PersonaSeeder 2×2] [TxInjector 2×2]
          [LedgerInspector ——————— 4×2 ————————]
          [ChaosControl 2×1] [spacer 2×1]
      */}
      <main
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6 lg:p-8"
        aria-label="Sandbox control panel"
      >

        {/* ── Persona Seeder: 2×2 hero card ─────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2">
          <PersonaSeeder onToast={showToast} />
        </div>

        {/* ── Custom Tx Injector: 2×2 ───────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-2">
          <TxInjector onToast={showToast} />
        </div>

        {/* ── Live Ledger Inspector: full-width 4×2 ─────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 row-span-2">
          <LedgerInspector onToast={showToast} />
        </div>

        {/* ── Chaos Control: 2×1 ───────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1">
          <ChaosControl onToast={showToast} />
        </div>

        {/* ── Info card: 2×1 ───────────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] flex flex-col justify-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">How to use</span>
          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex gap-2"><span className="text-blue-500 font-bold">1.</span> Seed a persona to load deterministic account + transaction data.</li>
            <li className="flex gap-2"><span className="text-blue-500 font-bold">2.</span> Use the kiosk at <span className="font-mono bg-slate-200 px-1 rounded">/kiosk</span> to test the proactive triage flow.</li>
            <li className="flex gap-2"><span className="text-blue-500 font-bold">3.</span> Inject transactions to trigger specific error codes on demand.</li>
            <li className="flex gap-2"><span className="text-blue-500 font-bold">4.</span> Enable Chaos to stress-test latency and timeout handling.</li>
            <li className="flex gap-2"><span className="text-blue-500 font-bold">5.</span> Use Global Reset to restore a clean state between demo runs.</li>
          </ul>
        </div>

      </main>
    </div>
  );
}
