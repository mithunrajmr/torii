// frontend/src/pages/landing/copilot/CopilotDrawer.jsx
// Extruded neumorphic chat drawer with inset message stream well.
// Wired to POST /api/kiosk/voice — if response includes actionChip, renders ActionChip.

import React, { useState, useRef, useEffect } from 'react';
import { Send, X } from 'lucide-react';
import ActionChip from './ActionChip.jsx';

// Map backend route suggestions to ActionChip config
const ROUTE_ICONS = {}; // Kept intentionally lean — chips just show label + arrow

export default function CopilotDrawer({ onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I\'m TORII Copilot. Describe any banking issue and I\'ll route you to the right solution instantly.',
      chip: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message (scrollIntoView may be absent in jsdom)
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { id: `u-${Date.now()}`, role: 'user', text, chip: null };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/kiosk/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Shape: { response: string, actionChip?: { label: string, route: string } }
      const chip = data.actionChip ?? null;
      const reply = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.response ?? data.text ?? 'I\'ll help you with that.',
        chip,
      };
      setMessages((prev) => [...prev, reply]);
    } catch {
      const fallback = {
        id: `a-err-${Date.now()}`,
        role: 'assistant',
        text: 'Sorry, I\'m having trouble connecting right now. Try the kiosk directly to get started.',
        chip: { label: 'Open Kiosk Triage', route: '/kiosk' },
      };
      setMessages((prev) => [...prev, fallback]);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div
              className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center
                         shadow-[0_4px_10px_rgba(37,99,235,0.4)]"
              aria-hidden="true"
            >
              <span className="text-white font-extrabold text-xs">T</span>
            </div>
            {/* Pulsing active beacon */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400
                             ring-2 ring-[#e8ecf2]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-extrabold text-slate-800">TORII Copilot</p>
            <p className="text-[9px] text-emerald-600 font-semibold">watsonx Connected</p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close Copilot"
          className="w-7 h-7 rounded-xl bg-[#e8ecf2] flex items-center justify-center
                     shadow-[3px_3px_6px_#cbced1,-3px_-3px_6px_#ffffff]
                     hover:shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff]
                     active:shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]
                     transition-all duration-150 focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-blue-600"
        >
          <X className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
        </button>
      </div>

      {/* ── Message Stream (inset well) ─────────────────────────────────── */}
      <div
        className="flex-1 bg-[#e8ecf2] rounded-2xl p-3
                   shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]
                   overflow-y-auto max-h-72 flex flex-col gap-3"
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
                'max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm shadow-[2px_2px_6px_rgba(37,99,235,0.3)]'
                  : 'bg-[#e8ecf2] text-slate-700 rounded-bl-sm shadow-[3px_3px_6px_#cbced1,-3px_-3px_6px_#ffffff]',
              ].join(' ')}
            >
              {msg.text}
            </div>

            {/* Action Chip — rendered below assistant message if present */}
            {msg.role === 'assistant' && msg.chip && (
              <ActionChip label={msg.chip.label} route={msg.chip.route} />
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
          placeholder="Describe your banking issue…"
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
