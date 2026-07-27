// frontend/src/pages/teller/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QueueList from './QueueList.jsx';
import SecureImageDisplay from './SecureImageDisplay.jsx';
import ApprovalControls from './ApprovalControls.jsx';
import { Building2, ShieldAlert, CheckCircle2, UserCheck, RefreshCw, LogOut, Users } from 'lucide-react';
import ToriiLogo from '../../components/ToriiLogo.jsx';

// ── Teller auth helpers ────────────────────────────────────────────────────────
// In dev mode: lazily fetches a dev token if none is stored (so dashboard works without login).
// In production: localStorage must already have a teller_jwt from TellerLogin — if not, null
//   is returned and the Dashboard redirects to /teller/login.
async function getTellerToken() {
  const stored = localStorage.getItem('teller_jwt');
  if (stored) {
    // Quick exp check — remove and return null if expired
    try {
      const payload = JSON.parse(atob(stored.split('.')[1]));
      if (payload.exp <= Math.floor(Date.now() / 1000)) {
        localStorage.removeItem('teller_jwt');
        return null;
      }
    } catch (_) {
      localStorage.removeItem('teller_jwt');
      return null;
    }
    return stored;
  }

  // Dev-only convenience: auto-fetch a dev token so you can access the dashboard
  // without going through TellerLogin. Not available in production.
  if (import.meta.env.DEV) {
    try {
      const res = await fetch('/api/dev/teller-token', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      localStorage.setItem('teller_jwt', data.teller_jwt);
      return data.teller_jwt;
    } catch (err) {
      console.error('[Dashboard] Failed to obtain dev teller token:', err.message);
      return null;
    }
  }

  return null; // production: no token → Dashboard redirects to /teller/login
}

// Wrapper around fetch that injects the teller Authorization header.
async function tellerFetch(url, options = {}) {
  const token = await getTellerToken();
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();

  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [staffName, setStaffName] = useState(localStorage.getItem('teller_name') || 'Staff Teller');
  const [filterMode, setFilterMode] = useState('pending'); // 'pending' | 'all'

  // Auth guard — redirect to login if no valid JWT
  useEffect(() => {
    getTellerToken().then((token) => {
      if (!token) navigate('/teller/login', { replace: true });
    });
  }, [navigate]);

  const fetchTickets = async (overrideFilter = filterMode) => {
    try {
      const endpoint = overrideFilter === 'all' ? '/api/teller/tickets?status=all' : '/api/teller/tickets';
      const res = await tellerFetch(endpoint);
      if (res.status === 401) { navigate('/teller/login', { replace: true }); return; }
      if (!res.ok) return;
      const data = await res.json();
      setTickets(data);

      if (data.length === 0) {
        setSelectedTicket(null);
      } else if (!selectedTicket) {
        setSelectedTicket(data[0]);
      } else {
        // Keep selection updated if still pending, otherwise switch to next ticket in queue
        const current = data.find((t) => t.id === selectedTicket.id);
        setSelectedTicket(current || data[0]);
      }
    } catch (err) {
      console.warn('Failed to fetch teller tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets(filterMode);
    const interval = setInterval(() => fetchTickets(filterMode), 5000);
    return () => clearInterval(interval);
  }, [filterMode]);

  const handleApprove = async () => {
    if (!selectedTicket || actionLoading) return;
    const actionedId = selectedTicket.id;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await tellerFetch('/api/teller/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: actionedId,
          action: 'APPROVE',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Approval failed' });
        return;
      }

      setFeedback({ type: 'success', message: `Ticket #${actionedId.slice(0, 8)} Approved!` });

      // Immediately remove actioned ticket from UI queue
      const remaining = tickets.filter((t) => t.id !== actionedId);
      setTickets(remaining);
      setSelectedTicket(remaining.length > 0 ? remaining[0] : null);

      fetchTickets();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Connection error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason) => {
    if (!selectedTicket || actionLoading) return;
    const actionedId = selectedTicket.id;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await tellerFetch('/api/teller/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: actionedId,
          action: 'REJECT',
          reason,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Rejection failed' });
        return;
      }

      setFeedback({ type: 'success', message: `Ticket #${actionedId.slice(0, 8)} Rejected.` });

      // Immediately remove actioned ticket from UI queue
      const remaining = tickets.filter((t) => t.id !== actionedId);
      setTickets(remaining);
      setSelectedTicket(remaining.length > 0 ? remaining[0] : null);

      fetchTickets();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Connection error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!selectedTicket || actionLoading) return;
    const actionedId = selectedTicket.id;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await tellerFetch('/api/teller/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: actionedId,
          action: 'ESCALATE',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setFeedback({ type: 'error', message: err.message || 'Escalation failed' });
        return;
      }

      setFeedback({ type: 'success', message: `Ticket #${actionedId.slice(0, 8)} escalated to Compliance.` });

      // Immediately remove actioned ticket from UI queue
      const remaining = tickets.filter((t) => t.id !== actionedId);
      setTickets(remaining);
      setSelectedTicket(remaining.length > 0 ? remaining[0] : null);

      fetchTickets();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Connection error' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e8ecf2] font-sans text-slate-800 flex flex-col">
      
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <ToriiLogo variant="icon" size="sm" />
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center space-x-2">
              <span>Torii HITL Workstation</span>
            </h1>
            <p className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Legacy Behind. Resolution Ahead.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-300">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>{staffName}</span>
          </div>
          {/* Account management link */}
          <button
            onClick={() => navigate('/teller/accounts')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-slate-800 transition-colors"
            title="Manage Accounts"
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:block">Accounts</span>
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('teller_jwt');
              localStorage.removeItem('teller_name');
              localStorage.removeItem('teller_role');
              navigate('/teller/login', { replace: true });
            }}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={fetchTickets}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Refresh Queue"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 p-6 gap-6 overflow-hidden">
        
        {/* Left Sidebar: Queue List */}
        <div className="md:col-span-4 lg:col-span-3">
          <QueueList
            tickets={tickets}
            selectedTicket={selectedTicket}
            onSelectTicket={setSelectedTicket}
            loading={loading}
            filterMode={filterMode}
            onFilterChange={(newMode) => {
              setFilterMode(newMode);
              fetchTickets(newMode);
            }}
          />
        </div>

        {/* Right Main Panel: Inspection & Decision */}
        <div className="md:col-span-8 lg:col-span-9 flex flex-col space-y-6">
          
          {feedback && (
            <div
              className={`p-4 rounded-2xl text-sm font-semibold flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : 'bg-red-100 border border-red-300 text-red-800'
              }`}
            >
              <span>{feedback.message}</span>
            </div>
          )}

          {selectedTicket ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Document Image Viewer */}
              <SecureImageDisplay ticketId={selectedTicket.id} />

              {/* Extraction Data & Controls Panel */}
              <div className="neo-card p-6 flex flex-col justify-between space-y-6">
                
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ticket Metadata</span>
                      <h3 className="text-lg font-bold text-slate-800">
                        Account #{selectedTicket.account_number || selectedTicket.account_id?.slice(0, 8)}
                      </h3>
                    </div>
                    {selectedTicket.aml_flagged && (
                      <div className="flex items-center space-x-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-300">
                        <ShieldAlert className="w-4 h-4" />
                        <span>AML Risk Flagged</span>
                      </div>
                    )}
                  </div>

                  {/* AI Extraction Bento Table */}
                  {(() => {
                    const ocrData = typeof selectedTicket.ocr_data === 'string'
                      ? (JSON.parse(selectedTicket.ocr_data) || {})
                      : (selectedTicket.ocr_data || {});

                    return (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gemini Vision OCR Verification Output</h4>
                        
                        <div className="neo-inset p-4 rounded-2xl space-y-2 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Extracted Name:</span>
                            <span className="font-bold text-slate-800">{ocrData.name || 'UNKNOWN'}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Extracted PAN:</span>
                            <span className="font-mono font-bold text-blue-600">{ocrData.pan_number || ocrData.id_number || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Doc Type / DOB:</span>
                            <span className="font-bold text-slate-700">
                              {ocrData.id_type || 'PAN'} · {ocrData.dob || 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Clarity / Confidence:</span>
                            <span className="font-bold text-emerald-600">
                              {ocrData.clarity_score ? `${(ocrData.clarity_score * 100).toFixed(0)}%` : selectedTicket.ai_confidence ? `${(selectedTicket.ai_confidence * 100).toFixed(0)}%` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Name Match Score:</span>
                            <span className="font-bold text-slate-800">
                              {selectedTicket.name_mismatch_score ? `${(selectedTicket.name_mismatch_score * 100).toFixed(0)}%` : '100%'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Tampering / Defacement:</span>
                            <span className={`font-bold ${ocrData.tampering_detected ? 'text-red-600' : 'text-emerald-600'}`}>
                              {ocrData.tampering_detected ? '⚠️ DETECTED' : '✓ PASSED'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-300">
                            <span className="text-slate-500 font-medium">Specimen Check:</span>
                            <span className={`font-bold ${ocrData.is_specimen_or_dummy ? 'text-red-600' : 'text-emerald-600'}`}>
                              {ocrData.is_specimen_or_dummy ? '⚠️ SPECIMEN / DUMMY' : '✓ GENUINE'}
                            </span>
                          </div>
                          {ocrData.rejection_reason && (
                            <div className="flex justify-between py-1 text-red-600 bg-red-50 p-2 rounded-lg mt-1">
                              <span className="font-bold">Rejection Flag:</span>
                              <span className="font-semibold text-right">{ocrData.rejection_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>

                {/* HITL Action Controls */}
                <ApprovalControls
                  ticket={selectedTicket}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onEscalate={handleEscalate}
                  loading={actionLoading}
                />

              </div>

            </div>
          ) : (
            <div className="neo-card p-12 flex flex-col items-center justify-center text-center space-y-4 my-auto min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Queue Clear!</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  All customer document verification tickets have been reviewed and processed. New tickets will automatically appear here in real time.
                </p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
