// frontend/src/components/debug/ExecutionHistory.jsx
import React from 'react';
import { History, Trash2, CheckCircle2, XCircle, Clock, Database, Edit3 } from 'lucide-react';

export default function ExecutionHistory({ history, onSelectHistoryItem, onClearHistory }) {
  if (!history || history.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center">
        <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-400">No Execution History</h4>
        <p className="text-xs text-slate-500 mt-1">
          Execute any agent above to log test metrics and payloads.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-400" />
          <h3 className="font-semibold text-slate-200 text-sm">Execution History Log</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
            {history.length} runs
          </span>
        </div>

        <button
          onClick={onClearHistory}
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear History</span>
        </button>
      </div>

      <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
        {history.map((item, idx) => {
          const isSuccess = item.status === 'SUCCESS';
          return (
            <div
              key={item.id || idx}
              onClick={() => onSelectHistoryItem(item)}
              className="p-4 hover:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSuccess
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200 font-mono">{item.agentName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1 ${
                        item.inputSource === 'SUPABASE'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}
                    >
                      {item.inputSource === 'SUPABASE' ? (
                        <>
                          <Database className="w-3 h-3" />
                          <span>Supabase DB</span>
                        </>
                      ) : (
                        <>
                          <Edit3 className="w-3 h-3" />
                          <span>Manual Input</span>
                        </>
                      )}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px] font-mono">
                    {new Date(item.timestamp).toLocaleTimeString()} — HTTP {item.httpStatus || 200}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{item.timing?.latencyMs ?? 0} ms</span>
                </div>
                <span className="text-blue-400 hover:underline">View Log →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
