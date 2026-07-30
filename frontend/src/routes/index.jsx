// frontend/src/routes/index.jsx
// All workspaces: /, /landing, /kiosk, /mobile/:token, /teller, /sandbox
// Each workspace has its own error boundary so a crash in one never affects another.

import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import ToriiPageTransition from '../components/ToriiPageTransition.jsx';

// First page / Cinematic Bloom Portal Splash
const IntroPortal = lazy(() => import('../pages/intro/IntroPortal.jsx'));

// Landing Hub (/landing)
const LandingMaster = lazy(() => import('../pages/landing/LandingMaster.jsx'));

// Kiosk workspace
const KioskLogin  = lazy(() => import('../pages/kiosk/KioskLogin.jsx'));
const KioskTriage = lazy(() => import('../pages/kiosk/KioskTriage.jsx'));

// Mobile workspace
const DocumentUpload = lazy(() => import('../pages/mobile/DocumentUpload.jsx'));
const StatusPoller   = lazy(() => import('../pages/mobile/StatusPoller.jsx'));

// Teller workspace
const TellerLogin    = lazy(() => import('../pages/teller/TellerLogin.jsx'));
const Dashboard      = lazy(() => import('../pages/teller/Dashboard.jsx'));
const TellerAccounts = lazy(() => import('../pages/teller/TellerAccounts.jsx'));

// Sandbox control plane (dev/demo only)
const SandboxDashboard = lazy(() => import('../pages/sandbox/SandboxDashboard.jsx'));

// Gemini OCR Multimodal Lab (Demo Studio)
const OcrDemoPage = lazy(() => import('../pages/ocr/OcrDemoPage.jsx'));

// Debug workspace (Isolated Debug & Validation Console)
const AgentDebugConsole = lazy(() => import('../pages/debug/AgentDebugConsole.jsx'));

// Interactive Presentation Slide Deck (Hackathon Pitch Studio)
const PresentationDeck = lazy(() => import('../pages/presentation/PresentationDeck.jsx'));

// Isolated Voice & Audio Testing Studio
const VoiceTestPage = lazy(() => import('../pages/voice/VoiceTestPage.jsx'));

function WorkspaceLoader() {
  return (
    <div className="min-h-screen bg-[#e8ecf2] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff] animate-pulse" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<WorkspaceLoader />}>
      <ToriiPageTransition>
        <Routes>
          {/* Root — First Page on opening application: Cinematic Torii Bloom Portal */}
          <Route path="/" element={<IntroPortal />} />

          {/* Master Landing Hub */}
          <Route path="/landing" element={<LandingMaster />} />

          {/* Presentation Slide Deck Page */}
          <Route path="/presentation" element={<PresentationDeck />} />
          <Route path="/ppt"          element={<Navigate to="/presentation" replace />} />

          {/* Kiosk workspace */}
          <Route path="/kiosk/login"  element={<KioskLogin />} />
          <Route path="/kiosk/triage" element={<KioskTriage />} />
          <Route path="/kiosk"        element={<Navigate to="/kiosk/login" replace />} />

          {/* Mobile workspace — token is the single-use QR token */}
          <Route path="/mobile/:token"        element={<DocumentUpload />} />
          <Route path="/mobile/:token/status" element={<StatusPoller />} />

          {/* Teller workspace */}
          <Route path="/teller/login"     element={<TellerLogin />} />
          <Route path="/teller/dashboard" element={<Dashboard />} />
          <Route path="/teller/accounts"  element={<TellerAccounts />} />
          <Route path="/teller"           element={<Navigate to="/teller/login" replace />} />
          <Route path="/teller/*"         element={<Navigate to="/teller/login" replace />} />

          {/* Mobile workspace root (no token — show placeholder) */}
          <Route path="/mobile" element={<Navigate to="/kiosk" replace />} />

          {/* Sandbox control plane — visible in all envs for demo purposes */}
          <Route path="/sandbox" element={<SandboxDashboard />} />

          {/* Gemini OCR Multimodal Lab (Demo Studio) */}
          <Route path="/ocr-demo" element={<OcrDemoPage />} />

          {/* Isolated Voice & Audio Testing Studio */}
          <Route path="/voice-lab" element={<VoiceTestPage />} />

          {/* Isolated Agent Debug Console */}
          <Route path="/debug/agents" element={<AgentDebugConsole />} />
          <Route path="/debug"        element={<Navigate to="/debug/agents" replace />} />
        </Routes>
      </ToriiPageTransition>
    </Suspense>
  );
}
