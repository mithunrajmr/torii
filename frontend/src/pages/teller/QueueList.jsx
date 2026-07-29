// frontend/src/pages/teller/QueueList.jsx
import React from 'react';
import { ShieldAlert, CheckCircle, History, Inbox } from 'lucide-react';
import ToriiGateLoader from '../../components/ToriiGateLoader.jsx';

export default function QueueList({ tickets, selectedTicket, onSelectTicket, loading, filterMode, onFilterChange }) {
  if (loading) {
    return (
      <div className="neo-card p-6 h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <ToriiGateLoader size={64} className="mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">HITL Workstation Queue</h2>
          <span className="neo-inset px-2.5 py-0.5 text-xs font-bold text-blue-600 rounded-full">
            {tickets.length} Ticket(s)
          </span>
        </div>

        {/* Tab Toggle: Pending vs All Audit History */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 rounded-xl mb-4 text-xs font-bold">
          <button
            onClick={() => onFilterChange('pending')}
            className={`py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all ${
              filterMode === 'pending'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Pending</span>
          </button>
          <button
            onClick={() => onFilterChange('all')}
            className={`py-1.5 rounded-lg flex items-center justify-center space-x-1 transition-all ${
              filterMode === 'all'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History</span>
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="neo-inset p-6 text-center rounded-2xl">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Queue Clear!</p>
            <p className="text-[11px] text-slate-400 mt-1">
              {filterMode === 'all' ? 'No tickets recorded yet.' : 'No pending verification tickets.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
              const isApproved = t.status === 'APPROVED';
              const isRejected = t.status === 'REJECTED';

              return (
                <div
                  key={t.id}
                  onClick={() => onSelectTicket(t)}
                  className={`p-4 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'neo-inset border-2 border-blue-600 bg-blue-50/30'
                      : 'neo-card hover:bg-slate-200/50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold font-mono text-slate-800">
                      #{t.id.slice(0, 8)}
                    </span>
                    <div className="flex items-center space-x-1">
                      {isApproved && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-extrabold text-[10px] rounded-full border border-emerald-200">
                          APPROVED
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 font-extrabold text-[10px] rounded-full border border-red-200">
                          REJECTED
                        </span>
                      )}
                      {t.aml_flagged && (
                        <span className="p-1 bg-red-100 text-red-600 rounded-full" title="AML Suspicious">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-slate-700">{t.ocr_data?.name || t.ocr_data?.full_name || 'Branch Request'}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-extrabold rounded-md border border-blue-200 uppercase">
                      {t.ocr_data?.service_type || 'PAN_LINK'}
                    </span>
                    {t.ocr_data?.pan_number && (
                      <span className="font-mono text-[10px] text-slate-400 font-semibold">{t.ocr_data.pan_number}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-300">
        <p className="text-[11px] text-slate-400 text-center">Auto-refreshes every 5 seconds</p>
      </div>
    </div>
  );
}
