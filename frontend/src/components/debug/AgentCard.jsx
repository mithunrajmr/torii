// frontend/src/components/debug/AgentCard.jsx
import React from 'react';
import { Bot, Cpu, Wrench, Users, CheckCircle2, AlertTriangle, Play } from 'lucide-react';

export default function AgentCard({ agent, isSelected, onSelect }) {
  const isReady = agent.status === 'READY';

  return (
    <div
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-xl p-5 transition-all duration-200 border ${
        isSelected
          ? 'bg-slate-900 border-blue-500 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono text-sm font-bold transition-colors ${
              isSelected
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
            }`}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 group-hover:text-blue-400 transition-colors text-sm font-mono">
              {agent.name}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ID: <span className="text-slate-300">{agent.agentId}</span>
            </span>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isReady
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {isReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ready</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Missing Creds</span>
            </>
          )}
        </span>
      </div>

      {/* Purpose */}
      <p className="text-xs text-slate-300 line-clamp-2 mb-4 leading-relaxed">
        {agent.purpose}
      </p>

      {/* Metadata Badges */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate text-slate-300 font-mono text-[11px]">
            {agent.model.replace('watsonx/ibm/', '')}
          </span>
        </div>

        {agent.tools && agent.tools.length > 0 && (
          <div className="flex items-center gap-2 text-slate-400">
            <Wrench className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700/50"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {agent.collaborators && agent.collaborators.length > 0 && (
          <div className="flex items-center gap-2 text-slate-400">
            <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[11px] text-purple-300">
              Collabs: {agent.collaborators.join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Select Footer Indicator */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-500">
          Env: {agent.envVar}
        </span>
        <button
          className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{isSelected ? 'Selected' : 'Test Agent'}</span>
        </button>
      </div>
    </div>
  );
}
