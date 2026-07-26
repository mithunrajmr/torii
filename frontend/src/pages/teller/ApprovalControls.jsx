// frontend/src/pages/teller/ApprovalControls.jsx
import React, { useState } from 'react';
import { CheckCircle2, XCircle, ShieldAlert, ArrowUpRight, AlertOctagon } from 'lucide-react';

export default function ApprovalControls({ ticket, onApprove, onReject, onEscalate, loading }) {
  const [rejectReason, setRejectReason] = useState('BLURRY_IMAGE');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const isAmlBlocked = ticket.aml_flagged;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">HITL Authorization Controls</span>
        {isAmlBlocked && (
          <span className="text-xs font-bold text-red-600 flex items-center space-x-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Approval Locked — AML Risk</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Approve OR Escalate button — mutually exclusive based on AML flag */}
        {isAmlBlocked ? (
          <button
            onClick={onEscalate}
            disabled={loading}
            className="py-3.5 px-4 rounded-2xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 cursor-pointer flex items-center justify-center space-x-2"
          >
            <AlertOctagon className="w-5 h-5" />
            <span>{loading ? 'Processing...' : 'Escalate to Compliance'}</span>
          </button>
        ) : (
          <button
            onClick={onApprove}
            disabled={loading}
            className="py-3.5 px-4 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center space-x-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>{loading ? 'Processing...' : '1-Click Approve'}</span>
          </button>
        )}

        {/* Reject Trigger Button */}
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="py-3.5 px-4 rounded-2xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 cursor-pointer flex items-center justify-center space-x-2"
        >
          <XCircle className="w-5 h-5" />
          <span>Reject Ticket</span>
        </button>
      </div>

      {/* Reject Modal / Dropdown */}
      {showRejectModal && (
        <div className="neo-inset p-4 rounded-2xl space-y-3 bg-red-50/50 border border-red-200 mt-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-red-700">Select Rejection Reason:</span>
            <button
              onClick={() => setShowRejectModal(false)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          <select
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-red-300 text-xs font-semibold bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="BLURRY_IMAGE">Blurry or Unreadable Image</option>
            <option value="NAME_MISMATCH">Name Mismatch on Record</option>
            <option value="INVALID_DOCUMENT">Invalid Document Type / Not a PAN Card</option>
            <option value="EXPIRED_DOCUMENT">Expired or Tampered Identity</option>
            <option value="SUSPECTED_FRAUD">Suspected Fraud / Alteration</option>
          </select>

          <button
            onClick={() => {
              onReject(rejectReason);
              setShowRejectModal(false);
            }}
            disabled={loading}
            className="w-full py-2.5 rounded-xl font-bold text-xs bg-red-700 hover:bg-red-800 text-white shadow-md flex items-center justify-center space-x-1"
          >
            <span>Confirm Rejection & Notify Customer</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
