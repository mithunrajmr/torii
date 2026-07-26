// frontend/src/pages/teller/TellerLogin.jsx
// Staff login screen for the teller/branch manager.
//
// Uses keyboard input (not the numeric keypad) — staff have a physical keyboard.
// Calls POST /api/auth/staff-login → receives TELLER JWT → stores in localStorage.
// Redirects to /teller/dashboard on success.
//
// Demo credentials (from authController STAFF_CREDENTIALS):
//   TELLER001 / torii2024
//   TELLER002 / torii2024
//   MANAGER01 / toriiMgr!

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

export default function TellerLogin() {
  const navigate = useNavigate();

  const [employeeId,    setEmployeeId]    = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    const stored = localStorage.getItem('teller_jwt');
    if (stored) {
      // Quick verify the token is not expired (JWT exp check without library)
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        if (payload.exp > Math.floor(Date.now() / 1000)) {
          navigate('/teller/dashboard', { replace: true });
        } else {
          localStorage.removeItem('teller_jwt');
        }
      } catch (_) {
        localStorage.removeItem('teller_jwt');
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setError('Please enter your Employee ID and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId.trim().toUpperCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'ERR_INVALID_CREDENTIALS') {
          setError('Invalid Employee ID or password. Please check your credentials.');
        } else {
          setError(data.message || 'Login failed. Please try again.');
        }
        return;
      }

      // Store JWT and staff info
      localStorage.setItem('teller_jwt', data.teller_jwt);
      localStorage.setItem('teller_name', data.name);
      localStorage.setItem('teller_role', data.role);

      navigate('/teller/dashboard', { replace: true });

    } catch (err) {
      setError('Connection error. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8ecf2] font-sans flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header Card */}
        <div className="neo-card p-8 text-center space-y-4">
          <div className="flex justify-center">
            <ToriiLogo variant="full" size="lg" showTagline={true} />
          </div>
          <div className="pt-2 border-t border-slate-300">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Staff Workstation Access
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="neo-card p-8">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
              Teller Authentication
            </h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">

            {/* Employee ID */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Employee ID
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => { setEmployeeId(e.target.value.toUpperCase()); setError(null); }}
                placeholder="e.g. TELLER001"
                autoComplete="username"
                disabled={loading}
                className="
                  w-full neo-inset rounded-xl px-4 py-3 text-sm font-mono text-slate-700
                  placeholder:text-slate-400 placeholder:font-sans outline-none uppercase
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  className="
                    w-full neo-inset rounded-xl px-4 py-3 pr-11 text-sm text-slate-700
                    placeholder:text-slate-400 outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !employeeId.trim() || !password.trim()}
              className="
                w-full py-3.5 rounded-2xl font-bold text-sm
                flex items-center justify-center gap-2
                bg-blue-600 hover:bg-blue-700 text-white
                shadow-lg shadow-blue-600/25
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-all
              "
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In to Workstation</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo credentials hint — only shown in dev */}
        {import.meta.env.DEV && (
          <div className="neo-card p-4 text-xs text-slate-500 space-y-1">
            <p className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Dev Credentials</p>
            <p><span className="font-mono font-bold text-slate-700">TELLER001</span> / torii2024</p>
            <p><span className="font-mono font-bold text-slate-700">MANAGER01</span> / toriiMgr!</p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          Protected by TORII Role-Based Access Control · Session valid for 8 hours
        </p>
      </div>
    </div>
  );
}
