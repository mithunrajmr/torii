// frontend/src/pages/debug/AgentDebugConsole.jsx
// TORII Agent Debug & Validation Console
//
// ISOLATED DEBUG PAGE — For testing every IBM watsonx Orchestrate agent independently.
// Does NOT modify production code or existing routes.
// Strictly read-only for database queries.

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Database,
  Edit3,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Code,
  FileText,
  Activity,
  Upload,
  Cpu,
  Layers,
  ArrowRight
} from 'lucide-react';
import AgentCard from '../../components/debug/AgentCard.jsx';
import ResponseComparer from '../../components/debug/ResponseComparer.jsx';
import ExecutionHistory from '../../components/debug/ExecutionHistory.jsx';

export default function AgentDebugConsole() {
  const [agents, setAgents] = useState([]);
  const [systemConfig, setSystemConfig] = useState(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState('orchestrator');
  const [dataMode, setDataMode] = useState('SUPABASE'); // 'SUPABASE' | 'MANUAL'

  // Real Supabase State
  const [supabaseAccounts, setSupabaseAccounts] = useState([]);
  const [dbSource, setDbSource] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // Manual Test Input State
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualContextJson, setManualContextJson] = useState('{}');
  const [documentBase64, setDocumentBase64] = useState('');
  const [documentMimeType, setDocumentMimeType] = useState('image/jpeg');

  // Execution & Output State
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState(null);

  // History Log State
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('torii_debug_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 1. Fetch Discovered Agents
  useEffect(() => {
    fetch('/api/debug/agents')
      .then((res) => res.json())
      .then((data) => {
        setAgents(data.agents || []);
        setSystemConfig(data.systemConfig || null);
      })
      .catch((err) => console.error('Failed to load agent metadata:', err));
  }, []);

  // 2. Fetch Real Supabase Records
  useEffect(() => {
    setIsLoadingDb(true);
    fetch('/api/debug/supabase-data')
      .then((res) => res.json())
      .then((data) => {
        setSupabaseAccounts(data.accounts || []);
        setDbSource(data.source || '');
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0].id);
        }
      })
      .catch((err) => console.error('Failed to fetch Supabase records:', err))
      .finally(() => setIsLoadingDb(false));
  }, []);

  // Save execution history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('torii_debug_history', JSON.stringify(history.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to persist debug history:', e);
    }
  }, [history]);

  const selectedAgent = agents.find((a) => a.key === selectedAgentKey) || agents[0];
  const selectedAccount = supabaseAccounts.find((a) => a.id === selectedAccountId);

  // Auto-populate default prompt when agent changes
  useEffect(() => {
    if (selectedAgent) {
      setManualPrompt(selectedAgent.defaultPrompt || '');
      setManualContextJson(JSON.stringify(selectedAgent.defaultContext || {}, null, 2));
    }
  }, [selectedAgentKey]);

  // Construct payload to display on screen & send to backend
  const getConstructedPayload = () => {
    if (!selectedAgent) return { prompt: '', context: {} };

    if (dataMode === 'SUPABASE' && selectedAccount) {
      switch (selectedAgent.key) {
        case 'orchestrator':
          return {
            prompt: `Classify intent for customer ${selectedAccount.full_name} (Acc: ${selectedAccount.account_number})`,
            context: {
              has_failed_pan_tx: selectedAccount.hasFailedPanTx,
              recent_error_code: selectedAccount.recentErrorCode,
              account_number: selectedAccount.account_number,
              balance: selectedAccount.balance,
            },
          };
        case 'watchdog':
          return {
            prompt: `Analyse 48-hour transactions for ${selectedAccount.full_name}:\n${JSON.stringify(selectedAccount.transactions, null, 2)}`,
            context: { account_id: selectedAccount.id },
          };
        case 'advisor':
          return {
            prompt: `Generate cross-sell offer for account_balance=${selectedAccount.balance} preferred_language="en"`,
            context: {
              customer_name: selectedAccount.full_name,
              balance: selectedAccount.balance,
              pan_linked: selectedAccount.pan_linked,
            },
          };
        case 'faq':
          return {
            prompt: selectedAccount.hasFailedPanTx
              ? 'Why is my transaction failing over 50,000 rupees?'
              : 'What are the minimum average monthly balance rules?',
            context: { account_number: selectedAccount.account_number },
          };
        case 'localizer':
          return {
            prompt: `Process kiosk input:\nraw_text: "Customer ${selectedAccount.full_name} account ${selectedAccount.account_number} balance is ${selectedAccount.balance}"\ndeclared_language: "auto"`,
            context: {},
          };
        case 'vision':
          return {
            prompt: `Extract PAN identity metadata for ${selectedAccount.full_name}`,
            context: {
              target_name: selectedAccount.full_name,
              expected_pan: selectedAccount.pan_number,
            },
          };
        default:
          return { prompt: selectedAgent.defaultPrompt, context: {} };
      }
    }

    // Manual Data Mode
    let parsedCtx = {};
    try {
      parsedCtx = JSON.parse(manualContextJson);
    } catch {
      parsedCtx = { parse_error: 'Invalid JSON in manual context' };
    }

    return {
      prompt: manualPrompt,
      context: parsedCtx,
    };
  };

  const payloadPreview = getConstructedPayload();

  // Execute Selected Agent Directly
  const handleExecuteAgent = async () => {
    if (!selectedAgent) return;
    setIsExecuting(true);

    const payload = getConstructedPayload();

    const requestBody = {
      agentKey: selectedAgent.key,
      userMsg: payload.prompt,
      context: payload.context,
      documentBase64: selectedAgent.key === 'vision' ? documentBase64 : undefined,
      mimeType: selectedAgent.key === 'vision' ? documentMimeType : undefined,
    };

    try {
      const res = await fetch('/api/debug/execute-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      setCurrentResult(data);

      // Append to execution history
      const historyItem = {
        id: `run_${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentKey: selectedAgent.key,
        agentName: selectedAgent.name,
        inputSource: dataMode,
        status: data.status,
        httpStatus: data.httpStatus,
        timing: data.timing,
        resultSnapshot: data.response?.parsed || data.error?.message || 'Done',
        fullData: data,
      };

      setHistory((prev) => [historyItem, ...prev]);
    } catch (err) {
      console.error('Execution request error:', err);
      const errResult = {
        status: 'FAILURE',
        agentKey: selectedAgent.key,
        agentName: selectedAgent.name,
        agentId: selectedAgent.agentId,
        httpStatus: 500,
        timing: { latencyMs: 0, startTime: new Date().toISOString(), endTime: new Date().toISOString() },
        error: { message: err.message, stack: err.stack },
      };
      setCurrentResult(errResult);
    } finally {
      setIsExecuting(false);
    }
  };

  // Image Upload Handler for Vision Agent
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setDocumentMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result;
      const base64Str = resultStr.split(',')[1];
      setDocumentBase64(base64Str);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  TORII Agent Debug & Validation Console
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                    v1.0 (Isolated)
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct independent agent execution with real Supabase data & raw watsonx response inspection
                </p>
              </div>
            </div>
          </div>

          {/* System Status Indicators */}
          {systemConfig && (
            <div className="flex items-center gap-3 text-xs font-mono bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    systemConfig.apiKeyConfigured ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span className="text-slate-400">IAM Key:</span>
                <span className={systemConfig.apiKeyConfigured ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {systemConfig.apiKeyConfigured ? 'PRESENT' : 'MISSING'}
                </span>
              </div>

              <span className="text-slate-700">|</span>

              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    systemConfig.endpointConfigured ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                />
                <span className="text-slate-400">Endpoint:</span>
                <span className="text-slate-200 truncate max-w-[150px]">
                  {systemConfig.endpoint || 'Not Set'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Phase 3: Agent Discovery UI Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Discovered watsonx Orchestrate Agents ({agents.length})
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Click an agent to configure payload & execute
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.key}
                agent={agent}
                isSelected={agent.key === selectedAgentKey}
                onSelect={() => setSelectedAgentKey(agent.key)}
              />
            ))}
          </div>
        </div>

        {/* Phase 4 & 5: Payload Configuration & Data Mode Switcher */}
        {selectedAgent && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-400" />
                  Testing Agent: <span className="text-blue-400">{selectedAgent.name}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">{selectedAgent.purpose}</p>
              </div>

              {/* Data Source Switcher Tabs */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setDataMode('SUPABASE')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    dataMode === 'SUPABASE'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Real Supabase Data</span>
                </button>

                <button
                  onClick={() => setDataMode('MANUAL')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    dataMode === 'MANUAL'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Manual Test Input</span>
                </button>
              </div>
            </div>

            {/* REAL SUPABASE DATA MODE */}
            {dataMode === 'SUPABASE' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" />
                    Select Account Record from Supabase ({dbSource || 'Database'}):
                  </label>
                  {isLoadingDb && (
                    <span className="text-xs text-blue-400 animate-pulse font-mono">
                      Loading records...
                    </span>
                  )}
                </div>

                {/* Account Picker */}
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:border-blue-500 font-mono"
                >
                  {supabaseAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      Account {acc.account_number} — {acc.full_name} (₹{acc.balance.toLocaleString('en-IN')}) {acc.hasFailedPanTx ? '[PAN BLOCKED]' : '[CLEAN]'}
                    </option>
                  ))}
                </select>

                {/* Retrieved Data Display */}
                {selectedAccount && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    {/* Account Details Card */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                        Retrieved Customer Details
                      </span>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-mono">Customer Name:</span>
                          <p className="font-semibold text-slate-200">{selectedAccount.full_name}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-mono">Account Number:</span>
                          <p className="font-semibold font-mono text-blue-400">{selectedAccount.account_number}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-mono">Balance:</span>
                          <p className="font-semibold text-emerald-400 font-mono">
                            ₹{selectedAccount.balance.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-mono">PAN Linked Status:</span>
                          <p className="font-semibold">
                            {selectedAccount.pan_linked ? (
                              <span className="text-emerald-400">Linked ({selectedAccount.pan_number})</span>
                            ) : (
                              <span className="text-amber-400">Not Linked (Missing)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800 text-xs">
                        <span className="text-slate-500 font-mono">Email: </span>
                        <span className="text-slate-300 font-mono">{selectedAccount.email}</span>
                      </div>
                    </div>

                    {/* Transactions Card */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                          Recent 48h Transactions ({selectedAccount.transactions.length})
                        </span>
                        {selectedAccount.hasFailedPanTx && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                            PAN Failures Detected
                          </span>
                        )}
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-2 text-xs font-mono">
                        {selectedAccount.transactions.length > 0 ? (
                          selectedAccount.transactions.map((tx) => (
                            <div
                              key={tx.id}
                              className="p-2 rounded bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                            >
                              <div>
                                <span className="text-slate-200">₹{tx.amount.toLocaleString('en-IN')}</span>
                                {tx.error_code && (
                                  <span className="ml-2 text-[10px] text-rose-400 font-bold">
                                    [{tx.error_code}]
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500">
                                {new Date(tx.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-500 italic">No transactions in 48h window.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MANUAL TEST DATA MODE */}
            {dataMode === 'MANUAL' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-mono mb-2">
                    Customer Prompt / Text Input:
                  </label>
                  <textarea
                    rows={3}
                    value={manualPrompt}
                    onChange={(e) => setManualPrompt(e.target.value)}
                    placeholder="Enter customer input or query string..."
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 font-mono mb-2">
                    Context Object (JSON):
                  </label>
                  <textarea
                    rows={3}
                    value={manualContextJson}
                    onChange={(e) => setManualContextJson(e.target.value)}
                    placeholder='{"has_failed_pan_tx": true}'
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-3 focus:outline-none focus:border-purple-500 font-mono"
                  />
                </div>

                {/* File upload for Vision Agent */}
                {selectedAgent.key === 'vision' && (
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <label className="block text-xs font-semibold text-slate-300 font-mono flex items-center gap-2">
                      <Upload className="w-4 h-4 text-purple-400" />
                      Upload PAN Card Image (Vision OCR Agent Testing):
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="text-xs text-slate-400 font-mono file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                    />
                    {documentBase64 && (
                      <p className="text-xs text-emerald-400 font-mono">
                        Image loaded ({Math.round(documentBase64.length / 1024)} KB base64)
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Exact Payload Preview */}
            <div className="pt-4 border-t border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                Payload Sent to Agent ({dataMode} Mode)
              </span>
              <pre className="p-4 bg-slate-950 text-blue-300 rounded-xl border border-slate-800 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {JSON.stringify(payloadPreview, null, 2)}
              </pre>
            </div>

            {/* Execute Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExecuteAgent}
                disabled={isExecuting}
                className="flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-all shadow-lg shadow-blue-600/20"
              >
                {isExecuting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    <span>Executing {selectedAgent.name}...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Execute Agent ({selectedAgent.key})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Phase 6 & 7: Output, Response Comparer & Errors */}
        {currentResult && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Latest Execution Results & Response Inspection
            </h2>

            <ResponseComparer
              result={currentResult}
              onRetry={handleExecuteAgent}
              isExecuting={isExecuting}
            />
          </div>
        )}

        {/* Phase 9: Persistent Execution History Log */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <ExecutionHistory
            history={history}
            onSelectHistoryItem={(item) => setCurrentResult(item.fullData || item)}
            onClearHistory={() => setHistory([])}
          />
        </div>
      </div>
    </div>
  );
}
