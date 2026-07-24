// frontend/src/routes/index.jsx
// Three base workspaces: /kiosk, /mobile/:token, /teller
// Each workspace has its own error boundary so a crash in one never affects another.

import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';

// Kiosk workspace
const KioskLogin = lazy(() => import('../pages/kiosk/KioskLogin.jsx'));
const KioskTriage = lazy(() => import('../pages/kiosk/KioskTriage.jsx'));

// Mobile workspace
const DocumentUpload = lazy(() => import('../pages/mobile/DocumentUpload.jsx'));
const StatusPoller = lazy(() => import('../pages/mobile/StatusPoller.jsx'));

// Teller workspace
const Dashboard = lazy(() => import('../pages/teller/Dashboard.jsx'));

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
      <Routes>
        {/* Kiosk workspace */}
        <Route path="/kiosk/login" element={<KioskLogin />} />
        <Route path="/kiosk/triage" element={<KioskTriage />} />
        <Route path="/kiosk" element={<Navigate to="/kiosk/login" replace />} />

        {/* Mobile workspace — token is the single-use QR token */}
        <Route path="/mobile/:token" element={<DocumentUpload />} />
        <Route path="/mobile/:token/status" element={<StatusPoller />} />

        {/* Teller workspace */}
        <Route path="/teller/*" element={<Dashboard />} />

        {/* Default */}
        <Route path="/" element={<Navigate to="/kiosk/login" replace />} />
      </Routes>
    </Suspense>
  );
}
