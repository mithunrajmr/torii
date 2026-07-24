// frontend/src/pages/kiosk/KioskLogin.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, RotateCcw, ArrowRight, Lock, KeyRound, AlertCircle } from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

export default function KioskLogin() {
  const navigate = useNavigate();

  // Mode: 'ACCOUNT' | 'OTP'
  const [mode, setMode] = useState('ACCOUNT');
  const [accountNumber, setAccountNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(300);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Masking state for account input & OTP
  const [maskedDigitsAccount, setMaskedDigitsAccount] = useState([]);
  const [maskedDigitsOtp, setMaskedDigitsOtp] = useState([]);
  const maskTimers = useRef({});

  // Countdown timer for lockout
  useEffect(() => {
    let interval;
    if (isLocked && lockCountdown > 0) {
      interval = setInterval(() => {
        setLockCountdown((prev) => prev - 1);
      }, 1000);
    } else if (lockCountdown === 0) {
      setIsLocked(false);
      setLockCountdown(300);
    }
    return () => clearInterval(interval);
  }, [isLocked, lockCountdown]);

  // Handle digit press on keypad
  const handleDigitPress = (digit) => {
    if (isLocked || loading) return;

    if (mode === 'ACCOUNT') {
      if (accountNumber.length >= 10) return;
      const nextNum = accountNumber + digit;
      setAccountNumber(nextNum);
      setError(null);

      // Mask after 500ms
      const index = nextNum.length - 1;
      setMaskedDigitsAccount((prev) => {
        const copy = [...prev];
        copy[index] = false;
        return copy;
      });
      if (maskTimers.current[`acc_${index}`]) clearTimeout(maskTimers.current[`acc_${index}`]);
      maskTimers.current[`acc_${index}`] = setTimeout(() => {
        setMaskedDigitsAccount((prev) => {
          const copy = [...prev];
          copy[index] = true;
          return copy;
        });
      }, 500);
    } else {
      // Mode === 'OTP'
      if (otp.length >= 6) return;
      const nextOtp = otp + digit;
      setOtp(nextOtp);
      setError(null);

      const index = nextOtp.length - 1;
      setMaskedDigitsOtp((prev) => {
        const copy = [...prev];
        copy[index] = false;
        return copy;
      });
      if (maskTimers.current[`otp_${index}`]) clearTimeout(maskTimers.current[`otp_${index}`]);
      maskTimers.current[`otp_${index}`] = setTimeout(() => {
        setMaskedDigitsOtp((prev) => {
          const copy = [...prev];
          copy[index] = true;
          return copy;
        });
      }, 500);
    }
  };

  // Backspace digit
  const handleBackspace = () => {
    if (isLocked || loading) return;
    if (mode === 'ACCOUNT') {
      setAccountNumber((prev) => prev.slice(0, -1));
    } else {
      setOtp((prev) => prev.slice(0, -1));
    }
    setError(null);
  };

  // Clear all
  const handleClear = () => {
    if (isLocked || loading) return;
    if (mode === 'ACCOUNT') {
      setAccountNumber('');
      setMaskedDigitsAccount([]);
    } else {
      setOtp('');
      setMaskedDigitsOtp([]);
    }
    setError(null);
  };

  // Request OTP from API
  const handleRequestOTP = async () => {
    if (accountNumber.length !== 10) {
      setError('Please enter a valid 10-digit Account Number.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: accountNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'ERR_ACCOUNT_NOT_FOUND') {
          setError('Account Number not found in Central Banking System.');
        } else {
          setError(data.message || 'Unable to request OTP. Please try again.');
        }
        return;
      }

      setMaskedEmail(data.masked_email || 'your registered email');
      setAttemptsRemaining(data.attempts_remaining || 3);
      setMode('OTP');
    } catch (err) {
      setError('Connection error. Please contact branch staff.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP with API
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_number: accountNumber, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'ERR_OTP_EXPIRED') {
          setError('OTP code expired. Please request a new code.');
        } else if (data.error === 'ERR_MAX_ATTEMPTS_EXCEEDED') {
          setIsLocked(true);
          setLockCountdown(300);
          setError('Maximum security attempts exceeded. Account locked for 5 minutes.');
        } else if (data.error === 'ERR_INVALID_OTP') {
          setAttemptsRemaining(data.attempts_remaining);
          setError(`Invalid OTP. ${data.attempts_remaining} attempt(s) remaining.`);
          setOtp('');
          setMaskedDigitsOtp([]);
        } else {
          setError(data.message || 'OTP verification failed.');
        }
        return;
      }

      sessionStorage.setItem('kiosk_jwt', data.jwt);
      navigate('/kiosk/triage', {
        state: { jwt: data.jwt, failedTxSummary: data.failed_tx_summary },
      });
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8ecf2] p-6 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8">
        
        {/* Left Side: Information & Branding Bento Card */}
        <div className="md:col-span-5 neo-card p-8 flex flex-col justify-between">
          <div>
            {/* Torii Brand Header */}
            <div className="mb-6 pb-6 border-b border-slate-300">
              <ToriiLogo variant="full" size="lg" showTagline={true} />
            </div>

            <div className="space-y-4">
              <div className="neo-inset p-4 rounded-2xl">
                <div className="flex items-start space-x-3">
                  <KeyRound className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">Self-Service Verification</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {mode === 'ACCOUNT'
                        ? 'Enter your 10-digit Account Number to initiate automated compliance diagnosis.'
                        : `OTP sent to ${maskedEmail}. Enter the 6-digit code below.`}
                    </p>
                  </div>
                </div>
              </div>

              {isLocked && (
                <div className="bg-red-50 text-red-700 p-4 rounded-2xl border border-red-200 flex items-start space-x-3">
                  <Lock className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Security Lockout Active</h4>
                    <p className="text-xs mt-1">Try again in {Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-slate-300 pt-4">
            <p className="text-xs text-slate-400 font-mono text-center">
              Secured with watsonx.governance PII Masking
            </p>
          </div>
        </div>

        {/* Right Side: Keypad & Input Bento Card */}
        <div className="md:col-span-7 neo-card p-8 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {mode === 'ACCOUNT' ? 'Step 1 of 2: Account Lookup' : 'Step 2 of 2: Enter OTP'}
              </h2>
              {mode === 'OTP' && (
                <button
                  onClick={() => {
                    setMode('ACCOUNT');
                    setOtp('');
                    setError(null);
                  }}
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Change Account
                </button>
              )}
            </div>

            {/* Display Input Well */}
            <div className="neo-inset p-5 rounded-2xl text-center min-h-[72px] flex items-center justify-center relative mb-6">
              {mode === 'ACCOUNT' ? (
                accountNumber.length === 0 ? (
                  <span className="text-slate-400 text-sm tracking-widest">Enter 10-Digit Account Number...</span>
                ) : (
                  <div className="flex justify-center space-x-2 font-mono text-xl font-extrabold text-blue-600">
                    {accountNumber.split('').map((char, i) => (
                      <span key={i} className="w-6 text-center">
                        {maskedDigitsAccount[i] ? '•' : char}
                      </span>
                    ))}
                  </div>
                )
              ) : otp.length === 0 ? (
                <span className="text-slate-400 text-sm tracking-widest">Enter 6-Digit OTP...</span>
              ) : (
                <div className="flex justify-center space-x-3 font-mono text-2xl font-extrabold text-blue-600">
                  {otp.split('').map((char, i) => (
                    <span key={i} className="w-8 text-center border-b-2 border-blue-500 pb-1">
                      {maskedDigitsOtp[i] ? '•' : char}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Extruded Neo-Bento Numeric Keypad */}
            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleDigitPress(digit)}
                  disabled={isLocked || loading}
                  className="neo-button h-14 rounded-2xl text-xl font-extrabold text-slate-700 transition-all flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}

              <button
                onClick={handleClear}
                disabled={isLocked || loading}
                className="neo-button h-14 rounded-2xl text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-center"
              >
                Clear
              </button>

              <button
                onClick={() => handleDigitPress('0')}
                disabled={isLocked || loading}
                className="neo-button h-14 rounded-2xl text-xl font-extrabold text-slate-700 flex items-center justify-center"
              >
                0
              </button>

              <button
                onClick={handleBackspace}
                disabled={isLocked || loading}
                className="neo-button h-14 rounded-2xl text-slate-600 flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Submit Action Button */}
          {mode === 'ACCOUNT' ? (
            <button
              onClick={handleRequestOTP}
              disabled={accountNumber.length !== 10 || loading || isLocked}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                accountNumber.length === 10 && !loading && !isLocked
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30 cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-400'
              }`}
            >
              <span>{loading ? 'Validating Account...' : 'Send Authentication OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || loading || isLocked}
              className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center space-x-2 ${
                otp.length === 6 && !loading && !isLocked
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30 cursor-pointer'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-400'
              }`}
            >
              <span>{loading ? 'Verifying OTP...' : 'Verify OTP & Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

        </div>

      </div>
    </div>
  );
}
