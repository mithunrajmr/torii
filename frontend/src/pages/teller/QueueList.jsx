// frontend/src/pages/teller/QueueList.jsx
import React from 'react';
import { ShieldAlert, Clock, CheckCircle } from 'lucide-react';

export default function QueueList({ tickets, selectedTicket, onSelectTicket, loading }) {
  if (loading) {
    return (
      <div className="neo-card p-6 h-full flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading ticket queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="neo-card p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Pending Review Queue</h2>
          <span className="neo-inset px-3 py-1 text-xs font-bold text-blue-600 rounded-full">
            {tickets.length} Ticket(s)
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="neo-inset p-6 text-center rounded-2xl">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-600">Queue Clear!</p>
            <p className="text-[11px] text-slate-400 mt-1">No pending verification tickets.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
            {tickets.map((t) => {
              const isSelected = selectedTicket?.id === t.id;
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
                    {t.aml_flagged && (
                      <span className="p-1 bg-red-100 text-red-600 rounded-full" title="AML Suspicious">
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{t.ocr_data?.name || 'PAN Upload'}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
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
