// frontend/src/pages/sandbox/components/LedgerInspector.jsx
// Bento Card (Span 4×2): Real-time inset table of all mock accounts.
// Polls GET /api/sandbox/ledger every 5 seconds.
// Includes "Global Factory Reset" CTA with confirmation modal.

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, RotateCcw, CheckCircle2, XCircle, AlertTriangle, Ticket } from 'lucide-react';

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtBalance(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function ErrorBadge({ code }) {
  if (!code) return <span className="text-slate-400 text-[11px]">—</span>;
  const isKnown = code === 'ERR_PAN_MISSING_OVER_50K';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isKnown
          ? 'bg-amber-500/10 text-amber-700 border border-amber-200'
          : 'bg-rose-500/10 text-rose-700 border border-rose-200'
      }`}
    >
      {code}
    </span>
  );
}

function KycBadge({ panLinked }) {
  return panLinked ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
      Linked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500">
      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
      Unlinked
    </span>
  );
}

// ── Confirmation Modal ────────────────────────────────────────────────────────
function ResetConfirmModal({ onConfirm, onCancel }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      aria-describedby="reset-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <div className="bg-[#e8ecf2] rounded-3xl p-8 shadow-[16px_16px_32px_#cbced1,-16px_-16px_32px_#ffffff] max-w-sm w-full mx-4 flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#e8ecf2] flex items-center justify-center shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] text-rose-500 shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 id="reset-modal-title" className="text-base font-extrabold text-slate-800">
              Global Factory Reset
            </h3>
            <p id="reset-modal-desc" className="text-xs text-slate-500 mt-1 leading-relaxed">
              This will truncate <strong>transactions</strong>, <strong>teller_tickets</strong>, and{' '}
              <strong>audit_logs</strong>, reset account balances to baseline values, and flush all
              Redis session keys. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-[#e8ecf2] text-slate-600 text-sm font-bold
              shadow-[5px_5px_10px_#cbced1,-5px_-5px_10px_#ffffff]
              hover:shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff]
              active:shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            autoFocus
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-sm font-bold
              shadow-[0_6px_16px_rgba(220,38,38,0.35)] hover:bg-rose-500
              active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            Yes, Reset Everything
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function LedgerInspector({ onToast }) {
  const [ledger, setLedger]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting]     = useState(false);

  const fetchLedger = useCallback(async () => {
    try {
      const res = await fetch('/api/sandbox/ledger');
      if (!res.ok) return;
      const data = await res.json();
      setLedger(data.ledger ?? []);
      setLastRefreshed(new Date());
    } catch {
      // Non-fatal — keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    fetchLedger();
    const id = setInterval(fetchLedger, 5000);
    return () => clearInterval(id);
  }, [fetchLedger]);

  async function handleReset() {
    setShowResetModal(false);
    setResetting(true);
    try {
      const res = await fetch('/api/sandbox/reset', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Reset failed');
      onToast?.(`Factory reset complete — ${data.cleared.accounts_reset} accounts restored.`);
      fetchLedger();
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      {showResetModal && (
        <ResetConfirmModal
          onConfirm={handleReset}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      <div
        className="h-full bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] flex flex-col gap-5"
        aria-label="Live Ledger Inspector"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Live Ledger</span>
            <h2 className="text-base font-extrabold text-slate-800 mt-0.5">Account State Inspector</h2>
          </div>

          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={fetchLedger}
              aria-label="Refresh ledger"
              disabled={loading}
              className="w-8 h-8 rounded-xl bg-[#e8ecf2] flex items-center justify-center
                shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff]
                hover:shadow-[5px_5px_10px_#cbced1,-5px_-5px_10px_#ffffff]
                active:shadow-[inset_2px_2px_5px_#cbced1,inset_-2px_-2px_5px_#ffffff]
                transition-all duration-200 text-slate-500
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]
                disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>

            {/* Global Factory Reset CTA */}
            <button
              onClick={() => setShowResetModal(true)}
              disabled={resetting}
              aria-label="Global factory reset"
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                bg-rose-600 text-white text-xs font-bold
                shadow-[0_4px_12px_rgba(220,38,38,0.3)] hover:bg-rose-500
                active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
                transition-all duration-200 disabled:opacity-50
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {resetting ? 'Resetting…' : 'Global Factory Reset'}
            </button>
          </div>
        </div>

        {/* Inset Table Well */}
        <div
          className="flex-1 bg-[#e8ecf2] rounded-2xl overflow-auto shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]"
          role="region"
          aria-label="Account ledger table"
        >
          {loading ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" aria-hidden="true" />
              Loading ledger…
            </div>
          ) : ledger.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
              No accounts found. Seed a persona to get started.
            </div>
          ) : (
            <table className="w-full text-xs min-w-[640px]" aria-label="Mock account ledger">
              <thead>
                <tr className="text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/60">
                  <th className="text-left px-5 py-3">Account No.</th>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-center px-4 py-3">PAN Status</th>
                  <th className="text-center px-4 py-3">
                    <span className="flex items-center justify-center gap-1">
                      <Ticket className="w-3 h-3" aria-hidden="true" />
                      Tickets
                    </span>
                  </th>
                  <th className="text-left px-4 py-3">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      i % 2 === 0 ? '' : 'bg-slate-100/30'
                    } hover:bg-blue-500/5`}
                  >
                    <td className="px-5 py-3 font-mono font-bold text-slate-700">
                      {row.account_number}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{row.full_name}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                      {fmtBalance(row.balance)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <KycBadge panLinked={row.pan_linked} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.active_tickets > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-200">
                          {row.active_tickets}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ErrorBadge code={row.latest_error_code} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-400 text-right -mt-2">
          Auto-refreshes every 5 seconds · {ledger.length} account{ledger.length !== 1 ? 's' : ''}
        </p>
      </div>
    </>
  );
}
