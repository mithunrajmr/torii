// frontend/src/pages/ocr/OcrDemoPage.jsx
// Dedicated Gemini Multimodal OCR Demo Testing Studio

import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import ToriiWordmark from '../../components/ToriiWordmark.jsx';
import {
  Upload,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Copy,
  ArrowLeft,
  Cpu,
  RefreshCw,
  Zap,
  Lock,
  Search,
} from 'lucide-react';

export default function OcrDemoPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'db' | 'audit' | 'raw'
  const [copiedTab, setCopiedTab] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  // Helper to handle file selection
  function handleFileChange(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  }

  // Create synthetic demo image blobs for sample preset buttons
  function createSampleImage(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 380;
    const ctx = canvas.getContext('2d');

    if (type === 'pan') {
      // PAN Card simulation
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 600, 380);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, 600, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('INCOME TAX DEPARTMENT - GOVT OF INDIA', 20, 30);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px monospace';
      ctx.fillText('PERMANENT ACCOUNT NUMBER CARD', 20, 80);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('ARJUN SHARMA', 20, 140);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText("FATHER'S NAME: RAMESH SHARMA", 20, 180);
      ctx.fillText('DATE OF BIRTH: 15/05/1990', 20, 210);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('ARJNS1234A', 20, 270);
    } else if (type === 'aadhaar') {
      // Aadhaar Card simulation
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 600, 380);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, 0, 600, 45);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('UNIQUE IDENTIFICATION AUTHORITY OF INDIA', 20, 30);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('PRIYA NAIR', 20, 130);

      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('DOB: 20/10/1992 | GENDER: FEMALE', 20, 170);

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 32px monospace';
      ctx.fillText('9876 5432 1098', 20, 260);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px sans-serif';
      ctx.fillText('AADHAAR — IDENTITY FOR ALL', 20, 330);
    } else {
      // Low clarity / blurry simulation
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 0, 600, 380);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('SAMPLE BLURRY DOCUMENT', 50, 150);
      ctx.fillText('UNREADABLE TEXT EXAMPLE', 50, 200);
    }

    canvas.toBlob((blob) => {
      const file = new File([blob], `sample_${type}.png`, { type: 'image/png' });
      handleFileChange(file);
    }, 'image/png');
  }

  // Execute Gemini OCR Multimodal Analysis via POST /api/sandbox/test-ocr
  async function runGeminiOcr() {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('document', selectedFile);

    try {
      const res = await fetch('/api/mobile/test-ocr', {
        method: 'POST',
        body: formData,
      });


      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Gemini OCR extraction failed.');
      }

      setResult(data);
    } catch (err) {
      console.error('OCR test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text, tabKey) {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white pb-12">
      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Return to Landing Hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center">
                <span className="sr-only">TORII</span>
                <ToriiWordmark className="h-7 w-auto" fill="white" animated />
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" /> Gemini 2.5 Multimodal Lab
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live OCR Document Extraction & Compliance Pipeline Testing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/teller/dashboard"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Teller HITL Dashboard
          </Link>
          <Link
            to="/sandbox"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            Sandbox Control Plane
          </Link>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ── Left Column: Upload & Controls (5 cols) ───────────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Preset Buttons */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> One-Click Test Presets
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => createSampleImage('pan')}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-blue-600/30 border border-slate-700 hover:border-blue-500/50 text-xs font-medium text-slate-200 transition-all text-left"
              >
                💳 PAN Card
              </button>
              <button
                onClick={() => createSampleImage('aadhaar')}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-emerald-600/30 border border-slate-700 hover:border-emerald-500/50 text-xs font-medium text-slate-200 transition-all text-left"
              >
                🆔 Aadhaar
              </button>
              <button
                onClick={() => createSampleImage('low_clarity')}
                className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-amber-600/30 border border-slate-700 hover:border-amber-500/50 text-xs font-medium text-slate-200 transition-all text-left"
              >
                🌫️ Blurry Document
              </button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={[
              'relative rounded-2xl border-2 border-dashed p-6 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[260px]',
              dragActive
                ? 'border-blue-500 bg-blue-500/10'
                : selectedFile
                ? 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                : 'border-slate-800 bg-slate-900/40 hover:border-blue-500/50 hover:bg-slate-900/60',
            ].join(' ')}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileChange(e.target.files[0])}
              accept="image/*"
              className="hidden"
            />

            {imagePreview ? (
              <div className="w-full flex flex-col items-center gap-4">
                <img
                  src={imagePreview}
                  alt="Uploaded document preview"
                  className="max-h-56 rounded-xl object-contain shadow-2xl border border-slate-700"
                />
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-200 truncate max-w-xs">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg">
                  <Upload className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">
                    Click or Drag Document Image Here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PAN Card, Aadhaar, Passport, or Driving License (PNG, JPG, WEBP)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Execution Button */}
          <button
            onClick={runGeminiOcr}
            disabled={!selectedFile || loading}
            className={[
              'w-full py-4 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-xl',
              !selectedFile || loading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.99]',
            ].join(' ')}
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing with Gemini 2.5 Flash…
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-blue-300" />
                Run Gemini Multimodal OCR Analysis
              </>
            )}
          </button>

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Extraction Error</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Extraction Results & Payload Inspector (7 cols) ── */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!result && !loading && (
            <div className="h-full min-h-[400px] border border-slate-800 rounded-2xl bg-slate-900/30 flex flex-col items-center justify-center p-8 text-center">
              <Cpu className="w-12 h-12 text-slate-700 mb-4 animate-bounce" />
              <h3 className="text-base font-bold text-slate-400">Ready for Multimodal OCR</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Upload a document image or select a preset on the left, then click analyze to view real-time Gemini extraction output.
              </p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[400px] border border-blue-500/30 rounded-2xl bg-blue-950/20 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-14 h-14 rounded-full border-4 border-blue-500/30 border-t-blue-400 animate-spin mb-4" />
              <h3 className="text-base font-bold text-blue-300">Analyzing Document Multimodally</h3>
              <p className="text-xs text-blue-400/80 max-w-sm mt-1">
                Gemini is extracting fields, checking alphanumeric confusions, and enforcing Aadhaar privacy rules…
              </p>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-6">
              {/* Metric Summary Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Processing Time</p>
                  <p className="text-lg font-extrabold text-blue-400 mt-1">{result.processing_time_ms} ms</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clarity Score</p>
                  <p className="text-lg font-extrabold text-emerald-400 mt-1">
                    {(result.raw_ocr.clarity_score * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AI Confidence</p>
                  <p className="text-lg font-extrabold text-indigo-400 mt-1">
                    {(result.raw_ocr.confidence * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clarity Gate</p>
                  <span
                    className={[
                      'inline-block px-2 py-0.5 rounded text-xs font-bold mt-1',
                      result.raw_ocr.clarity_score >= 0.8
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                    ].join(' ')}
                  >
                    {result.raw_ocr.clarity_score >= 0.8 ? 'PASS (≥80%)' : 'RETAKE (<80%)'}
                  </span>
                </div>
              </div>

              {/* Badges Ribbon */}
              <div className="flex flex-wrap items-center gap-3">
                {result.raw_ocr.is_specimen_or_dummy && (
                  <span className="px-3 py-1 rounded-full bg-red-500/30 border border-red-500/60 text-red-300 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    REJECTED: SPECIMEN / DUMMY / SAMPLE DOCUMENT DETECTED
                  </span>
                )}
                {result.raw_ocr.tampering_detected && !result.raw_ocr.is_specimen_or_dummy && (
                  <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    REJECTED: {result.raw_ocr.rejection_reason || 'DOCUMENT_DEFACED_OR_SCRIBBLED'}
                  </span>
                )}
                {result.audit_payload.heuristic_corrections_applied && (
                  <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Heuristic Correction Active
                  </span>
                )}
                {result.audit_payload.privacy_masked && (
                  <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> Aadhaar Privacy Masked
                  </span>
                )}
              </div>



              {/* Inspection Tabs */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab('visual')}
                    className={[
                      'px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2',
                      activeTab === 'visual'
                        ? 'border-blue-500 text-blue-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    <FileText className="w-4 h-4" /> Formatted UI View
                  </button>
                  <button
                    onClick={() => setActiveTab('db')}
                    className={[
                      'px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2',
                      activeTab === 'db'
                        ? 'border-blue-500 text-blue-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    App DB Payload (`ocr_data`)
                  </button>
                  <button
                    onClick={() => setActiveTab('audit')}
                    className={[
                      'px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2',
                      activeTab === 'audit'
                        ? 'border-blue-500 text-blue-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    Audit Event Payload
                  </button>
                  <button
                    onClick={() => setActiveTab('raw')}
                    className={[
                      'px-4 py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2',
                      activeTab === 'raw'
                        ? 'border-blue-500 text-blue-400 bg-slate-900'
                        : 'border-transparent text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    Raw JSON
                  </button>
                </div>

                <div className="p-6">
                  {/* Tab 1: Formatted UI View */}
                  {activeTab === 'visual' && (
                    <div className="flex flex-col gap-4">
                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Extracted Name
                          </p>
                          <p className="text-base font-extrabold text-slate-100 mt-0.5">
                            {result.raw_ocr.name || 'UNKNOWN'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Document ID Type
                          </p>
                          <span className="inline-block px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 font-bold text-xs mt-0.5 border border-blue-500/30">
                            {result.raw_ocr.id_type || 'PAN'}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            ID / Document Number
                          </p>
                          <p className="text-base font-mono font-bold text-emerald-400 mt-0.5">
                            {result.raw_ocr.id_number || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Extracted PAN Number
                          </p>
                          <p className="text-base font-mono font-bold text-blue-400 mt-0.5">
                            {result.raw_ocr.pan_number || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Date of Birth
                          </p>
                          <p className="text-sm font-semibold text-slate-300 mt-0.5">
                            {result.raw_ocr.dob || 'Not detected'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Extraction Confidence
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${result.raw_ocr.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-slate-300">
                              {(result.raw_ocr.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: App DB Payload */}
                  {activeTab === 'db' && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(result.db_payload, null, 2), 'db')
                        }
                        className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedTab === 'db' ? 'Copied!' : 'Copy'}
                      </button>
                      <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800">
                        {JSON.stringify(result.db_payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Tab 3: Audit Event Payload */}
                  {activeTab === 'audit' && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(result.audit_payload, null, 2), 'audit')
                        }
                        className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedTab === 'audit' ? 'Copied!' : 'Copy'}
                      </button>
                      <pre className="p-4 rounded-xl bg-slate-950 text-indigo-300 font-mono text-xs overflow-x-auto border border-slate-800">
                        {JSON.stringify(result.audit_payload, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Tab 4: Raw JSON */}
                  {activeTab === 'raw' && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(result, null, 2), 'raw')
                        }
                        className="absolute top-2 right-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedTab === 'raw' ? 'Copied!' : 'Copy'}
                      </button>
                      <pre className="p-4 rounded-xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800 max-h-96">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
