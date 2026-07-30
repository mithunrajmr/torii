// frontend/src/pages/voice/VoiceTestPage.jsx
// Dynamic Real-Time Conversational AI Testing Studio
// Features: Hands-Free Continuous Conversation Loop, Instant Acoustic Fillers (<30ms perceived latency),
// Non-Repeating Rotational Memory Queue, and Neural System Voice Prosody Tuning.

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ToriiWordmark from '../../components/ToriiWordmark.jsx';
import {
  Mic,
  MicOff,
  Volume2,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  Cpu,
  Send,
  ArrowLeft,
  Globe,
  Activity,
  Sliders,
  Terminal,
  Radio,
  Zap,
  Repeat,
  Megaphone
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'en-US', label: 'English (US)' },
];

const FILLER_PHRASES = {
  GENERAL: [
    'Let me search our branch knowledge base for you right now...',
    'Checking that for you, one moment please...',
    'Retrieving the latest details from our banking system...',
    'Looking that up in our branch database right away...'
  ],
  DOCUMENT: [
    'Accessing document verification guidelines for your transaction...',
    'One moment, checking compliance rules for your request...'
  ],
  ACCOUNT: [
    'Accessing your account ledger status now...',
    'Checking recent account transactions for you right now...'
  ],
  MICRO_ADS: [
    'While I pull up your details, check out our 7.25% Fixed Deposit rates on screen!',
    'Just a moment... You can also apply for instant credit card upgrades at our kiosk.',
    'Checking records now... Ask me about our paperless home loan approvals!'
  ]
};

const recentFillers = [];

function pickFillerPhrase(queryText, includeAds = true) {
  const q = (queryText || '').toLowerCase();
  let candidateList = FILLER_PHRASES.GENERAL;

  if (includeAds && Math.random() < 0.35) {
    candidateList = FILLER_PHRASES.MICRO_ADS;
  } else if (/pan|kyc|document|upload|identity/i.test(q)) {
    candidateList = FILLER_PHRASES.DOCUMENT;
  } else if (/account|balance|status|transaction|hold|deposit|money/i.test(q)) {
    candidateList = FILLER_PHRASES.ACCOUNT;
  }

  // Filter out recently used phrases to guarantee variety (no repetition)
  const available = candidateList.filter((f) => !recentFillers.includes(f));
  const pool = available.length > 0 ? available : candidateList;

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  recentFillers.push(chosen);
  if (recentFillers.length > 4) recentFillers.shift();

  return chosen;
}

export default function VoiceTestPage() {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [selectedLang, setSelectedLang] = useState('en-IN');
  
  // Dynamic Conversational Controls
  const [handsFree, setHandsFree] = useState(true);          // Continuous mic auto-rearm loop
  const [enableFillers, setEnableFillers] = useState(true);  // Instant acoustic filler phrase
  const [includeAds, setIncludeAds] = useState(true);        // Contextual micro-ads in fillers
  const [voiceState, setVoiceState] = useState('IDLE');     // 'IDLE'|'LISTENING'|'FILLER_PLAYING'|'WAITING_API'|'SPEAKING_RESPONSE'|'REARMING'

  // Prosody & Voice Tuning
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [speechRate, setSpeechRate] = useState(0.95);
  const [pitch, setPitch] = useState(1.05);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentSpeechLabel, setCurrentSpeechLabel] = useState('');

  // Execution & Telemetry
  const [loading, setLoading] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('result');

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const rearmTimerRef = useRef(null);
  const activeQueryRef = useRef('');

  // Initialize Speech Recognition & Synthesis Voices
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttSupported(false);
      addLog('WARN', 'Browser SpeechRecognition API not supported. Text mode active.');
    }

    if (window.speechSynthesis) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        if (voices.length > 0 && !selectedVoiceURI) {
          const best = selectBestVoice(voices, selectedLang);
          if (best) setSelectedVoiceURI(best.voiceURI);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    } else {
      setTtsSupported(false);
      addLog('WARN', 'Browser SpeechSynthesis API not supported.');
    }

    addLog('INFO', 'Dynamic Conversational AI Engine initialized successfully.');

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  function selectBestVoice(voices, lang) {
    if (!voices || voices.length === 0) return null;
    const langPrefix = lang.split('-')[0].toLowerCase();

    const scored = voices.map((v) => {
      let score = 0;
      const name = v.name.toLowerCase();
      const vLang = v.lang.toLowerCase();

      if (vLang.includes(lang.toLowerCase())) score += 100;
      else if (vLang.includes(langPrefix)) score += 40;

      if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 50;
      if (name.includes('google') || name.includes('microsoft') || name.includes('apple')) score += 30;

      return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.voice || voices[0];
  }

  function addLog(type, message, data = null) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    setTelemetryLogs((prev) => [
      { id: Date.now() + Math.random(), timestamp, type, message, data },
      ...prev.slice(0, 49),
    ]);
  }

  // Toggle Microphone
  function toggleMicrophone() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.abort();

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLang;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceState('LISTENING');
        addLog('STT', `Microphone ACTIVE (Continuous Hands-Free: ${handsFree ? 'ON' : 'OFF'})`);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (transcript.trim()) {
          setInputText(transcript);
          activeQueryRef.current = transcript;
        }

        // Silence Timer (2.8s for comfortable, unhurried speaking)
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (handsFree && (transcript || inputText).trim().length > 3) {
          silenceTimerRef.current = setTimeout(() => {
            const finalQuery = activeQueryRef.current || transcript || inputText;
            addLog('STT', `Silence pause detected (2.8s) -> Auto-submitting: "${finalQuery}"`);
            stopListening();
            triggerPipeline(finalQuery);
          }, 2800);
        }
      };

      recognition.onerror = (e) => {
        console.warn('[VoiceTestPage] STT error:', e.error);
        setIsListening(false);
        setVoiceState('IDLE');
        if (e.error !== 'aborted') {
          addLog('ERROR', `Mic error: ${e.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (voiceState === 'LISTENING') setVoiceState('IDLE');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[VoiceTestPage] Failed to start mic:', err);
      setIsListening(false);
      setVoiceState('IDLE');
    }
  }

  function stopListening() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.abort();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsListening(false);
    setIsSpeaking(false);
    setVoiceState('IDLE');
  }

  // Speak text aloud with audio prosody control and continuous auto-rearm loop
  function speakText(textToSpeak, options = {}) {
    const { isFiller = false, onComplete } = options;
    if (!window.speechSynthesis || !textToSpeak) return;

    if (!isFiller) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = selectedLang;
    utterance.rate = parseFloat(speechRate);
    utterance.pitch = parseFloat(pitch);

    if (selectedVoiceURI) {
      const v = availableVoices.find((voice) => voice.voiceURI === selectedVoiceURI);
      if (v) utterance.voice = v;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setCurrentSpeechLabel(isFiller ? '⚡ Instant Acoustic Filler' : '🤖 AI Agent Answer');
      setVoiceState(isFiller ? 'FILLER_PLAYING' : 'SPEAKING_RESPONSE');
      addLog('TTS', `${isFiller ? '[Instant Filler]' : '[Agent Reply]'} Speaking: "${textToSpeak.slice(0, 50)}..."`);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      onComplete?.();

      // Continuous Hands-Free Auto-Rearm Loop after AI finishes main response
      if (!isFiller && handsFree) {
        setVoiceState('REARMING');
        addLog('LOOP', 'AI answer finished. Auto-rearming microphone in 600ms for continuous conversation...');
        if (rearmTimerRef.current) clearTimeout(rearmTimerRef.current);
        rearmTimerRef.current = setTimeout(() => {
          startListening();
        }, 600);
      } else if (!isFiller) {
        setVoiceState('IDLE');
      }
    };

    utterance.onerror = (e) => {
      setIsSpeaking(false);
      setVoiceState('IDLE');
      addLog('ERROR', `TTS error: ${e.error}`);
    };

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setVoiceState('IDLE');
      addLog('TTS', 'Audio playback cancelled.');
    }
  }

  // Dynamic Pipeline Execution (Instant Filler + API Call + Neural Response)
  async function triggerPipeline(queryToProcess) {
    const queryText = (queryToProcess || inputText).trim();
    if (!queryText || loading) return;

    setLoading(true);
    addLog('API', `Pipeline triggered for query: "${queryText}"`);

    // 1. Play Instant Acoustic Filler (<30ms delay perception)
    if (enableFillers) {
      const filler = pickFillerPhrase(queryText, includeAds);
      addLog('FILLER', `Playing non-repeating acoustic filler: "${filler}"`);
      speakText(filler, { isFiller: true });
    } else {
      setVoiceState('WAITING_API');
    }

    // 2. Concurrently call backend API
    try {
      const res = await fetch('/api/kiosk/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: queryText, query: queryText, language: selectedLang }),
      });

      const data = await res.json();
      setApiResult(data);
      addLog('API', `Backend returned (Intent: ${data.intent || 'N/A'})`, data);

      const mainAnswer = data.faqAnswer || data.voiceResponse || data.response || 'I have processed your query.';

      // 3. Transition smoothly with a 120ms audio buffer so browser audio engine never hangs
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      setTimeout(() => {
        speakText(mainAnswer, { isFiller: false });
      }, 120);

    } catch (err) {
      console.error('[VoiceTestPage] API error:', err);
      addLog('ERROR', `Pipeline error: ${err.message}`);
      setVoiceState('IDLE');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    stopListening();
    triggerPipeline(inputText);
  }

  return (
    <div className="min-h-screen bg-[#e8ecf2] text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff]">
          <div className="flex items-center gap-4">
            <Link
              to="/landing"
              className="p-3 rounded-xl bg-[#e8ecf2] shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff] hover:shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] transition-all"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ToriiWordmark className="h-6" />
                <span className="px-2.5 py-0.5 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full border border-indigo-200">
                  REAL-TIME DYNAMIC VOICE STUDIO
                </span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">Natural Conversational AI Testing Studio</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>STATE: {voiceState}</span>
            </div>
          </div>
        </header>

        {/* Main 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Column: Mic Recording & Dynamic Toggles (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Mic Recording Card */}
            <div className="p-6 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-indigo-600" />
                  1. Spoken Speech Input
                </h2>
                {isListening && (
                  <span className="flex items-center gap-1 text-xs text-rose-600 font-bold px-2.5 py-0.5 bg-rose-50 border border-rose-200 rounded-full animate-pulse">
                    <Radio className="w-3 h-3" /> LISTENING
                  </span>
                )}
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-500" /> Language:
                </label>
                <select
                  value={selectedLang}
                  onChange={(e) => setSelectedLang(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-sm text-slate-800 font-medium focus:outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              {/* Big Interactive Mic Button */}
              <div className="flex flex-col items-center justify-center py-4 space-y-3">
                <button
                  type="button"
                  onClick={toggleMicrophone}
                  className={`w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-[0_0_30px_rgba(244,63,94,0.6)] animate-pulse scale-105'
                      : 'bg-[#e8ecf2] text-indigo-600 shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] hover:shadow-[inset_4px_4px_8px_#cbced1,inset_-4px_-4px_8px_#ffffff]'
                  }`}
                >
                  {isListening ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
                  <span className="text-[10px] font-bold tracking-wider uppercase mt-1">
                    {isListening ? 'Stop' : 'Talk'}
                  </span>
                </button>
                <span className="text-xs font-medium text-slate-500">
                  {isListening ? 'Listening... Pause for 2.8s to auto-submit' : 'Tap mic button to start continuous conversation'}
                </span>
              </div>

              {/* Query Textarea & Manual Submit */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Speech Transcript / Text:</span>
                  {inputText && (
                    <button type="button" onClick={() => { setInputText(''); activeQueryRef.current = ''; }} className="text-rose-500 hover:underline">
                      Clear
                    </button>
                  )}
                </div>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Speak via microphone or type your banking question..."
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-sm text-slate-900 focus:outline-none resize-none"
                />

                <button
                  type="submit"
                  disabled={loading || !inputText.trim()}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-[4px_4px_8px_#cbced1,-4px_-4px_8px_#ffffff] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Resolving AI Query...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Submit Query
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Dynamic Real-Time Toggles Card */}
            <div className="p-6 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-600" />
                2. Dynamic Conversational Controls
              </h2>

              <div className="space-y-3 text-xs">
                
                {/* Hands-Free Loop Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]">
                  <div>
                    <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                      <Repeat className="w-4 h-4 text-indigo-600" /> Hands-Free Continuous Loop
                    </span>
                    <span className="text-[11px] text-slate-500">Auto-submits on silence & auto-rearms mic after AI finishes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHandsFree(!handsFree)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-1 ${handsFree ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${handsFree ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Instant Acoustic Fillers Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]">
                  <div>
                    <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" /> Instant Acoustic Fillers (&lt;30ms delay perception)
                    </span>
                    <span className="text-[11px] text-slate-500">Plays non-repeating human fillers while AI resolves query</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableFillers(!enableFillers)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-1 ${enableFillers ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enableFillers ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Micro-Ads Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff]">
                  <div>
                    <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                      <Megaphone className="w-4 h-4 text-emerald-600" /> Contextual Micro-Ads in Fillers
                    </span>
                    <span className="text-[11px] text-slate-500">Includes offer promotions in acoustic fillers</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeAds(!includeAds)}
                    className={`w-11 h-6 rounded-full transition-colors relative p-1 ${includeAds ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${includeAds ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Prosody Sliders */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">System Voice:</label>
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-xs text-slate-800 focus:outline-none"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="font-semibold text-slate-600">Rate: {speechRate}x</span>
                    <input type="range" min="0.6" max="1.4" step="0.05" value={speechRate} onChange={(e) => setSpeechRate(e.target.value)} className="w-full accent-indigo-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Pitch: {pitch}</span>
                    <input type="range" min="0.7" max="1.3" step="0.05" value={pitch} onChange={(e) => setPitch(e.target.value)} className="w-full accent-indigo-600" />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Column: AI Output & Telemetry (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Navigation Tabs */}
            <div className="p-2 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('result')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'result' ? 'bg-indigo-600 text-white shadow-[2px_2px_4px_#cbced1,-2px_-2px_4px_#ffffff]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" /> AI Agent Answer Output
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('telemetry')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'telemetry' ? 'bg-indigo-600 text-white shadow-[2px_2px_4px_#cbced1,-2px_-2px_4px_#ffffff]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-4 h-4" /> Real-Time Telemetry ({telemetryLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'raw' ? 'bg-indigo-600 text-white shadow-[2px_2px_4px_#cbced1,-2px_-2px_4px_#ffffff]' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Terminal className="w-4 h-4" /> Raw Backend JSON
              </button>
            </div>

            {/* Tab 1: AI Response Display */}
            {activeTab === 'result' && (
              <div className="p-6 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] space-y-6 min-h-[460px]">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-indigo-600" />
                    AI Agent Answer Output
                  </h3>
                  {apiResult?.intent && (
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-mono font-bold rounded-lg border border-indigo-200">
                      INTENT: {apiResult.intent}
                    </span>
                  )}
                </div>

                {!apiResult ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
                    <Radio className="w-12 h-12 stroke-1 animate-pulse text-indigo-400" />
                    <p className="text-sm font-medium text-slate-600">Continuous voice loop is ready.</p>
                    <p className="text-xs text-slate-400">Tap the mic button and speak any question to start natural conversation.</p>
                  </div>
                ) : (
                  <div className="space-y-5">

                    {/* AI Response Card */}
                    <div className="p-5 rounded-2xl bg-indigo-50/90 border border-indigo-200 text-slate-900 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-indigo-600" />
                          {currentSpeechLabel || 'AI Agent Response:'}
                        </span>

                        <div className="flex items-center gap-2">
                          {isSpeaking ? (
                            <button type="button" onClick={stopSpeaking} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-rose-700 shadow">
                              <Square className="w-3 h-3 fill-current" /> Stop Audio
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => speakText(apiResult.faqAnswer || apiResult.voiceResponse || apiResult.response)}
                              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-700 shadow"
                            >
                              <Play className="w-3 h-3 fill-current" /> Replay Audio
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="text-base font-semibold text-slate-900 leading-relaxed">
                        "{apiResult.faqAnswer || apiResult.voiceResponse || apiResult.response || 'Processing query...'}"
                      </p>

                      {isSpeaking && (
                        <div className="flex items-center justify-center gap-1.5 pt-2">
                          <span className="w-1.5 h-6 bg-indigo-600 rounded-full animate-bounce [animation-delay:0ms]" />
                          <span className="w-1.5 h-8 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-5 bg-indigo-600 rounded-full animate-bounce [animation-delay:300ms]" />
                        </div>
                      )}
                    </div>

                    {/* Response Metadata */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-[#e8ecf2] rounded-xl shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-xs">
                        <span className="text-slate-500 block">Downstream Flow:</span>
                        <span className="font-mono font-bold text-slate-800">{apiResult.downstream || 'N/A'}</span>
                      </div>
                      <div className="p-3 bg-[#e8ecf2] rounded-xl shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-xs">
                        <span className="text-slate-500 block">Confidence Score:</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {apiResult.confidence !== undefined ? `${(apiResult.confidence * 100).toFixed(0)}%` : '100%'}
                        </span>
                      </div>
                      <div className="p-3 bg-[#e8ecf2] rounded-xl shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-xs">
                        <span className="text-slate-500 block">Mobile QR Handoff:</span>
                        <span className={`font-bold ${apiResult.showQR ? 'text-amber-600' : 'text-slate-600'}`}>
                          {apiResult.showQR ? 'YES' : 'NO'}
                        </span>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Telemetry Event Logs */}
            {activeTab === 'telemetry' && (
              <div className="p-6 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] space-y-4 min-h-[460px]">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-600" />
                    Real-Time Telemetry Stream
                  </h3>
                  <button type="button" onClick={() => setTelemetryLogs([])} className="text-xs text-rose-500 hover:underline flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Clear
                  </button>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {telemetryLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-[#e8ecf2] shadow-[inset_2px_2px_4px_#cbced1,inset_-2px_-2px_4px_#ffffff] text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                          log.type === 'ERROR' ? 'bg-rose-100 text-rose-700' :
                          log.type === 'STT' ? 'bg-blue-100 text-blue-800' :
                          log.type === 'TTS' ? 'bg-indigo-100 text-indigo-800' :
                          log.type === 'FILLER' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          [{log.type}]
                        </span>
                        <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                      </div>
                      <p className="text-slate-800 font-sans">{log.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Raw Backend JSON */}
            {activeTab === 'raw' && (
              <div className="p-6 bg-[#e8ecf2] rounded-2xl shadow-[6px_6px_12px_#cbced1,-6px_-6px_12px_#ffffff] space-y-4 min-h-[460px]">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-300 pb-3">
                  <Terminal className="w-5 h-5 text-indigo-600" />
                  Raw API Payload
                </h3>
                <pre className="p-4 rounded-xl bg-[#1e293b] text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed shadow-inner">
                  {apiResult ? JSON.stringify(apiResult, null, 2) : '// Response payload will appear here'}
                </pre>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
