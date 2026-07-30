// frontend/src/pages/presentation/PresentationDeck.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ToriiLogo from '../../components/ToriiLogo.jsx';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Grid,
  Play,
  RotateCcw,
  ShieldCheck,
  Zap,
  Cpu,
  Lock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Activity,
  FileText,
  UserCheck,
  Clock,
  ExternalLink,
  Sun,
  Moon,
  AlertCircle,
  Server,
  Layers,
  Check,
  RefreshCw,
  Search
} from 'lucide-react';

const TOTAL_SLIDES = 8;

export default function PresentationDeck() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [themeMode, setThemeMode] = useState('light'); // 'light' (default) | 'dark'

  // AI Swarm Interactive Simulation State (Slide 5)
  const [swarmStep, setSwarmStep] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'COMPLETE'
  const [swarmProgress, setSwarmProgress] = useState(0);

  const containerRef = useRef(null);

  // Pitch stopwatch timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Space' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 't' || e.key === 'T') {
        setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
      } else if (e.key === 'Escape') {
        setShowThumbnails(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, themeMode]);

  const nextSlide = () => {
    if (currentSlide < TOTAL_SLIDES) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 1) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Trigger Swarm Simulation (Slide 5)
  const runSwarmSimulation = () => {
    setSwarmStep('RUNNING');
    setSwarmProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setSwarmProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setSwarmStep('COMPLETE');
      }
    }, 140);
  };

  const resetSwarmSimulation = () => {
    setSwarmStep('IDLE');
    setSwarmProgress(0);
  };

  const isLight = themeMode === 'light';

  return (
    <div
      ref={containerRef}
      className={`min-h-screen flex flex-col justify-between select-none overflow-hidden relative font-sans transition-colors duration-300 ${
        isLight ? 'bg-[#f4f6fa] text-slate-800' : 'bg-[#070a12] text-slate-100'
      }`}
    >
      {/* Ambient background glow */}
      {isLight ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#e0e7ff_0%,#f4f6fa_70%)] pointer-events-none opacity-80" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,#070a12_70%)] pointer-events-none opacity-60" />
      )}

      {/* Top Header Navigation Bar */}
      <header
        className={`relative z-20 px-6 py-4 border-b flex items-center justify-between backdrop-blur-md transition-colors ${
          isLight ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-[#070a12]/80 border-slate-800'
        }`}
      >
        <div className="flex items-center space-x-4">
          <ToriiLogo variant="horizontal" size="sm" dark={!isLight} />
          <span
            className={`text-xs uppercase tracking-widest px-3 py-1 rounded-full font-semibold border ${
              isLight
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
            }`}
          >
            IBM Hackathon Presentation
          </span>
        </div>

        {/* Slide Title Indicator */}
        <div className="hidden md:flex items-center space-x-2 text-xs font-medium tracking-wide">
          <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>SLIDE {currentSlide} OF {TOTAL_SLIDES}:</span>
          <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            {currentSlide === 1 && '1. The Industry Problem Statement'}
            {currentSlide === 2 && '2. Deep Dive: Branch Bottlenecks & Issues'}
            {currentSlide === 3 && '3. Introducing TORII — The Gateway Engine'}
            {currentSlide === 4 && '4. Login Swarm & Proactive Diagnosis'}
            {currentSlide === 5 && '5. Parallel AI Agent Swarm Engine'}
            {currentSlide === 6 && '6. IBM watsonx Orchestrate Architecture'}
            {currentSlide === 7 && '7. Privacy by Design & HITL Governance'}
            {currentSlide === 8 && '8. Business Impact & Live Demo Launchpad'}
          </span>
        </div>

        {/* Top Controls: Pitch Stopwatch & Toggles */}
        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-indigo-700'
                : 'bg-slate-900 border-slate-800 text-cyan-400'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>PITCH: {formatTime(elapsedSeconds)}</span>
          </div>

          <button
            onClick={() => setThemeMode(isLight ? 'dark' : 'light')}
            className={`p-2 rounded-lg border transition ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800'
            }`}
            title="Toggle Theme (T)"
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={`p-2 rounded-lg border transition ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="Slide Grid Drawer"
          >
            <Grid className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg border transition ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Slide Stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 md:p-10 overflow-y-auto">
        {/* ========================================================================= */}
        {/* SLIDE 1: THE PROBLEM STATEMENT HOOK */}
        {/* ========================================================================= */}
        {currentSlide === 1 && (
          <div className="max-w-5xl w-full text-center space-y-8 animate-fadeIn">
            <div
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full border text-xs font-semibold tracking-wide ${
                isLight
                  ? 'bg-rose-50 border-rose-200 text-rose-700'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />
              <span>Retail Banking Problem Statement & Industry Friction</span>
            </div>

            <div className="space-y-4 max-w-3xl mx-auto">
              <h1
                className={`text-4xl md:text-6xl font-black tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Rethinking Physical Branch Operations
              </h1>
              <p className={`text-xl md:text-2xl font-light leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                "Every day, millions of customers walk into bank branches not because they need a teller—but because they don't know what to do next."
              </p>
            </div>

            {/* Key Industry Problem Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto pt-4">
              <div className={`p-6 rounded-3xl border text-left space-y-2 ${isLight ? 'bg-white border-rose-200 shadow-md' : 'bg-slate-900/80 border-rose-900/40'}`}>
                <div className="text-4xl font-black text-rose-600">45+ MIN</div>
                <div className="text-sm font-bold text-slate-900">Average Lobby Wait Time</div>
                <p className="text-xs text-slate-500">Customers stand in line simply to ask basic questions or resolve unexpected compliance holds.</p>
              </div>

              <div className={`p-6 rounded-3xl border text-left space-y-2 ${isLight ? 'bg-white border-rose-200 shadow-md' : 'bg-slate-900/80 border-rose-900/40'}`}>
                <div className="text-4xl font-black text-rose-600">70%</div>
                <div className="text-sm font-bold text-slate-900">Teller Manual Typing Load</div>
                <p className="text-xs text-slate-500">Bank tellers spend most working hours acting as data typists—copying numbers into software.</p>
              </div>

              <div className={`p-6 rounded-3xl border text-left space-y-2 ${isLight ? 'bg-white border-rose-200 shadow-md' : 'bg-slate-900/80 border-rose-900/40'}`}>
                <div className="text-4xl font-black text-rose-600">₹75,000+</div>
                <div className="text-sm font-bold text-slate-900">Blocked Transactions</div>
                <p className="text-xs text-slate-500">Transactions fail at point-of-sale due to unlinked PAN cards under Tax Act Sec 139A.</p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 2: DEEP DIVE: BRANCH BOTTLENECKS & ISSUES */}
        {/* ========================================================================= */}
        {currentSlide === 2 && (
          <div className="max-w-5xl w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Deep Dive: The 3 Core Branch Issues
              </h2>
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Analyzing the operational breakdown in traditional branch workflows
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className={`p-7 rounded-3xl border space-y-4 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-rose-100 text-rose-600 font-bold">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">1. Pre-Counter Queue Uncertainty</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Customers wait 45 minutes in line only to discover at the counter that they brought the wrong paperwork or that their account requires a different branch desk entirely.
                </p>
              </div>

              <div className={`p-7 rounded-3xl border space-y-4 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-amber-100 text-amber-600 font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">2. Teller Data-Entry Fatigue</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tellers spend 10+ minutes per customer reading small print off physical paper forms and typing 10-character PANs and Aadhaar numbers into legacy CBS software.
                </p>
              </div>

              <div className={`p-7 rounded-3xl border space-y-4 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-purple-100 text-purple-600 font-bold">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">3. Manual Inspection Risks</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Manual visual checks miss fraudulent specimen cards, finger/hand obstructions over card borders, defaced documents, and subtle character confusions (e.g. 'O' vs '0').
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 3: INTRODUCING TORII — THE GATEWAY SOLUTION */}
        {/* ========================================================================= */}
        {currentSlide === 3 && (
          <div className="max-w-5xl w-full text-center space-y-8 animate-fadeIn">
            <div className="flex justify-center">
              <div className="relative">
                <div className={`absolute inset-0 rounded-full blur-2xl ${isLight ? 'bg-indigo-300/40' : 'bg-indigo-500/20'}`} />
                <ToriiLogo variant="full" size="lg" dark={!isLight} showTagline={false} />
              </div>
            </div>

            <div className="space-y-3 max-w-3xl mx-auto">
              <span className="text-xs uppercase tracking-widest font-bold text-indigo-600">The Solution</span>
              <h2 className={`text-4xl md:text-5xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Introducing TORII (鳥居)
              </h2>
              <p className={`text-base md:text-lg font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                The Secure Gateway from Branch Friction to Operational Harmony
              </p>
            </div>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-2">
              {[
                { label: 'Self-Service Kiosk', desc: 'Voice & Proactive Radar Triage', icon: Cpu, color: 'text-indigo-600' },
                { label: 'Mobile QR Continuation', desc: '10-min Ephemeral Handoff', icon: Lock, color: 'text-cyan-600' },
                { label: 'Parallel AI Swarm', desc: 'IBM watsonx Orchestrate', icon: Zap, color: 'text-purple-600' },
                { label: 'HITL Teller Portal', desc: '1-Click Compliance Authorization', icon: ShieldCheck, color: 'text-emerald-600' }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl border text-left transition transform hover:-translate-y-1 ${
                    isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <item.icon className={`w-7 h-7 mb-3 ${item.color}`} />
                  <div className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{item.label}</div>
                  <div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 4: LOGIN SWARM & PROACTIVE DIAGNOSIS AGENTS */}
        {/* ========================================================================= */}
        {currentSlide === 4 && (
          <div className="max-w-5xl w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Kiosk Login & Proactive Swarm Agents
              </h2>
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                What micro-agents launch the exact moment a customer authenticates at the kiosk
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Agent 1: Proactive Radar */}
              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-indigo-100 text-indigo-700 font-bold">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">1. Proactive Radar Agent</h3>
                    <div className="text-xs text-indigo-600 font-semibold">Account State & Hold Triage</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Evaluates account compliance flags in real-time. Immediately alerts Arjun that his ₹75,000 transaction is blocked due to unlinked PAN (Sec 139A) and offers 1-click agentic resolution.
                </p>
              </div>

              {/* Agent 2: FAQ RAG Voice Agent */}
              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-purple-100 text-purple-700 font-bold">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">2. FAQ & Natural Voice RAG Agent</h3>
                    <div className="text-xs text-purple-600 font-semibold">Speech Recognition & Intent Router</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Listens to customer spoken questions in Indian English (<code className="text-purple-700 font-bold">en-IN</code>), parses banking intent, and delivers spoken step-by-step guidance.
                </p>
              </div>

              {/* Agent 3: Watchdog AML Check */}
              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">3. Watchdog Risk Agent</h3>
                    <div className="text-xs text-emerald-600 font-semibold">IBM watsonx Orchestrate Integration</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Runs background inspection on 30-day transaction history to ensure no active SAR alerts or structuring patterns exist before initiating document handoff.
                </p>
              </div>

              {/* Agent 4: Cross-Sell Advisor */}
              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-xl bg-amber-100 text-amber-700 font-bold">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">4. Financial Advisor Agent</h3>
                    <div className="text-xs text-amber-600 font-semibold">IBM watsonx Orchestrate Advisor</div>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Evaluates customer balance tier and pre-approves personalized product offers (e.g. ₹2,50,000 credit line) delivered directly to their mobile PWA screen.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 5: INTERACTIVE PARALLEL AI SWARM VISUALIZER */}
        {/* ========================================================================= */}
        {currentSlide === 5 && (
          <div className="max-w-5xl w-full space-y-6 animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className={`text-3xl font-black flex items-center space-x-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <span>Document Verification Swarm</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-mono font-bold border border-purple-200">
                    Promise.all() Execution
                  </span>
                </h2>
                <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Live simulation showing micro-agents running concurrently in &lt; 1.8 seconds
                </p>
              </div>

              <div className="flex items-center space-x-3">
                {swarmStep === 'IDLE' && (
                  <button
                    onClick={runSwarmSimulation}
                    className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-lg shadow-purple-500/25 transition transform active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Run Interactive Swarm Demo</span>
                  </button>
                )}

                {swarmStep === 'RUNNING' && (
                  <div className="flex items-center space-x-3 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-mono font-bold text-indigo-700">
                    <div className="w-3 h-3 rounded-full bg-indigo-600 animate-ping" />
                    <span>PROCESSING SWARM ({swarmProgress}%)</span>
                  </div>
                )}

                {swarmStep === 'COMPLETE' && (
                  <button
                    onClick={resetSwarmSimulation}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Simulation</span>
                  </button>
                )}
              </div>
            </div>

            {/* Agent Swarm Bento Cards */}
            <div className="grid md:grid-cols-2 gap-5">
              {/* Agent 1 */}
              <div
                className={`p-6 rounded-2xl border transition-all duration-500 ${
                  swarmStep === 'RUNNING'
                    ? 'border-indigo-500 ring-2 ring-indigo-400/30 scale-[1.01]'
                    : isLight
                    ? 'bg-white border-slate-200 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 font-bold">
                      <Eye className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-slate-900">Vision OCR Agent</div>
                      <div className="text-xs text-slate-500 font-medium">Multimodal Vision OCR Engine</div>
                    </div>
                  </div>
                  {swarmStep === 'COMPLETE' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      CONF: 98.4%
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-1.5 text-slate-700">
                  <div>Extracted Name: <span className="text-indigo-700 font-bold">ARJUN SHARMA</span></div>
                  <div>PAN Number: <span className="text-indigo-700 font-bold">ABCDE1234F</span></div>
                  <div>Specimen/Dummy Check: <span className="text-emerald-600 font-bold">PASSED</span></div>
                  <div>Aadhaar Privacy Mask: <span className="text-cyan-700 font-bold">XXXX-XXXX-1234</span></div>
                </div>
              </div>

              {/* Agent 2 */}
              <div
                className={`p-6 rounded-2xl border transition-all duration-500 ${
                  swarmStep === 'RUNNING'
                    ? 'border-cyan-500 ring-2 ring-cyan-400/30 scale-[1.01]'
                    : isLight
                    ? 'bg-white border-slate-200 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-cyan-100 text-cyan-700 font-bold">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-slate-900">Fuzzy Entity Matcher Agent</div>
                      <div className="text-xs text-slate-500 font-medium">Jaro-Winkler Distance Engine</div>
                    </div>
                  </div>
                  {swarmStep === 'COMPLETE' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      MATCH: 96.2%
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-1.5 text-slate-700">
                  <div>Document Name: <span className="text-cyan-700 font-bold">ARJUN SHARMA</span></div>
                  <div>Account Record Name: <span className="text-cyan-700 font-bold">ARJUN S.</span></div>
                  <div>Similarity Score: <span className="text-emerald-600 font-bold">0.962 (96.2%)</span></div>
                  <div>Soft Flag Evaluation: <span className="text-emerald-600 font-bold">APPROVED</span></div>
                </div>
              </div>

              {/* Agent 3 */}
              <div
                className={`p-6 rounded-2xl border transition-all duration-500 ${
                  swarmStep === 'RUNNING'
                    ? 'border-purple-500 ring-2 ring-purple-400/30 scale-[1.01]'
                    : isLight
                    ? 'bg-white border-slate-200 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 font-bold">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-slate-900">Watchdog AML Agent</div>
                      <div className="text-xs text-slate-500 font-medium">IBM watsonx Orchestrate Pipeline</div>
                    </div>
                  </div>
                  {swarmStep === 'COMPLETE' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      RISK: LOW
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-1.5 text-slate-700">
                  <div>30-Day Transactions Checked: <span className="text-purple-700 font-bold">12 Records</span></div>
                  <div>Structuring Check (&lt; ₹50k): <span className="text-emerald-600 font-bold">CLEAN</span></div>
                  <div>Sanctions Match Score: <span className="text-emerald-600 font-bold">0.00 (No Hits)</span></div>
                  <div>Compliance Status: <span className="text-emerald-600 font-bold">PASS</span></div>
                </div>
              </div>

              {/* Agent 4 */}
              <div
                className={`p-6 rounded-2xl border transition-all duration-500 ${
                  swarmStep === 'RUNNING'
                    ? 'border-amber-500 ring-2 ring-amber-400/30 scale-[1.01]'
                    : isLight
                    ? 'bg-white border-slate-200 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 font-bold">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-base text-slate-900">Cross-Sell Advisor Agent</div>
                      <div className="text-xs text-slate-500 font-medium">IBM watsonx Orchestrate Advisor</div>
                    </div>
                  </div>
                  {swarmStep === 'COMPLETE' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                      OFFER READY
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-1.5 text-slate-700">
                  <div>Pre-Approved Product: <span className="text-amber-700 font-bold">₹2,50,000 Credit Line</span></div>
                  <div>Customer Balance Tier: <span className="text-amber-700 font-bold">PREMIER</span></div>
                  <div>Offer Delivery Channel: <span className="text-emerald-600 font-bold">MOBILE PWA</span></div>
                  <div>Campaign Code: <span className="text-amber-700 font-bold">TORII_FLEX_2026</span></div>
                </div>
              </div>
            </div>

            {swarmStep === 'COMPLETE' && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-800 animate-fadeIn font-semibold">
                <div className="flex items-center space-x-2 font-mono">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>PARALLEL SWARM COMPLETED IN 1.42s VIA PROMISE.ALL()</span>
                </div>
                <span className="text-emerald-700">Telemetry logged to agent_performance_log</span>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 6: IBM WATSONX ORCHESTRATE DUAL-ENGINE ARCHITECTURE */}
        {/* ========================================================================= */}
        {currentSlide === 6 && (
          <div className="max-w-5xl w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                IBM watsonx Orchestrate Architecture
              </h2>
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Enterprise Agent Orchestration Hub & Dual-Engine Failover Resilience
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Primary Engine */}
              <div className={`p-7 rounded-3xl border space-y-4 ${isLight ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-md' : 'bg-slate-900 border-indigo-500/40'}`}>
                <div className="flex items-center space-x-3 border-b border-indigo-200/60 pb-3">
                  <div className="p-3 rounded-xl bg-indigo-600 text-white font-bold">
                    <Server className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Primary Enterprise Orchestrator</h3>
                    <div className="text-xs text-indigo-700 font-bold">IBM watsonx Orchestrate Agent Engine</div>
                  </div>
                </div>

                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 font-bold">✓</span>
                    <span><strong>IBM Cloud IAM Token Exchange:</strong> Short-lived Bearer tokens refreshed dynamically on 55-min windows via <code className="text-indigo-700 font-bold">orchestrateClient.js</code>.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 font-bold">✓</span>
                    <span><strong>Server-Sent Events (SSE) Streaming:</strong> Real-time chunked response parsing from watsonx agent endpoints.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-indigo-600 font-bold">✓</span>
                    <span><strong>Watchdog & Advisor Agents:</strong> Executes enterprise AML structuring checks and personalized campaign cross-sell recommendations.</span>
                  </li>
                </ul>
              </div>

              {/* Resilience Engine */}
              <div className={`p-7 rounded-3xl border space-y-4 ${isLight ? 'bg-gradient-to-br from-cyan-50 to-slate-50 border-cyan-200 shadow-md' : 'bg-slate-900 border-cyan-500/40'}`}>
                <div className="flex items-center space-x-3 border-b border-cyan-200/60 pb-3">
                  <div className="p-3 rounded-xl bg-cyan-600 text-white font-bold">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Dual-Engine Failover Resilience</h3>
                    <div className="text-xs text-cyan-700 font-bold">Zero-Downtime High-Availability Architecture</div>
                  </div>
                </div>

                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-600 font-bold">✓</span>
                    <span><strong>100% Operational Uptime:</strong> If cloud network latency occurs, the local micro-agent engine immediately fulfills agentic requests.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-600 font-bold">✓</span>
                    <span><strong>Seamless JSON Schema Alignment:</strong> Guaranteed identical output schemas across primary and fallback channels.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-cyan-600 font-bold">✓</span>
                    <span><strong>Zero-Interruption Branch Experience:</strong> Customers and tellers experience zero disruption during live branch operations.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 7: PRIVACY BY DESIGN & HITL GOVERNANCE */}
        {/* ========================================================================= */}
        {currentSlide === 7 && (
          <div className="max-w-5xl w-full space-y-8 animate-fadeIn">
            <div className="text-center space-y-2">
              <h2 className={`text-3xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Privacy by Design & HITL Governance
              </h2>
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Enterprise regulatory compliance & zero PII exposure architecture
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-indigo-100 text-indigo-700 font-bold">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">1. Ephemeral QR Continuation</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Public kiosk touchscreens are used strictly for triage. Sensitive document uploads hand off to personal smartphones using single-use 10-minute Redis session tokens. Zero PII is typed on public screens.
                </p>
              </div>

              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-cyan-100 text-cyan-700 font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">2. Aadhaar 8-Digit Privacy Masking</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Both Vision OCR and frontend parsers enforce UIDAI privacy compliance, automatically masking the first 8 digits of Aadhaar numbers (<code className="text-cyan-700 font-bold">XXXX-XXXX-1234</code>).
                </p>
              </div>

              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-purple-100 text-purple-700 font-bold">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">3. Governance Sidecar Redaction</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  <code className="text-purple-700 font-bold">governanceSidecar.js</code> deep-scans JSON objects before database insertion, converting all PAN numbers to <code className="text-purple-700 font-bold">XXXXX-1234-X</code> and account numbers to <code className="text-purple-700 font-bold">****1234</code>.
                </p>
              </div>

              <div className={`p-6 rounded-3xl border space-y-3 ${isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="p-3 w-fit rounded-xl bg-emerald-100 text-emerald-700 font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">4. 100% Mandatory HITL Governance</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Mandatory Human-in-the-Loop authorization ensures human tellers retain final decision-making power for regulated compliance status mutations—eliminating autonomous database hallucination risks.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 8: BUSINESS IMPACT & LIVE DEMO LAUNCHPAD */}
        {/* ========================================================================= */}
        {currentSlide === 8 && (
          <div className="max-w-5xl w-full space-y-8 animate-fadeIn text-center">
            <div className="space-y-2">
              <h2 className={`text-3xl md:text-4xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Business Impact & Live Demo Launchpad
              </h2>
              <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Select any operational workspace below to launch live hackathon demo
              </p>
            </div>

            {/* Business Impact Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className={`p-6 rounded-3xl border text-center space-y-2 ${isLight ? 'bg-white border-indigo-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="text-5xl font-black text-indigo-600">90%</div>
                <div className="text-base font-bold text-slate-900">Queue Reduction</div>
                <p className="text-xs text-slate-500">Eliminates pre-counter queue uncertainty at kiosk arrival.</p>
              </div>

              <div className={`p-6 rounded-3xl border text-center space-y-2 ${isLight ? 'bg-white border-purple-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="text-5xl font-black text-purple-600">&lt; 1.8s</div>
                <div className="text-base font-bold text-slate-900">AI Swarm Execution</div>
                <p className="text-xs text-slate-500">watsonx Orchestrate + Multimodal Vision parallel analysis.</p>
              </div>

              <div className={`p-6 rounded-3xl border text-center space-y-2 ${isLight ? 'bg-white border-emerald-200 shadow-md' : 'bg-slate-900 border-slate-800'}`}>
                <div className="text-5xl font-black text-emerald-600">100%</div>
                <div className="text-base font-bold text-slate-900">HITL Governance</div>
                <p className="text-xs text-slate-500">Zero autonomous database mutation risk for regulated services.</p>
              </div>
            </div>

            {/* Quick Launch Buttons */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-2">
              {[
                { title: '1. Kiosk Login', desc: 'Customer OTP Keypad', path: '/kiosk/login', color: 'from-indigo-600 to-blue-600' },
                { title: '2. Proactive Radar', desc: 'Voice & Sec 139A Triage', path: '/kiosk/triage', color: 'from-purple-600 to-indigo-600' },
                { title: '3. Teller Dashboard', desc: '1-Click HITL Portal', path: '/teller/dashboard', color: 'from-emerald-600 to-teal-600' },
                { title: '4. Developer Sandbox', desc: '1-Click Ticket Seeder', path: '/sandbox', color: 'from-amber-600 to-orange-600' },
                { title: '5. Multimodal Vision Lab', desc: 'Vision OCR Studio', path: '/ocr-demo', color: 'from-pink-600 to-rose-600' },
                { title: '6. Agent Debug Console', desc: 'Live Telemetry & Logs', path: '/debug/agents', color: 'from-cyan-600 to-blue-600' }
              ].map((launch, idx) => (
                <button
                  key={idx}
                  onClick={() => navigate(launch.path)}
                  className={`p-5 rounded-3xl bg-gradient-to-br ${launch.color} text-white text-left shadow-lg hover:shadow-xl hover:scale-[1.02] transition transform active:scale-95 group`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base">{launch.title}</span>
                    <ExternalLink className="w-4 h-4 opacity-80 group-hover:opacity-100 transition" />
                  </div>
                  <p className="text-xs text-white/80 font-medium">{launch.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Slide Thumbnails Drawer Modal */}
      {showThumbnails && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md p-8 flex flex-col justify-center animate-fadeIn">
          <div className="flex items-center justify-between max-w-5xl mx-auto w-full mb-6">
            <h3 className="text-xl font-bold text-white">Presentation Slide Index</h3>
            <button
              onClick={() => setShowThumbnails(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold hover:bg-slate-700"
            >
              Close Drawer (Esc)
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
            {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentSlide(idx + 1);
                  setShowThumbnails(false);
                }}
                className={`p-5 rounded-2xl border text-left transition ${
                  currentSlide === idx + 1
                    ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-lg'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-mono font-bold mb-1 opacity-80">SLIDE {idx + 1}</div>
                <div className="text-xs font-bold line-clamp-2">
                  {idx === 0 && 'Industry Problem Statement'}
                  {idx === 1 && 'Branch Bottlenecks & Issues'}
                  {idx === 2 && 'Introducing TORII Engine'}
                  {idx === 3 && 'Login Swarm & Diagnosis'}
                  {idx === 4 && 'Document Verification Swarm'}
                  {idx === 5 && 'watsonx Orchestrate Engine'}
                  {idx === 6 && 'Privacy & HITL Governance'}
                  {idx === 7 && 'Business Impact & Demo Launchpad'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Deck Controls Footer */}
      <footer
        className={`relative z-20 px-6 py-4 border-t flex items-center justify-between backdrop-blur-md transition-colors ${
          isLight ? 'bg-white/80 border-slate-200 shadow-sm' : 'bg-[#070a12]/80 border-slate-800'
        }`}
      >
        <div className="flex items-center space-x-3">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 1}
            className={`flex items-center space-x-1 px-4 py-2 rounded-xl border font-bold text-xs transition disabled:opacity-30 disabled:cursor-not-allowed ${
              isLight
                ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={nextSlide}
            disabled={currentSlide === TOTAL_SLIDES}
            className="flex items-center space-x-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-md shadow-indigo-500/20"
          >
            <span>Next Slide</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Step Dots */}
        <div className="flex items-center space-x-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx + 1)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                currentSlide === idx + 1
                  ? 'w-9 bg-indigo-600'
                  : isLight
                  ? 'w-2.5 bg-slate-300 hover:bg-slate-400'
                  : 'w-2.5 bg-slate-800 hover:bg-slate-700'
              }`}
              title={`Slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* Direct Demo Launcher */}
        <button
          onClick={() => navigate('/kiosk/login')}
          className="flex items-center space-x-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition"
        >
          <span>Launch Live App Demo</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
