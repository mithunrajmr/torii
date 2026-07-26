// frontend/src/pages/landing/components/DomainShowcase.jsx
// 5x Span 1x1: Horizontal grid of the 5 Omni-Issue service cards + test triggers.
// Clicking [Test This Scenario] seeds the persona via POST /api/sandbox/seed/:personaId
// then calls onSeedComplete() so the parent can trigger a Section G radar refresh.

import React, { useState } from 'react';
import {
  FileCheck,
  Lock,
  FileSignature,
  MessageSquareWarning,
  CreditCard,
  FlaskConical,
} from 'lucide-react';

// Domain definitions — mapped to persona seed IDs
const DOMAINS = [
  {
    id: 'compliance',
    personaId: 'PAN_BLOCKED',
    icon: FileCheck,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
    accentColor: 'border-blue-300',
    label: 'Compliance & Re-KYC',
    desc: 'PAN linking blocks on high-value deposits. AI-OCR extracts and validates PAN in under 34 seconds.',
    tag: 'ERR_PAN_MISSING_OVER_50K',
    tagColor: 'bg-blue-100 text-blue-700',
    account: '1000000001',
  },
  {
    id: 'payment',
    personaId: 'AML_SMURFER',
    icon: Lock,
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
    accentColor: 'border-rose-300',
    label: 'Payment Blocks & Security',
    desc: 'AML structuring detection across 4+ sub-₹50K deposits. Mandatory HITL escalation enforced.',
    tag: 'AML_SMURFING_DETECTED',
    tagColor: 'bg-rose-100 text-rose-700',
    account: '1000000002',
  },
  {
    id: 'mandates',
    personaId: 'SIGN_MISMATCH',
    icon: FileSignature,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-50',
    accentColor: 'border-orange-300',
    label: 'Complex Mandates',
    desc: 'PAN name vs account name mismatch triggers re-verification flow with fuzzy name matching.',
    tag: 'SIGN_MISMATCH_DETECTED',
    tagColor: 'bg-orange-100 text-orange-700',
    account: '1000000004',
  },
  {
    id: 'dispute',
    personaId: 'DORMANT_ACC',
    icon: MessageSquareWarning,
    iconColor: 'text-slate-500',
    iconBg: 'bg-slate-100',
    accentColor: 'border-slate-300',
    label: 'Dispute Resolution',
    desc: 'Dormant account reactivation with 12-month inactivity period. AI-guided compliance steps.',
    tag: 'DORMANT_ACCOUNT',
    tagColor: 'bg-slate-200 text-slate-600',
    account: '1000000003',
  },
  {
    id: 'credit',
    personaId: 'CLEAN_HNW',
    icon: CreditCard,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
    accentColor: 'border-emerald-300',
    label: 'Credit Origination',
    desc: 'HNW customer pre-qualification. Advisor Agent surfaces personalised cross-sell offers.',
    tag: 'HNW_ELIGIBLE',
    tagColor: 'bg-emerald-100 text-emerald-700',
    account: '1000000005',
  },
];

export default function DomainShowcase({ onSeedComplete }) {
  const [loading, setLoading] = useState(null);
  const [seeded, setSeeded] = useState(null);
  const [error, setError] = useState(null);

  async function handleTestScenario(domain) {
    if (loading) return;
    setLoading(domain.id);
    setError(null);
    try {
      const res = await fetch(`/api/sandbox/seed/${domain.personaId}`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || `HTTP ${res.status}`);
      }
      // Also seed demo teller tickets so the HITL dashboard has work to show
      fetch('/api/sandbox/seed-tickets', { method: 'POST' }).catch(() => {});

      setSeeded(domain.id);
      // Trigger parent to immediately refetch Section G radar
      onSeedComplete?.();
      // Scroll to Section G
      document
        .querySelector('[data-testid="section-g-radar"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear seeded highlight after 4s
      setTimeout(() => setSeeded(null), 4000);
    } catch (err) {
      setError(`${domain.label}: ${err.message}`);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="bg-[#e8ecf2] rounded-3xl p-6 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]"
      aria-label="5 Omni-Issue Banking Domain Showcase"
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl bg-[#e8ecf2] flex items-center justify-center
                     shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]"
          aria-hidden="true"
        >
          <FlaskConical className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
            Interactive Showcase
          </span>
          <p className="text-sm font-extrabold text-slate-800">
            The 5 Omni-Issue Banking Domains
          </p>
        </div>
        {error && (
          <div
            className="ml-auto text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>

      {/* 5-card horizontal grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        role="list"
        aria-label="Banking domain cards"
      >
        {DOMAINS.map((domain) => {
          const Icon = domain.icon;
          const isLoading = loading === domain.id;
          const isSeeded = seeded === domain.id;

          return (
            <div
              key={domain.id}
              role="listitem"
              className={[
                'flex flex-col gap-3 p-4 rounded-2xl bg-[#e8ecf2]',
                'shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff]',
                'transition-all duration-300',
                isSeeded ? 'ring-2 ring-blue-400/50 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]' : '',
              ].join(' ')}
              aria-label={domain.label}
            >
              {/* Domain icon */}
              <div
                className={`w-10 h-10 rounded-xl ${domain.iconBg} flex items-center justify-center flex-shrink-0`}
                aria-hidden="true"
              >
                <Icon className={`w-5 h-5 ${domain.iconColor}`} />
              </div>

              {/* Label + tag */}
              <div>
                <p className="text-xs font-extrabold text-slate-800 leading-tight">{domain.label}</p>
                <span
                  className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full font-mono ${domain.tagColor}`}
                >
                  {domain.tag}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-slate-500 leading-relaxed flex-1">{domain.desc}</p>

              {/* Test trigger button */}
              <button
                onClick={() => handleTestScenario(domain)}
                disabled={!!loading}
                data-testid={`seed-${domain.personaId}`}
                aria-label={`Test ${domain.label} scenario`}
                aria-busy={isLoading}
                className={[
                  'w-full py-2 rounded-xl text-xs font-extrabold tracking-wide',
                  'transition-all duration-200 focus-visible:outline-none',
                  'focus-visible:ring-2 focus-visible:ring-blue-600',
                  isSeeded
                    ? 'bg-emerald-500 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.15)]'
                    : 'bg-[#e8ecf2] text-slate-600 shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff] hover:shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] active:shadow-[inset_3px_3px_6px_#cbced1,inset_-3px_-3px_6px_#ffffff]',
                  loading && loading !== domain.id ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    Seeding…
                  </span>
                ) : isSeeded ? (
                  '✓ Seeded — Check Radar'
                ) : (
                  'Test This Scenario'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
