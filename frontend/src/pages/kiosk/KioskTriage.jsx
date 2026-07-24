// frontend/src/pages/kiosk/KioskTriage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  QrCode,
  Mic,
  Clock,
  LogOut,
  Sparkles,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

export default function KioskTriage() {
  const location = useLocation();
  const navigate = useNavigate();

  const jwt = location.state?.jwt || sessionStorage.getItem('kiosk_jwt');
  const failedTxSummary = location.state?.failedTxSummary || null;

  const [qrUrl, setQrUrl] = useState(null);
  const [deepLink, setDeepLink] = useState('');
  const [countdown, setCountdown] = useState(45);
  const [voiceActive, setVoiceActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  // Helper to reset session and navigate to login
  const resetKiosk = async (reason = 'USER_RESET') => {
    try {
      if (jwt) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ reason }),
        });
      }
    } catch (e) {
      console.warn('Failed to delete session on backend', e);
    } finally {
      sessionStorage.removeItem('kiosk_jwt');
      navigate('/kiosk/login', { replace: true });
    }
  };

  // Auth guard & QR code generation
  useEffect(() => {
    if (!jwt) {
      navigate('/kiosk/login', { replace: true });
      return;
    }

    // Fetch QR token from backend
    const fetchQR = async () => {
      try {
        const res = await fetch('/api/auth/qr/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to generate QR token');
        }

        const data = await res.json();
        setDeepLink(data.deep_link_url);

        // Render QR Code onto canvas
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, data.deep_link_url, {
            width: 240,
            margin: 2,
            color: {
              dark: '#1e293b',
              light: '#ffffff',
            },
          });
        }
      } catch (err) {
        console.error('[KioskTriage] QR generation error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchQR();
  }, [jwt, navigate]);

  // Session validation loop
  useEffect(() => {
    if (!jwt) return;

    const validateSession = async () => {
      try {
        const res = await fetch('/api/auth/session/validate', {
          headers: { Authorization: `Bearer ${jwt}` },
        });

        if (res.status === 401) {
          resetKiosk('SESSION_EXPIRED');
        }
      } catch (e) {
        // Network error - continue
      }
    };

    const interval = setInterval(validateSession, 5000);
    return () => clearInterval(interval);
  }, [jwt]);

  // 45-second auto-reset countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          resetKiosk('QR_TIMEOUT');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Simulate TTS voice playback end after 6 seconds
  useEffect(() => {
    const voiceTimer = setTimeout(() => {
      setVoiceActive(false);
    }, 6000);
    return () => clearTimeout(voiceTimer);
  }, []);

  return (
    <div className="min-h-screen bg-[#e8ecf2] p-6 font-sans text-slate-800 flex items-center justify-center">
      <div className="w-full max-w-6xl space-y-6">
        
        {/* Header Bar */}
        <div className="neo-card p-4 px-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <ToriiLogo variant="horizontal" size="sm" showTagline={true} />
            <div className="h-6 w-px bg-slate-300 mx-2" />
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Active Session
              </span>
            </div>
          </div>

          <button
            onClick={() => resetKiosk('MANUAL_NAVIGATE')}
            className="neo-button px-4 py-2 text-xs font-bold text-red-600 hover:text-red-700 flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>End Session</span>
          </button>
        </div>

        {/* Main Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          
          {/* Proactive Diagnosis / Welcome Bento Card */}
          <div className="md:col-span-2 neo-card p-6 flex flex-col justify-between">
            {failedTxSummary ? (
              <div>
                <div className="flex items-center space-x-2 text-amber-600 mb-3">
                  <AlertTriangle className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Compliance Hold Detected</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Deposit of ₹{failedTxSummary.most_recent_amount?.toLocaleString('en-IN')} On Hold
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  Your transaction attempted at{' '}
                  <span className="font-semibold">
                    {new Date(failedTxSummary.most_recent_created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>{' '}
                  was flagged due to missing mandatory PAN verification for transactions over ₹50,000.
                </p>
                <div className="neo-inset p-4 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">Required Action:</p>
                  <p>Scan the QR code to upload your PAN card via mobile and submit for instant 1-click Teller approval.</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2 text-blue-600 mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                  <span className="text-xs font-bold uppercase tracking-wider">Account Active</span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">
                  Welcome to Autonomous Triage
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  No active transaction blocks were found on your account. You can scan the QR code to perform document updates or request support.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center space-x-2 text-xs text-slate-500">
              <Sparkles className="w-4 h-4 text-blue-500" />
              <span>AI Agent Swarm ready to process mobile document submission.</span>
            </div>
          </div>

          {/* QR Code Hero Cell (Spans 2 columns & 2 rows on desktop) */}
          <div className="md:col-span-2 lg:col-span-2 row-span-2 neo-card p-8 flex flex-col items-center justify-center text-center">
            <div className="flex items-center space-x-2 text-blue-600 mb-4">
              <Smartphone className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Mobile Handoff</span>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">Scan with Smartphone</h3>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">
              Opens secure PWA document uploader. No app installation required.
            </p>

            <div className="neo-inset p-4 rounded-3xl bg-white shadow-inner mb-6">
              <canvas ref={canvasRef} className="rounded-2xl" />
            </div>

            <div className="neo-card px-4 py-2 rounded-xl text-xs font-mono text-slate-600 max-w-xs truncate">
              {deepLink || 'Generating session token...'}
            </div>
          </div>

          {/* Voice Visualiser Bento Card */}
          <div className="neo-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Voice Guidance</span>
              <Mic className={`w-4 h-4 ${voiceActive ? 'text-blue-600 animate-pulse' : 'text-slate-400'}`} />
            </div>

            <div className="my-4 flex items-center justify-center space-x-2 h-12">
              {voiceActive ? (
                <>
                  <div className="w-2 bg-blue-600 rounded-full animate-soundwave-1" />
                  <div className="w-2 bg-blue-600 rounded-full animate-soundwave-2" />
                  <div className="w-2 bg-blue-600 rounded-full animate-soundwave-3" />
                  <div className="w-2 bg-blue-600 rounded-full animate-soundwave-4" />
                  <div className="w-2 bg-blue-600 rounded-full animate-soundwave-5" />
                </>
              ) : (
                <span className="text-xs text-slate-400 font-medium">Voice message complete</span>
              )}
            </div>

            <p className="text-xs text-slate-500 text-center">
              {voiceActive ? 'Playing audio diagnosis...' : 'Audio complete'}
            </p>
          </div>

          {/* 45-Second Countdown Bento Card */}
          <div className="neo-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kiosk Auto-Reset</span>
              <Clock className="w-4 h-4 text-slate-500" />
            </div>

            <div className="text-center my-2">
              <span
                className={`text-4xl font-extrabold font-mono transition-colors ${
                  countdown <= 10 ? 'text-blue-600 text-red-500 animate-pulse' : 'text-slate-800'
                }`}
              >
                {countdown}s
              </span>
            </div>

            <p className="text-xs text-slate-400 text-center">
              Session clears automatically when timer expires for privacy.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
