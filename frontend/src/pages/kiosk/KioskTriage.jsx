// frontend/src/pages/kiosk/KioskTriage.jsx
//
// Session 4: Added voice layer on top of the text-first design from Session 3.
//   - VoiceAssistant TTS speaks faqAnswer after it's displayed
//   - SpeechRecognition mic button transcribes speech → feeds submitQuery
//   - Both degrade gracefully if browser doesn't support them
//
// Session 5:
//   - Session extended to 30 min; inactivity timer logs out after 5 min of no UI interaction
//   - Heartbeat refreshes Redis TTL on every ping so active sessions never expire mid-use
//   - QR expiry no longer logs out — shows "Regenerate QR" button instead
//   - QRCodeGenerator key prop forces fresh countdown whenever a new QR is fetched

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  LogOut,
  Send,
  Loader2,
  MessageCircle,
  QrCode,
  Smartphone,
  ChevronRight,
  Mic,
  MicOff,
  RefreshCw,
} from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';
import QRCodeGenerator from '../../components/QRCodeGenerator.jsx';
import VoiceAssistant from '../../components/VoiceAssistant.jsx';

// ── Quick-action suggestion chips ─────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: 'FD interest rates',     query: 'What is the current FD interest rate?' },
  { label: 'Block lost card',       query: 'How do I block my lost debit card?' },
  { label: 'Branch hours',          query: 'What are the branch working hours?' },
  { label: 'Home loan rates',       query: 'What is the current home loan interest rate?' },
  { label: 'Minimum balance',       query: 'What is the minimum balance requirement?' },
  { label: 'NEFT timings',          query: 'What are the NEFT processing timings?' },
  { label: 'Cheque bounce charges', query: 'What happens if my cheque bounces?' },
  { label: 'KYC documents',         query: 'Which documents are accepted for full KYC?' },
];

// Inactivity timeout: log out after 5 minutes of no user interaction
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export default function KioskTriage() {
  const location = useLocation();
  const navigate = useNavigate();

  const jwt             = location.state?.jwt || sessionStorage.getItem('kiosk_jwt');
  const failedTxSummary = location.state?.failedTxSummary || null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [inputText,    setInputText]    = useState('');
  const [isLoading,    setIsLoading]    = useState(false);
  const [answer,       setAnswer]       = useState(null);   // { text, intent, showQR }
  const [ttsText,      setTtsText]      = useState(null);   // drives VoiceAssistant
  const [deepLink,     setDeepLink]     = useState('');
  const [qrKey,        setQrKey]        = useState(0);      // bumped to reset QR countdown
  const [showQR,       setShowQR]       = useState(false);
  const [qrExpired,    setQrExpired]    = useState(false);  // QR expired but user stays logged in
  const [qrLoading,    setQrLoading]    = useState(false);
  const [isListening,  setIsListening]  = useState(false);  // mic active
  const [micSupported, setMicSupported] = useState(false);  // browser support flag

  const inputRef         = useRef(null);
  const recognitionRef   = useRef(null);
  const inactivityTimer  = useRef(null);

  // ── Inactivity timeout ─────────────────────────────────────────────────────
  // Reset timer on any user interaction. Auto-logout after INACTIVITY_TIMEOUT_MS.
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      resetKiosk('INACTIVITY_TIMEOUT');
    }, INACTIVITY_TIMEOUT_MS);
  }, []); // eslint-disable-line

  // Attach activity listeners (mouse, touch, keyboard)
  useEffect(() => {
    if (!jwt) return;
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handler = () => resetInactivityTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer(); // start timer immediately
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [jwt, resetInactivityTimer]);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!jwt) navigate('/kiosk/login', { replace: true });
  }, [jwt, navigate]);

  // ── If PAN issue pre-detected at login, immediately fetch QR ──────────────
  useEffect(() => {
    if (failedTxSummary && jwt) fetchQRCode();
  }, [failedTxSummary, jwt]); // eslint-disable-line

  // ── Session heartbeat — refreshes Redis TTL so active sessions stay alive ──
  useEffect(() => {
    if (!jwt) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session/validate', {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        // Only hard-logout on 401 — network errors are ignored (blip tolerance)
        if (res.status === 401) resetKiosk('SESSION_EXPIRED');
      } catch (_) { /* network blip — ignore, inactivity timer handles true abandonment */ }
    }, 60000); // ping every 60s (was 10s) to reduce noise; sufficient for 30-min TTL refresh
    return () => clearInterval(interval);
  }, [jwt]); // eslint-disable-line

  // ── SpeechRecognition setup ────────────────────────────────────────────────
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    setMicSupported(true);
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) {
        setInputText(transcript);
        // Auto-submit after a short delay so the user sees what was captured
        setTimeout(() => submitQuery(transcript), 300);
      }
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      console.warn('[KioskTriage] SpeechRecognition error:', e.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []); // eslint-disable-line

  // ── Helpers ────────────────────────────────────────────────────────────────
  const resetKiosk = async (reason = 'USER_RESET') => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    try {
      if (jwt) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ reason }),
        });
      }
    } catch (_) { /* ignore */ } finally {
      sessionStorage.removeItem('kiosk_jwt');
      navigate('/kiosk/login', { replace: true });
    }
  };

  const fetchQRCode = async () => {
    setQrLoading(true);
    setQrExpired(false);
    try {
      const res = await fetch('/api/auth/qr/generate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) throw new Error('QR generation failed');
      const data = await res.json();
      setDeepLink(data.deep_link_url);
      setQrKey((k) => k + 1); // force QRCodeGenerator to remount with fresh countdown
      setShowQR(true);
    } catch (err) {
      console.error('[KioskTriage] QR error:', err);
    } finally {
      setQrLoading(false);
    }
  };

  // Called by QRCodeGenerator when the 45s countdown reaches 0.
  // Does NOT log out — shows a "Regenerate" button so the user stays in session.
  const handleQRExpired = () => {
    setQrExpired(true);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTtsText(null); // stop any current TTS before listening
      window.speechSynthesis?.cancel();
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const submitQuery = async (queryText) => {
    const q = (queryText || inputText).trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    setAnswer(null);
    setTtsText(null);

    try {
      const res = await fetch('/api/kiosk/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ query: q, language: 'auto' }),
      });

      if (res.status === 401) { resetKiosk('SESSION_EXPIRED'); return; }

      const data = await res.json();

      if (data.showQR && !deepLink) fetchQRCode();

      const answerText =
        data.faqAnswer || data.voiceResponse || 'A teller at the counter will be happy to help you.';

      setAnswer({ text: answerText, intent: data.intent, showQR: data.showQR });

      // Trigger TTS — VoiceAssistant speaks the answer aloud
      setTtsText(answerText);

    } catch (err) {
      console.error('[KioskTriage] Query error:', err);
      const fallback = "Sorry, I'm having trouble right now. Please speak with a teller.";
      setAnswer({ text: fallback, intent: 'GENERAL_TRIAGE', showQR: false });
      setTtsText(fallback);
    } finally {
      setIsLoading(false);
      setInputText('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuery(); }
  };

  const handleQuickAction = (query) => {
    setInputText(query);
    submitQuery(query);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#e8ecf2] p-4 md:p-6 font-sans text-slate-800 flex items-start justify-center">
      <div className="w-full max-w-2xl space-y-4 pt-4">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="neo-card p-4 px-5 flex justify-between items-center">
          <ToriiLogo variant="horizontal" size="sm" showTagline={false} />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest hidden sm:block">
                Active Session
              </span>
            </div>
            <button
              onClick={() => resetKiosk('MANUAL_NAVIGATE')}
              className="neo-button px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>End</span>
            </button>
          </div>
        </div>

        {/* ── PAN Compliance Banner (conditional) ─────────────────────────── */}
        {failedTxSummary && (
          <div className="neo-card p-4 border-l-4 border-amber-500 bg-amber-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-800">Compliance Hold Detected</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  Your deposit of ₹{failedTxSummary.most_recent_amount?.toLocaleString('en-IN')} is on
                  hold — missing PAN verification for transactions over ₹50,000.
                </p>
              </div>
              <button
                onClick={fetchQRCode}
                disabled={qrLoading || !!deepLink}
                className="neo-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 shrink-0 disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{deepLink ? 'QR Ready' : qrLoading ? 'Generating…' : 'Fix Now'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── QR Code Panel (on-demand) ────────────────────────────────────── */}
        {showQR && (
          <div className="neo-card p-6 flex flex-col items-center text-center">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Mobile Handoff</span>
            </div>
            <p className="text-sm text-slate-600 mb-4 max-w-xs">
              Scan with your smartphone to upload your PAN card. No app installation required.
            </p>
            {deepLink && !qrExpired ? (
              <QRCodeGenerator
                key={qrKey}
                payload={deepLink}
                timeout={45}
                onExpire={handleQRExpired}
              />
            ) : qrExpired ? (
              <div className="flex flex-col items-center gap-3">
                <div className="neo-inset rounded-3xl bg-white w-[200px] h-[200px] flex flex-col items-center justify-center gap-2 p-4">
                  <QrCode className="w-10 h-10 text-slate-300" />
                  <p className="text-xs text-slate-400 font-medium">QR code expired</p>
                </div>
                <button
                  onClick={fetchQRCode}
                  disabled={qrLoading}
                  className="neo-button flex items-center gap-2 px-4 py-2 text-sm font-bold text-blue-600 rounded-xl disabled:opacity-50"
                >
                  {qrLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <RefreshCw className="w-4 h-4" />}
                  <span>{qrLoading ? 'Generating…' : 'Generate New QR'}</span>
                </button>
              </div>
            ) : (
              <div className="neo-inset rounded-3xl bg-white w-[200px] h-[200px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* ── FAQ Chat Area ─────────────────────────────────────────────────── */}
        <div className="neo-card p-5 space-y-4">

          {/* Answer display */}
          <div className="neo-inset rounded-xl p-4 min-h-[100px] flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Looking that up for you…</span>
                </div>
              ) : answer ? (
                <div>
                  <p className="text-sm text-slate-700 leading-relaxed">{answer.text}</p>
                  {answer.intent === 'GENERAL_TRIAGE' && (
                    <p className="text-xs text-slate-400 mt-2">
                      → Please proceed to the teller counter for assistance.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-slate-700">How can I help you today?</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {micSupported
                      ? 'Type your question or tap the mic button to speak.'
                      : 'Type your question below or tap a suggestion to get started.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Text input + mic button */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening…' : 'Type your banking question…'}
              disabled={isLoading || isListening}
              className="
                flex-1 neo-inset rounded-xl px-4 py-3 text-sm text-slate-700
                placeholder:text-slate-400 outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />

            {/* Mic button — only shown if SpeechRecognition is supported */}
            {micSupported && (
              <button
                onClick={toggleMic}
                disabled={isLoading}
                title={isListening ? 'Stop listening' : 'Speak your question'}
                className={`
                  neo-button px-3 py-3 rounded-xl flex items-center justify-center
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${isListening
                    ? 'text-red-600 animate-pulse'
                    : 'text-slate-500 hover:text-blue-600'}
                `}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Send button */}
            <button
              onClick={() => submitQuery()}
              disabled={!inputText.trim() || isLoading}
              className="
                neo-button px-4 py-3 rounded-xl flex items-center gap-1.5
                text-sm font-bold text-blue-600 hover:text-blue-700
                disabled:opacity-40 disabled:cursor-not-allowed
              "
            >
              {isLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
              <span className="hidden sm:block">Ask</span>
            </button>
          </div>

          {/* Quick-action chips */}
          <div>
            <p className="text-xs text-slate-400 mb-2 font-medium">Common questions:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ label, query }) => (
                <button
                  key={label}
                  onClick={() => handleQuickAction(query)}
                  disabled={isLoading}
                  className="
                    neo-button px-3 py-1.5 rounded-lg text-xs font-medium
                    text-slate-600 hover:text-blue-600 flex items-center gap-1
                    disabled:opacity-40 disabled:cursor-not-allowed
                  "
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Session info footer ──────────────────────────────────────────── */}
        <p className="text-center text-xs text-slate-400 pb-4">
          Session ends after 5 min of inactivity · All conversations are confidential
        </p>

      </div>

      {/* VoiceAssistant — speaks answer aloud (renders nothing visible) */}
      {ttsText && (
        <VoiceAssistant
          text={ttsText}
          onEnd={() => setTtsText(null)}
        />
      )}

    </div>
  );
}
