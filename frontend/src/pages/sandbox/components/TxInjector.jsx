// frontend/src/pages/sandbox/components/TxInjector.jsx
// Bento Card (Span 2×2): Inset form for injecting custom synthetic transactions.
// Wired to POST /api/sandbox/transaction.
// Supports custom error codes and amounts — makes tx immediately visible to kiosk triage.

import React, { useState } from 'react';
import { Syringe, ChevronDown } from 'lucide-react';

// Pre-defined error code shortcuts for the demo
const QUICK_ERROR_CODES = [
  { value: 'ERR_PAN_MISSING_OVER_50K', label: 'PAN Missing >50K' },
  { value: 'ERR_KYC_EXPIRED',          label: 'KYC Expired' },
  { value: 'ERR_ACCOUNT_FROZEN',       label: 'Account Frozen' },
  { value: 'ERR_DAILY_LIMIT',          label: 'Daily Limit Hit' },
  { value: '',                         label: 'No error (success tx)' },
];

const ACCOUNT_NUMBERS = [
  '1000000001', '1000000002', '1000000003',
  '1000000004', '1000000005', '1000000006',
];

// ── Shared inset input class ──────────────────────────────────────────────────
const insetInput =
  'w-full bg-[#e8ecf2] rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 ' +
  'shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] ' +
  'outline-none focus:ring-2 focus:ring-blue-500/50 ' +
  'placeholder-slate-400 transition-all duration-150';

const insetSelect =
  'w-full bg-[#e8ecf2] rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 ' +
  'shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] ' +
  'outline-none focus:ring-2 focus:ring-blue-500/50 ' +
  'appearance-none cursor-pointer transition-all duration-150';

export default function TxInjector({ onToast }) {
  const [accountNumber, setAccountNumber] = useState('1000000001');
  const [amount, setAmount]               = useState('');
  const [errorCode, setErrorCode]         = useState('ERR_PAN_MISSING_OVER_50K');
  const [customError, setCustomError]     = useState('');
  const [status, setStatus]               = useState('FAILED');
  const [submitting, setSubmitting]       = useState(false);
  const [lastResult, setLastResult]       = useState(null);

  // Effective error code: prefer custom input if filled
  const effectiveErrorCode = customError.trim() || errorCode || null;

  async function handleSubmit(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      onToast?.('Amount must be a positive number.', 'error');
      return;
    }

    setSubmitting(true);
    setLastResult(null);
    try {
      const res = await fetch('/api/sandbox/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_number: accountNumber,
          amount: parsedAmount,
          error_code: effectiveErrorCode,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Injection failed');
      setLastResult(data.transaction);
      onToast?.(
        `✓ Injected ₹${parsedAmount.toLocaleString('en-IN')} tx${effectiveErrorCode ? ` [${effectiveErrorCode}]` : ''} on account ${accountNumber}`
      );
      setAmount('');
      setCustomError('');
    } catch (err) {
      onToast?.(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="h-full bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] flex flex-col gap-5"
      aria-label="Custom Transaction Injector"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Tx Injector</span>
          <h2 className="text-base font-extrabold text-slate-800 mt-0.5">Custom Transaction Builder</h2>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" aria-hidden="true" />
      </div>

      <p className="text-xs text-slate-500 leading-relaxed -mt-2">
        Inject a synthetic transaction to trigger specific error codes and test proactive kiosk triage.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1" noValidate>

        {/* Account Number */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-account" className="text-xs font-semibold text-slate-600">
            Target Account
          </label>
          <div className="relative">
            <select
              id="tx-account"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={insetSelect}
              aria-label="Select target account number"
            >
              {ACCOUNT_NUMBERS.map((num) => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-amount" className="text-xs font-semibold text-slate-600">
            Amount (₹)
          </label>
          <input
            id="tx-amount"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 75000"
            required
            className={insetInput}
            aria-label="Transaction amount in rupees"
          />
        </div>

        {/* Error Code — quick picker */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-error-code" className="text-xs font-semibold text-slate-600">
            Error Code (quick select)
          </label>
          <div className="relative">
            <select
              id="tx-error-code"
              value={errorCode}
              onChange={(e) => { setErrorCode(e.target.value); setCustomError(''); }}
              className={insetSelect}
              aria-label="Select predefined error code"
            >
              {QUICK_ERROR_CODES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown
              className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Custom error code override */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-custom-error" className="text-xs font-semibold text-slate-600">
            Custom Error Code <span className="text-slate-400 font-normal">(overrides quick select)</span>
          </label>
          <input
            id="tx-custom-error"
            type="text"
            value={customError}
            onChange={(e) => setCustomError(e.target.value.toUpperCase())}
            placeholder="e.g. ERR_CUSTOM_CODE"
            className={insetInput}
            aria-label="Custom error code, overrides quick select if filled"
          />
        </div>

        {/* Status toggle */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-slate-600" id="tx-status-label">
            Transaction Status
          </span>
          <div
            className="bg-[#e8ecf2] rounded-xl p-1 shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] flex gap-1"
            role="radiogroup"
            aria-labelledby="tx-status-label"
          >
            {['FAILED', 'SUCCESS'].map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={status === s}
                onClick={() => setStatus(s)}
                className={[
                  'flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                  status === s
                    ? 'bg-[#e8ecf2] text-blue-600 shadow-[inset_2px_2px_5px_#cbced1,inset_-2px_-2px_5px_#ffffff]'
                    : 'text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-auto flex items-center justify-center gap-2 py-3 rounded-xl
            bg-blue-600 text-white text-sm font-bold
            shadow-[0_6px_16px_rgba(37,99,235,0.35)] hover:bg-blue-500
            active:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.2)]
            transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[#e8ecf2]"
        >
          <Syringe className="w-4 h-4" aria-hidden="true" />
          {submitting ? 'Injecting…' : 'Inject Transaction'}
        </button>
      </form>

      {/* Last Result Well */}
      {lastResult && (
        <div
          className="bg-[#e8ecf2] rounded-2xl p-4 shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff] text-xs space-y-1"
          aria-label="Last injected transaction result"
          aria-live="polite"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
            Last Injection Result
          </span>
          <div className="flex justify-between">
            <span className="text-slate-500">Tx ID</span>
            <span className="font-mono text-slate-700 text-[10px]">{lastResult.id?.slice(0, 12)}…</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Amount</span>
            <span className="font-bold text-slate-800">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(lastResult.amount)}
            </span>
          </div>
          {lastResult.error_code && (
            <div className="flex justify-between">
              <span className="text-slate-500">Error Code</span>
              <span className="font-mono font-bold text-amber-700">{lastResult.error_code}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
