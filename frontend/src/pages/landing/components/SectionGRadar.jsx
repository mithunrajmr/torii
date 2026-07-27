// frontend/src/pages/landing/components/SectionGRadar.jsx
// Span 4x1: Proactive Interception Radar banner card.
// Polls GET /api/sandbox/ledger every 5 seconds.
// Idle state: calm green well. Alert state: pulsing amber banner with CTA.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, AlertTriangle, CheckCircle, Zap, RefreshCw } from 'lucide-react';

const POLL_INTERVAL_MS = 5000;

export default function SectionGRadar({ refreshKey = 0 }) {
  const navigate = useNavigate();
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [executing, setExecuting] = useState(false);
  const intervalRef = useRef(null);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/system/radar');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // /api/system/radar returns { failures: [...], activeCount: N }
      // Each failure: { account_number, name, error_code, amount, created_at, diagnosis }
      const active = Array.isArray(data.failures)
        ? data.failures
        : Array.isArray(data.activeFailures)
        ? data.activeFailures
        : [];

      setFailures(active);
      setLastChecked(new Date());
    } catch {
      // Network error during demo — keep last known state, don't crash
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + interval polling
  useEffect(() => {
    fetchLedger();
    intervalRef.current = setInterval(fetchLedger, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchLedger]);

  // Immediate refetch when parent increments refreshKey (e.g. after domain seed)
  useEffect(() => {
    if (refreshKey > 0) fetchLedger();
  }, [refreshKey, fetchLedger]);

  function handleExecuteFix() {
    if (!failures.length) return;
    const first = failures[0];
    const account = first.account_number ?? first.account ?? first.accountNumber ?? '1000000001';
    localStorage.setItem('target_account', account);
    setExecuting(true);
    setTimeout(() => {
      navigate('/kiosk');
    }, 300);
  }

  const hasFailures = failures.length > 0;
  const firstFailure = failures[0];

  return (
    <div
      className={[
        'w-full rounded-3xl p-6 transition-all duration-700',
        hasFailures
          ? 'bg-[#e8ecf2] shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] ring-2 ring-amber-400/60'
          : 'bg-[#e8ecf2] shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]',
      ].join(' ')}
      aria-live="polite"
      aria-label="Proactive interception radar"
      data-testid="section-g-radar"
    >
      {/* ── Card Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={[
              'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
              'shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]',
              hasFailures ? 'text-amber-500' : 'text-emerald-500',
            ].join(' ')}
            aria-hidden="true"
          >
            <Radar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Section G — Proactive Interception Radar
            </span>
            <p className="text-sm font-extrabold text-slate-800">
              {hasFailures ? '⚠️ Actionable Bottleneck Detected — Pre-Resolution Ready' : '🟢 System Radar Active'}
            </p>
          </div>
        </div>

        {/* Last-checked timestamp + manual refresh */}
        <button
          onClick={fetchLedger}
          disabled={loading}
          aria-label="Refresh radar"
          className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold
                     hover:text-slate-600 transition-colors focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg px-2 py-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {lastChecked ? lastChecked.toLocaleTimeString() : 'Checking…'}
        </button>
      </div>

      {/* ── Idle State ───────────────────────────────────────────────────── */}
      {!hasFailures && (
        <div
          className="bg-[#e8ecf2] rounded-2xl p-4 shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]
                     flex items-center gap-4"
          data-testid="radar-idle"
        >
          <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Zero unassisted customer roadblocks detected.
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring branch ledger for high-friction compliance failures · polling every 5s
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-bold text-emerald-600 tracking-wide">LIVE</span>
          </div>
        </div>
      )}

      {/* ── Alert State ──────────────────────────────────────────────────── */}
      {hasFailures && (
        <div className="flex flex-col lg:flex-row gap-4" data-testid="radar-alert">
          {/* Failure metadata inset well */}
          <div
            className="flex-1 bg-[#e8ecf2] rounded-2xl p-4
                       shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-2 min-w-0">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">
                  {failures.length} Active Failure{failures.length > 1 ? 's' : ''} Intercepted
                </p>

                {/* Show first failure details */}
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      <span className="font-semibold text-slate-400">Account:</span>{' '}
                      {firstFailure?.account_number ?? firstFailure?.account ?? '1000000001'}{' '}
                      {firstFailure?.name && `(${firstFailure.name})`}
                    </span>
                    <span>
                      <span className="font-semibold text-slate-400">Error:</span>{' '}
                      <code className="font-mono bg-amber-100 text-amber-800 px-1 rounded text-[10px]">
                        {firstFailure?.error_code ?? firstFailure?.errorCode ?? 'ERR_PAN_MISSING_OVER_50K'}
                      </code>
                    </span>
                  </div>
                  {(firstFailure?.amount || firstFailure?.diagnosis) && (
                    <p className="text-xs text-slate-500">
                      {firstFailure?.diagnosis ?? `AI Diagnosis: PAN Unlinked on ₹${(firstFailure.amount / 100).toLocaleString('en-IN')} transaction`}
                    </p>
                  )}
                </div>

                {/* All failures if more than 1 */}
                {failures.length > 1 && (
                  <p className="text-[10px] text-slate-400">
                    +{failures.length - 1} more failure{failures.length > 2 ? 's' : ''} in queue
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Execute Fix CTA */}
          <div className="flex items-center lg:items-stretch">
            <button
              onClick={handleExecuteFix}
              disabled={executing}
              data-testid="execute-fix-btn"
              aria-label="Execute agentic fix for detected failure"
              className="w-full lg:w-auto px-6 py-4 rounded-2xl bg-blue-600 text-white font-extrabold text-sm
                         shadow-[4px_4px_8px_rgba(37,99,235,0.4),-2px_-2px_6px_rgba(255,255,255,0.3)]
                         hover:bg-blue-700 active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
                         transition-all duration-200 focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-blue-600 whitespace-nowrap flex items-center gap-2"
            >
              {executing ? (
                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <Zap className="w-4 h-4" aria-hidden="true" />
              )}
              Execute Agentic Fix Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
