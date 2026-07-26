// frontend/src/pages/teller/TellerAccounts.jsx
// Account management panel for tellers — full CRUD.
//
// Features:
//  • Search accounts by name or account number
//  • View all accounts in a table (pan_linked status, balance, email)
//  • Create new account (account_number, full_name, email, balance)
//  • Edit existing account (full_name, email, balance) via slide-in drawer
//  • account_number is immutable once created (displayed read-only in edit form)

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, X, Save, Loader2, AlertCircle,
  CheckCircle2, ShieldCheck, Edit3, ArrowLeft, RefreshCw,
} from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

// ── Auth helper (mirrors Dashboard pattern) ───────────────────────────────────
function getTellerAuthHeader() {
  const token = localStorage.getItem('teller_jwt');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function tellerFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...getTellerAuthHeader(),
    },
  });
}

// ── Drawer: Create / Edit account ────────────────────────────────────────────

function AccountDrawer({ mode, account, onClose, onSaved }) {
  // mode: 'create' | 'edit'
  const [form, setForm]           = useState({
    full_name: account?.full_name || '',
    email:     account?.email     || '',
    balance:   account?.balance   ?? '',
  });
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState(null);
  const [createdAccount,  setCreatedAccount]  = useState(null); // holds result after creation

  const handleChange = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body = mode === 'create'
        ? {
            full_name: form.full_name.trim(),
            email:     form.email.trim(),
            balance:   form.balance !== '' ? Number(form.balance) : 0,
          }
        : {
            full_name: form.full_name.trim(),
            email:     form.email.trim(),
            balance:   form.balance !== '' ? Number(form.balance) : undefined,
          };

      const url    = mode === 'create' ? '/api/teller/accounts' : `/api/teller/accounts/${account.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      const res  = await tellerFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Save failed.');
        return;
      }

      if (mode === 'create') {
        // Show the auto-assigned account number before closing
        setCreatedAccount(data);
        onSaved(data);
      } else {
        onSaved(data);
        onClose();
      }

    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Edit form field definitions (no account_number — read-only display only)
  const editFields = [
    { key: 'full_name', label: 'Full Name',          type: 'text',   placeholder: 'e.g. RAHUL VERMA',       hint: 'Stored in uppercase.' },
    { key: 'email',     label: 'Email Address',       type: 'email',  placeholder: 'e.g. rahul@example.com', hint: 'OTP will be sent to this address.' },
    { key: 'balance',   label: 'Account Balance (₹)', type: 'number', placeholder: '0',                      hint: 'Balance in Indian Rupees.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={createdAccount ? undefined : onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-[#e8ecf2] h-full overflow-y-auto flex flex-col shadow-2xl">

        {/* Drawer header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {mode === 'create' ? <Plus className="w-5 h-5 text-cyan-400" /> : <Edit3 className="w-5 h-5 text-cyan-400" />}
            <span className="font-bold text-sm uppercase tracking-wider">
              {mode === 'create' ? 'Create New Account' : 'Edit Account'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edit mode — show account number read-only at top */}
        {mode === 'edit' && account && (
          <div className="mx-6 mt-4 space-y-2">
            <div className="p-3 neo-inset rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Account Number</span>
              <span className="font-mono font-bold text-slate-800 text-sm">{account.account_number}</span>
            </div>
          </div>
        )}

        {/* ── SUCCESS state after creation ── */}
        {createdAccount ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base mb-1">Account Created!</p>
              <p className="text-xs text-slate-500 mb-4">The account number has been auto-assigned:</p>
              <div className="neo-inset rounded-xl px-6 py-4 inline-block">
                <p className="font-mono font-extrabold text-2xl text-blue-600 tracking-widest">
                  {createdAccount.account_number}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                Share this number with the customer. They can use it to log in at the kiosk.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
        /* ── FORM state ── */
        <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-4">

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {editFields.map(({ key, label, type, placeholder, hint }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {label}
              </label>
              <input
                type={type}
                value={form[key]}
                onChange={handleChange(key)}
                placeholder={placeholder}
                disabled={saving}
                className="w-full neo-inset rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none disabled:opacity-50"
                min={type === 'number' ? 0 : undefined}
                step={type === 'number' ? '0.01' : undefined}
              />
              {hint && <p className="text-[11px] text-slate-400 pl-1">{hint}</p>}
            </div>
          ))}

          {mode === 'create' && (
            <div className="p-3 neo-inset rounded-xl text-xs text-slate-500 flex items-start gap-2">
              <span className="text-base leading-none">🔢</span>
              <span>Account number will be <strong>auto-generated</strong> and shown after you save.</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="
                w-full py-3.5 rounded-2xl font-bold text-sm
                flex items-center justify-center gap-2
                bg-blue-600 hover:bg-blue-700 text-white
                shadow-lg shadow-blue-600/25
                disabled:opacity-40 disabled:cursor-not-allowed transition-all
              "
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span>Saving…</span></>
              ) : (
                <><Save className="w-4 h-4" /><span>{mode === 'create' ? 'Create Account' : 'Save Changes'}</span></>
              )}
            </button>
          </div>

        </form>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TellerAccounts() {
  const navigate = useNavigate();

  const [accounts,  setAccounts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [drawer,    setDrawer]    = useState(null);  // null | { mode: 'create' } | { mode: 'edit', account }

  // Auth guard
  useEffect(() => {
    const stored = localStorage.getItem('teller_jwt');
    if (!stored) { navigate('/teller/login', { replace: true }); return; }
    try {
      const payload = JSON.parse(atob(stored.split('.')[1]));
      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        localStorage.removeItem('teller_jwt');
        navigate('/teller/login', { replace: true });
      }
    } catch (_) {
      localStorage.removeItem('teller_jwt');
      navigate('/teller/login', { replace: true });
    }
  }, [navigate]);

  const fetchAccounts = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const url = q.trim() ? `/api/teller/accounts?search=${encodeURIComponent(q.trim())}` : '/api/teller/accounts';
      const res = await tellerFetch(url);
      if (res.status === 401) { navigate('/teller/login', { replace: true }); return; }
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.warn('[TellerAccounts] fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Initial load + debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchAccounts(search), search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [search, fetchAccounts]);

  const handleSaved = () => fetchAccounts(search);

  const staffName = localStorage.getItem('teller_name') || 'Staff Teller';

  return (
    <div className="min-h-screen bg-[#e8ecf2] font-sans text-slate-800 flex flex-col">

      {/* Top Navbar — mirrors Dashboard */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <ToriiLogo variant="icon" size="sm" />
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white">Account Management</h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Create · Edit · Manage</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>{staffName}</span>
          </div>
          <button
            onClick={() => navigate('/teller/dashboard')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Queue</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-4">

        {/* Toolbar */}
        <div className="neo-card p-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or account number…"
              className="w-full neo-inset rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => fetchAccounts(search)}
            className="neo-button p-2.5 rounded-xl text-slate-500 hover:text-blue-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setDrawer({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Account</span>
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
          <Users className="w-4 h-4" />
          <span>
            {loading ? 'Loading…' : `${accounts.length} account${accounts.length !== 1 ? 's' : ''}${search ? ' matching search' : ''}`}
          </span>
        </div>

        {/* Table */}
        <div className="neo-card overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Loading accounts…</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-sm">{search ? 'No accounts match your search.' : 'No accounts found.'}</p>
              <p className="text-xs text-slate-400 mt-1">Create the first account using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100/50">
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Account No.</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Balance</th>
                    <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">PAN</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((acc, i) => (
                    <tr
                      key={acc.id}
                      className={`border-b border-slate-200 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 font-bold">
                        {acc.account_number}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {acc.full_name || <span className="text-slate-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {acc.email || <span className="text-slate-400 italic">No email</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-slate-700">
                        ₹{Number(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {acc.pan_linked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Linked
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setDrawer({ mode: 'edit', account: acc })}
                          className="neo-button p-2 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                          title="Edit account"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help text */}
        <p className="text-center text-xs text-slate-400 pb-2">
          PAN linking is set only via the HITL approval flow · Account number cannot be changed after creation
        </p>

      </div>

      {/* Create / Edit Drawer */}
      {drawer && (
        <AccountDrawer
          mode={drawer.mode}
          account={drawer.account}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

    </div>
  );
}
