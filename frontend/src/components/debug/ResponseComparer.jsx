// frontend/src/components/debug/ResponseComparer.jsx
import React, { useState } from 'react';
import {
  Code,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  FileText,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  XCircle
} from 'lucide-react';

export default function ResponseComparer({ result, onRetry, isExecuting }) {
  const [activeTab, setActiveTab] = useState('comparison'); // 'comparison' | 'raw' | 'parsed' | 'request'
  const [copiedTab, setCopiedTab] = useState(null);

  if (!result) return null;

  const isSuccess = result.status === 'SUCCESS';
  const isConfigError = result.status === 'CONFIGURATION_ERROR';

  const handleCopy = (text, tabName) => {
    navigator.clipboard.writeText(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    setCopiedTab(tabName);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header / Status Banner */}
      <div
        className={`px-6 py-4 border-b flex flex-wrap items-center justify-between gap-4 ${
          isSuccess
            ? 'bg-emerald-950/40 border-emerald-500/20'
            : isConfigError
            ? 'bg-amber-950/40 border-amber-500/20'
            : 'bg-rose-950/40 border-rose-500/20'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isSuccess
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : isConfigError
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : isConfigError ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-slate-100 text-sm">
                Execution Status: {result.status}
              </h4>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-300 border border-slate-700">
                HTTP {result.httpStatus || 500}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Agent: <span className="text-slate-200">{result.agentName}</span> ({result.agentId})
            </span>
          </div>
        </div>

        {/* Timing & Retry */}
        <div className="flex items-center gap-4">
          {result.timing && (
            <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>{result.timing.latencyMs} ms</span>
              </div>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                {new Date(result.timing.endTime).toLocaleTimeString()}
              </span>
            </div>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              disabled={isExecuting}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors shadow-sm"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>Retry Execution</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Details Section (If Failed) */}
      {result.error && (
        <div className="p-6 border-b border-rose-500/20 bg-rose-950/20 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between text-rose-400 font-bold">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Error Details & Diagnostics
            </span>
            {result.error.missingEnvVars && (
              <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 text-[11px]">
                Missing Env: {result.error.missingEnvVars.join(', ')}
              </span>
            )}
          </div>

          <p className="text-rose-200 font-sans text-sm">{result.error.message}</p>

          {result.error.details && (
            <div className="p-3 bg-slate-950 rounded-lg text-slate-300 border border-rose-900/40 overflow-x-auto">
              {result.error.details}
            </div>
          )}

          {result.error.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-slate-400 hover:text-slate-200">
                View Stack Trace
              </summary>
              <pre className="mt-2 p-3 bg-slate-950 text-slate-400 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
                {result.error.stack}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
        <div className="flex items-center gap-1">
          {[
            { id: 'comparison', label: 'Side-by-Side Comparison', icon: Code },
            { id: 'parsed', label: 'Parsed Output', icon: CheckCircle2 },
            { id: 'raw', label: 'Raw SSE Response', icon: FileText },
            { id: 'request', label: 'Request & Headers', icon: Send },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400 bg-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() =>
            handleCopy(
              activeTab === 'raw'
                ? result.response?.raw
                : activeTab === 'parsed'
                ? result.response?.parsed
                : activeTab === 'request'
                ? result.request
                : { raw: result.response?.raw, parsed: result.response?.parsed },
              activeTab
            )
          }
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded hover:bg-slate-800 transition-colors"
        >
          {copiedTab === activeTab ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Tab Payload</span>
            </>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-6">
        {/* TAB 1: Side-by-Side Comparison */}
        {activeTab === 'comparison' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Raw Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Raw IBM watsonx Response
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {typeof result.response?.raw === 'string'
                    ? `${result.response.raw.length} bytes`
                    : ''}
                </span>
              </div>
              <pre className="h-96 p-4 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 overflow-all text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {result.response?.raw || '// No raw response output'}
              </pre>
            </div>

            {/* Parsed Column */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider font-mono">
                  Application Parsed Output
                </span>
                {result.response?.parseError ? (
                  <span className="text-[11px] text-amber-400 font-mono">Fallback Mode</span>
                ) : (
                  <span className="text-[11px] text-emerald-400 font-mono">JSON Validated</span>
                )}
              </div>
              <pre className="h-96 p-4 bg-slate-950 text-emerald-300/90 rounded-xl border border-slate-800 overflow-all text-xs font-mono whitespace-pre-wrap leading-relaxed">
                {typeof result.response?.parsed === 'object'
                  ? JSON.stringify(result.response.parsed, null, 2)
                  : result.response?.parsed || '// No parsed output'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: Parsed Output */}
        {activeTab === 'parsed' && (
          <div className="space-y-3">
            <span className="text-xs text-slate-400 font-mono">
              Result used by TORII application pipeline:
            </span>
            <pre className="p-5 bg-slate-950 text-emerald-400 rounded-xl border border-slate-800 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {typeof result.response?.parsed === 'object'
                ? JSON.stringify(result.response.parsed, null, 2)
                : result.response?.parsed}
            </pre>
          </div>
        )}

        {/* TAB 3: Raw SSE Response */}
        {activeTab === 'raw' && (
          <div className="space-y-3">
            <span className="text-xs text-slate-400 font-mono">
              Original response string directly from HTTP endpoint:
            </span>
            <pre className="p-5 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {result.response?.raw}
            </pre>
          </div>
        )}

        {/* TAB 4: Request & Headers */}
        {activeTab === 'request' && result.request && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">
                  Target Endpoint
                </span>
                <p className="text-blue-400 font-bold break-all">{result.request.endpoint}</p>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-500 uppercase tracking-wider text-[10px]">
                  Agent ID
                </span>
                <p className="text-emerald-400 font-bold">{result.request.agentId}</p>
              </div>
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                HTTP Request Headers (Secrets Masked)
              </span>
              <pre className="p-4 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 text-xs font-mono">
                {JSON.stringify(result.request.headers, null, 2)}
              </pre>
            </div>

            {/* Payload */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Exact JSON Payload Sent
              </span>
              <pre className="p-4 bg-slate-950 text-blue-300 rounded-xl border border-slate-800 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(result.request.payload, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
