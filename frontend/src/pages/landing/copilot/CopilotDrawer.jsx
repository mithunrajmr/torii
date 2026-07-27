import React, { useState, useRef, useEffect } from 'react';
import { Send, X, ShieldCheck, UserCheck, Lock, AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ActionChip from './ActionChip.jsx';

export default function CopilotDrawer({ onClose }) {
  const navigate = useNavigate();
  const [jwt, setJwt] = useState(() => localStorage.getItem('kiosk_jwt'));
  const [accountInfo, setAccountInfo] = useState(null);

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: jwt
        ? 'Welcome back! I am TORII Copilot (Authenticated Mode). I have live access to your account ledger and can diagnose and solve your transaction holds in seconds.'
        : 'Hi! I\'m TORII Copilot (Public Guest Mode). Ask me any general banking question (FD rates, card blocking, branch timings), or log in to solve account issues instantly.',
      chip: jwt ? { label: '⚡ Run Proactive Radar', route: '/kiosk/triage' } : { label: '🔑 Log In to Account', route: '/kiosk/login' },
      authenticated: Boolean(jwt),
    },
  ]);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Check auth state on load
  useEffect(() => {
    const currentToken = localStorage.getItem('kiosk_jwt');
    setJwt(currentToken);
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text, chip: null };
    const replyId = `a-${Date.now()}`;
    const initialReply = {
      id: replyId,
      role: 'assistant',
      text: '',
      streaming: true,
      chip: null,
      secondary: [],
    };

    setMessages((prev) => [...prev, userMsg, initialReply]);
    setInput('');
    setSending(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
        headers['x-kiosk-jwt'] = jwt;
      }

      const streamUrl = jwt ? '/api/kiosk/stream' : '/api/kiosk/public-stream';
      const res = await fetch(streamUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: text, text }),
      });

      if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        // Fallback to /api/kiosk/voice if streaming not supported
        const fallbackRes = await fetch('/api/kiosk/voice', { method: 'POST', headers, body: JSON.stringify({ text }) });
        const data = await fallbackRes.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId
              ? {
                  ...m,
                  text: data.response || data.text || 'I can help with that.',
                  chip: data.actionChip || null,
                  secondary: data.secondaryActions || [],
                  streaming: false,
                }
              : m
          )
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || !line.startsWith('data:')) continue;
          try {
            const payload = JSON.parse(line.slice(5).trim());
            if (payload.token) {
              accumulatedText += payload.token;
              setMessages((prev) =>
                prev.map((m) => (m.id === replyId ? { ...m, text: accumulatedText, streaming: true } : m))
              );
            }
            if (payload.fullText) {
              accumulatedText = payload.fullText;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === replyId
                    ? {
                        ...m,
                        text: accumulatedText,
                        streaming: false,
                        chip: payload.showQR
                          ? { label: '⚡ Execute Agentic Fix', route: '/kiosk/triage?action=fix_pan' }
                          : { label: 'Go to Kiosk Triage', route: '/kiosk' },
                      }
                    : m
                )
              );
            }
          } catch (_) {}
        }
      }

      setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, streaming: false } : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === replyId
            ? {
                ...m,
                text: "Sorry, I'm having trouble connecting right now. Try the kiosk directly to get started.",
                chip: { label: 'Open Kiosk Triage', route: '/kiosk' },
                streaming: false,
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="w-80 md:w-96 bg-[#e8ecf2] rounded-3xl p-5
                 shadow-[12px_12px_24px_#cbced1,-12px_-12px_24px_#ffffff]
                 flex flex-col gap-4"
      role="dialog"
      aria-label="TORII Copilot chat"
      data-testid="copilot-drawer"
    >
      {/* ── Drawer Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-300/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                jwt ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}
              aria-hidden="true"
            >
              <span className="font-extrabold text-xs">T</span>
            </div>
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[#e8ecf2] ${
                jwt ? 'bg-emerald-400 animate-ping' : 'bg-blue-400'
              }`}
              aria-hidden="true"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-extrabold text-slate-800">TORII Copilot</p>
              {jwt ? (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded border border-emerald-300">
                  AUTH
                </span>
              ) : (
                <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                  GUEST
                </span>
              )}
            </div>
            <p className="text-[9px] text-slate-500 font-medium">
              {jwt
                ? accountInfo ? `Account: ${accountInfo.maskedNumber}` : 'Account Verified'
                : 'General Q&A Mode'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {jwt ? (
            <button
              onClick={() => {
                localStorage.removeItem('kiosk_jwt');
                setJwt(null);
                setAccountInfo(null);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `logout-${Date.now()}`,
                    role: 'assistant',
                    text: 'Switched to Public Guest Mode. Log in anytime to access proactive account diagnostics.',
                    chip: { label: '🔑 Log In to Account', route: '/kiosk/login' },
                  },
                ]);
              }}
              className="text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg border border-red-200"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                navigate('/kiosk/login');
              }}
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200"
            >
              Log In
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close Copilot"
            className="w-7 h-7 rounded-xl bg-[#e8ecf2] flex items-center justify-center
                       shadow-[3px_3px_6px_#cbced1,-3px_-3px_6px_#ffffff]
                       hover:shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff]
                       active:shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]
                       transition-all duration-150"
          >
            <X className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Message Stream (inset well) ─────────────────────────────────── */}
      <div
        className="flex-1 bg-[#e8ecf2] rounded-2xl p-3
                   shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]
                   overflow-y-auto max-h-80 flex flex-col gap-3"
        aria-live="polite"
        aria-label="Message history"
        data-testid="message-stream"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={[
                'max-w-[90%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm shadow-[2px_2px_6px_rgba(37,99,235,0.3)]'
                  : 'bg-[#e8ecf2] text-slate-700 rounded-bl-sm shadow-[3px_3px_6px_#cbced1,-3px_-3px_6px_#ffffff]',
              ].join(' ')}
            >
              {msg.text}

              {/* Agentic Pre-Resolution Radar Card inside message bubble if present */}
              {msg.accountContext && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-300 text-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 border-b border-amber-200 pb-1.5">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Section G — Bottleneck Radar
                    </span>
                    <span className="bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded text-[10px]">
                      {msg.accountContext.blockedTxCount} Active Failure(s)
                    </span>
                  </div>
                  <div className="text-[11px] space-y-1 font-mono text-slate-700">
                    <p>Account: <strong className="text-slate-900">{msg.accountContext.maskedNumber} ({msg.accountContext.fullName})</strong></p>
                    <p>Error: <span className="text-red-600 bg-red-100 px-1 rounded font-bold">{msg.accountContext.errorCode}</span></p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Chips */}
            {msg.role === 'assistant' && (
              <div className="flex flex-wrap gap-2 mt-1 max-w-[90%]">
                {msg.chip && <ActionChip label={msg.chip.label} route={msg.chip.route} />}
                {msg.secondary &&
                  msg.secondary.map((sec, idx) => (
                    <ActionChip key={idx} label={sec.label} route={sec.route} />
                  ))}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="flex items-start gap-1.5">
            <div className="bg-[#e8ecf2] rounded-2xl rounded-bl-sm px-3 py-2 shadow-[3px_3px_6px_#cbced1,-3px_-3px_6px_#ffffff]">
              <div className="flex gap-1 items-center h-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input Row ──────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={jwt ? 'Ask anything or say "Fix my account"…' : 'Ask general banking questions…'}
          disabled={sending}
          data-testid="copilot-input"
          aria-label="Type your banking question"
          className="flex-1 bg-[#e8ecf2] rounded-xl px-3 py-2 text-xs text-slate-700 placeholder-slate-400
                     shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]
                     focus:outline-none focus:ring-2 focus:ring-blue-500/50
                     disabled:opacity-50 transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0
                     shadow-[2px_2px_6px_rgba(37,99,235,0.4)]
                     hover:bg-blue-700 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2)]
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-150 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-blue-600"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

