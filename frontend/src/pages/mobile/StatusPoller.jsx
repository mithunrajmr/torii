// frontend/src/pages/mobile/StatusPoller.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

export default function StatusPoller() {
  const { token } = useParams();
  const location = useLocation();

  const [ticketId, setTicketId] = useState(location.state?.ticketId || null);
  const [status, setStatus] = useState(location.state?.status || 'PENDING');
  const [rejectionReason, setRejectionReason] = useState(null);
  const [crossSell, setCrossSell] = useState(
    location.state?.crossSell || {
      title: 'Pre-Approved Fixed Deposit',
      offer: 'Lock in 7.50% p.a. returns on 12-month tenure today.',
    }
  );

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/mobile/status/${token}`);
        if (!res.ok) return;

        const data = await res.json();
        setStatus(data.status);
        if (data.rejection_reason) setRejectionReason(data.rejection_reason);
        if (data.cross_sell_offer) setCrossSell(data.cross_sell_offer);
      } catch (e) {
        console.warn('Status poll failed:', e);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans p-4 flex flex-col justify-between">
      
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <ToriiLogo variant="icon" size="sm" />
          <div>
            <h1 className="text-base font-extrabold text-white">Torii Status Tracker</h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Real-Time Teller Dispatch</p>
          </div>
        </div>
      </div>

      {/* Main Status Display */}
      <div className="my-auto py-6 space-y-6 text-center">
        {status === 'PENDING' || status === 'PENDING_MANUAL_REVIEW' ? (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto animate-pulse">
              <Clock className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-100">Verification in Progress</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {status === 'PENDING_MANUAL_REVIEW'
                  ? 'Your document has been routed to a bank teller for manual review.'
                  : 'AI pre-verification complete. Awaiting teller 1-click authorization.'}
              </p>
            </div>
            <div className="inline-flex items-center space-x-2 bg-slate-800 px-4 py-2 rounded-full text-xs text-slate-300">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Polling status every 5 seconds</span>
            </div>
          </div>
        ) : status === 'APPROVED' ? (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-emerald-400">PAN Linked Successfully!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Your compliance hold has been lifted. You can now complete your deposit at the kiosk.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center mx-auto">
              <XCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-red-400">Verification Rejected</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto font-medium">
                Reason: {rejectionReason || 'Document unreadable or invalid.'}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Please visit the customer service desk for assistance.
              </p>
            </div>
          </div>
        )}

        {/* Advisor Agent Cross-Sell Bento Card */}
        {crossSell && (
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-3xl text-left space-y-3 shadow-lg">
            <div className="flex items-center space-x-2 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Personalized Recommendation</span>
            </div>
            <h3 className="text-sm font-bold text-slate-100">{crossSell.title || 'Exclusive Bank Offer'}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {crossSell.offer || crossSell.description || 'Speak to your branch relationship manager for high-yield savings opportunities.'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="py-4 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-500 font-mono">
          Session ID: {token ? `${token.slice(0, 8)}...` : 'Unknown'}
        </p>
      </div>

    </div>
  );
}
