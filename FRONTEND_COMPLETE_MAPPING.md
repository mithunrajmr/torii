# Torii Frontend Master Architecture & Component Mapping

This document provides an exhaustive, 100% complete mapping of the **entire Torii Frontend Application** located in `frontend/src`. It details all pages, components, client-side routes, UI state workflows, visual styles, and backend API interactions.

---

## 1. High-Level Frontend Architecture

```
                                  ┌──────────────────────────┐
                                  │      main.jsx (Entry)    │
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │         App.jsx          │
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │  routes/index.jsx (v6)   │
                                  └────────────┬─────────────┘
                                               │
 ┌──────────────────────┬──────────────────────┼──────────────────────┬──────────────────────┐
 │                      │                      │                      │                      │
 ▼                      ▼                      ▼                      ▼                      ▼
Landing Domain         Kiosk Domain           Mobile PWA Domain      Teller Workstation     Developer Sandbox
(/)                    (/kiosk/*)             (/mobile/*)            (/teller/*)            (/demo/ocr, /sandbox)
- LandingMaster.jsx    - KioskLogin.jsx       - DocumentUpload.jsx   - TellerLogin.jsx      - OcrDemoPage.jsx
                       - KioskTriage.jsx      - StatusPoller.jsx     - Dashboard.jsx        - SandboxDashboard.jsx
                                                                     - TellerAccounts.jsx   
```

### Core Technologies & Styles
* **Framework**: React 18 (Vite Bundler)
* **Routing**: React Router v6 (`BrowserRouter`, `Routes`, `Route`, `Navigate`)
* **Styling**: Tailwind CSS + Custom Neumorphic (`neo-card`, `neo-inset`, `neo-button`) design tokens defined in `frontend/src/index.css`.
* **Icons**: `lucide-react` (AlertTriangle, Mic, QrCode, ShieldCheck, Eye, ZoomIn, etc.)
* **QR Renderer**: `qrcode` (Canvas rendering)
* **Voice Engine**: Web Speech API (`SpeechRecognition` & `speechSynthesis`)

---

## 2. Complete Client-Side Routing Table

| Route Path | Component File | Page Description | Access Control / Auth Requirements |
| :--- | :--- | :--- | :--- |
| `/` | `pages/landing/LandingMaster.jsx` | Branded Landing & Domain Portal | Public |
| `/kiosk` | `Navigate to /kiosk/login` | Redirect to Kiosk Login | Public |
| `/kiosk/login` | `pages/kiosk/KioskLogin.jsx` | Customer OTP Keypad Login | Public |
| `/kiosk/triage` | `pages/kiosk/KioskTriage.jsx` | Branch Kiosk Voice & QR Triage | Protected (`kiosk_jwt` required) |
| `/mobile/:token` | `pages/mobile/DocumentUpload.jsx` | Mobile Document Capture PWA | Public (Validated via single-use QR token) |
| `/mobile/status/:ticketId` | `pages/mobile/StatusPoller.jsx` | Real-time Ticket Status Poller | Public |
| `/teller` | `Navigate to /teller/login` | Redirect to Teller Login | Public |
| `/teller/login` | `pages/teller/TellerLogin.jsx` | Staff Employee Keyboard Login | Public |
| `/teller/dashboard` | `pages/teller/Dashboard.jsx` | Teller HITL Inspection Workstation | Protected (`teller_jwt` required) |
| `/teller/accounts` | `pages/teller/TellerAccounts.jsx` | Bank Account Registry & Overrides | Protected (`teller_jwt` required) |
| `/demo/ocr` | `pages/ocr/OcrDemoPage.jsx` | Gemini Multimodal Vision Workbench | Public / Dev Mode |
| `/sandbox` | `pages/sandbox/SandboxDashboard.jsx` | Developer Sandbox & Ticket Seeder | Public / Dev Mode |

---

## 3. Exhaustive Component Mapping & Directory Breakdown

### A. Route Container & Core Entry (`src/`)

#### 1. `src/main.jsx`
* **Purpose**: React root entry point mounting `<App />` into the DOM `#root` element with React StrictMode.

#### 2. `src/App.jsx`
* **Purpose**: Application wrapper rendering the primary `<AppRoutes />` container.

#### 3. `src/routes/index.jsx`
* **Purpose**: Central routing matrix using `react-router-dom` v6. Configures all path mappings, route guards, and fallback redirects.

#### 4. `src/index.css`
* **Purpose**: Custom design system and utility classes:
  - `.neo-card`: Extruded neumorphic card container with soft dual drop-shadows.
  - `.neo-inset`: Recessed inset panel for inputs, code blocks, and data tables.
  - `.neo-button`: Interactive tactile button with active press depth animations.

---

### B. Shared Global Components (`src/components/`)

#### 1. `src/components/ToriiLogo.jsx`
* **Visual Element**: Branded Torii Gate SVG vector logo with warp-in animations.
* **Props**: `variant` (`'full'` | `'mark'`), `size` (`'sm'` | `'md'` | `'lg'`), `showTagline` (boolean).
* **Used In**: `LandingMaster.jsx`, `KioskLogin.jsx`, `KioskTriage.jsx`, `TellerLogin.jsx`, `Dashboard.jsx`.

#### 2. `src/components/QRCodeGenerator.jsx`
* **Visual Element**: Canvas-based QR code renderer displaying an active 45-second countdown timer.
* **Props**: `url` (string), `onExpire` (callback), `size` (number).
* **Behavior**: Displays an amber/red pulse warning when $\le 10$ seconds remain. Invokes `onExpire` when expired.
* **Used In**: `KioskTriage.jsx`.

#### 3. `src/components/VoiceAssistant.jsx`
* **Visual Element**: Speech visualizer indicator & Text-to-Speech audio controller.
* **Props**: `text` (string response to speak aloud), `isListening` (boolean state).
* **Engine**: Browser `window.speechSynthesis` tuned for Indian English (`en-IN`).
* **Used In**: `KioskTriage.jsx`.

---

### C. Kiosk Domain (`src/pages/kiosk/`)

#### 1. `src/pages/kiosk/KioskLogin.jsx`
* **File Path**: `frontend/src/pages/kiosk/KioskLogin.jsx`
* **Visual UI Elements**:
  - 10-digit Account Number Input with Neumorphic Numeric Keypad (buttons `0-9`, `Clear`, `Backspace`).
  - 6-digit OTP Verification Keypad with 5-minute countdown lockout timer.
  - Sub-header showing masked email address (`j***@example.com`).
* **State Management**:
  - `step`: `'ACCOUNT'` | `'OTP'`.
  - `accountNumber`, `otp`, `jwt`, `accountStatus`.
* **API Calls**:
  - `POST /api/auth/otp/request`
  - `POST /api/auth/otp/verify`
* **Next Destination**: Navigates to `/kiosk/triage` with `accountStatus` in state.

#### 2. `src/pages/kiosk/KioskTriage.jsx`
* **File Path**: `frontend/src/pages/kiosk/KioskTriage.jsx`
  - **Section G — Proactive Interception Radar**: Extruded alert card featuring live time badge (`Clock`), `Actionable Bottleneck Detected — Pre-Resolution Ready` title, active failure count badge, account failure bento box (`****0001 (ARJUN S.)`, `ERR_PAN_MISSING_OVER_50K`), and single-click **"Execute Agentic Fix Now"** button (`Zap`).
  - **QR Code Handoff Panel**: Canvas QR code + **"📱 Open Link in Browser"** testing link + **"Copy Link"** button.
  - **Voice Assistant Microphone Button**: Pulse-animated mic toggle for speech input (`en-IN`).
  - **Quick Action Pills**: `QUICK_ACTIONS` array (*FD interest rates*, *Block lost card*, *KYC documents*, etc.).
  - **FAQ Chat Well**: Conversational message container displaying natural language answers.
* **Security & Session Failsafes**:
  - **60s Session Heartbeat**: Pings `/api/auth/session/validate` to extend 30-min Redis session.
  - **5-Min Inactivity Reset**: Touch/click/keydown listener logs out idle kiosk after 300s.
* **API Calls**:
  - `POST /api/auth/qr/generate`
  - `POST /api/kiosk/query`
  - `GET /api/auth/session/validate`
  - `DELETE /api/auth/session`

---

### D. Mobile PWA Domain (`src/pages/mobile/`)

#### 1. `src/pages/mobile/DocumentUpload.jsx`
* **File Path**: `frontend/src/pages/mobile/DocumentUpload.jsx`
* **Visual UI Elements**:
  - Neumorphic File Dropzone / Camera capture frame.
  - Real-time Document Image Preview container with crop/retake controls.
  - **Anti-Fraud Quality Banner**: Displays exact retry reasons (e.g. `IMAGE_CLARITY_BELOW_80_PERCENT`, `SPECIMEN_OR_DUMMY_DOCUMENT_DETECTED`).
  - **Financial Advisor Banner**: Renders pre-approved product offers.
* **API Calls**:
  - `GET /api/mobile/verify-token`
  - `POST /api/mobile/upload` (Multipart `file` + `qr_token`)
* **Next Destination**: Navigates to `/mobile/status/:ticketId`.

#### 2. `src/pages/mobile/StatusPoller.jsx`
* **File Path**: `frontend/src/pages/mobile/StatusPoller.jsx`
* **Visual UI Elements**:
  - Live animated pulse status card (`PENDING`, `APPROVED`, `REJECTED`).
  - Success checkmark icon & reference ticket number.

---

### E. Teller Workstation Domain (`src/pages/teller/`)

#### 1. `src/pages/teller/TellerLogin.jsx`
* **File Path**: `frontend/src/pages/teller/TellerLogin.jsx`
* **Visual UI Elements**:
  - Employee ID text input + Password input with show/hide eye toggle button.
  - Dev Credentials hint card (`TELLER001` / `torii2024`).
* **API Calls**: `POST /api/auth/staff-login` -> Stores `teller_jwt` in `localStorage`.

#### 2. `src/pages/teller/Dashboard.jsx`
* **File Path**: `frontend/src/pages/teller/Dashboard.jsx`
* **Sub-Components**:
  - `QueueList.jsx`: Left-side ticket queue list with real-time risk badge tags (`AML RISK`, `NAME MISMATCH`).
  - `SecureImageDisplay.jsx`: High-resolution document viewer with 80%–250% zoom controls and 5-min signed URL TTL.
  - **Gemini OCR Bento Box**: Shows Extracted Name, PAN, Doc Type, DOB, Vision Confidence %, Name Match %, Tampering Status, Specimen Flag, and Rejection Reason.
  - `ApprovalControls.jsx`: Action bar with **Approve**, **Reject**, and **Escalate** buttons + reason text area.
* **API Calls**:
  - `GET /api/teller/tickets`
  - `GET /api/teller/media/:ticketId`
  - `POST /api/teller/action`

#### 3. `src/pages/teller/TellerAccounts.jsx`
* **File Path**: `frontend/src/pages/teller/TellerAccounts.jsx`
* **Visual UI Elements**:
  - Bank Account Table displaying Account Number, Customer Name, PAN Link Status, and Linked PAN Number.
  - Manual PAN linkage override modal.

---

### F. Developer & Demo Workbench Domain

#### 1. `src/pages/ocr/OcrDemoPage.jsx`
* **File Path**: `frontend/src/pages/ocr/OcrDemoPage.jsx`
* **Visual UI Elements**:
  - Standalone Gemini Vision OCR testing workbench.
  - File upload dropzone + raw JSON response inspector tree + anti-fraud rules evaluation breakdown.

#### 2. `src/pages/sandbox/SandboxDashboard.jsx`
* **File Path**: `frontend/src/pages/sandbox/SandboxDashboard.jsx`
* **Visual UI Elements**:
  - **1-Click Ticket Seeder**: Buttons to generate test tickets (`PAN Blocked`, `AML Risk`, `Name Mismatch`).
  - Database Reset button.

---

## 4. Master Frontend File List & Cross-Reference Table

| File Path | Directory | Key Component Export | Role / Responsibility |
| :--- | :--- | :--- | :--- |
| `src/main.jsx` | Root | `main` | React DOM Render Entry |
| `src/App.jsx` | Root | `App` | Root Layout Container |
| `src/index.css` | Root | Style File | Tailwind & Neumorphic Design System |
| `src/routes/index.jsx` | Routes | `AppRoutes` | React Router v6 Matrix |
| `src/components/ToriiLogo.jsx` | Components | `ToriiLogo` | Branded Vector Logo |
| `src/components/QRCodeGenerator.jsx` | Components | `QRCodeGenerator` | Canvas QR Renderer + 45s Timer |
| `src/components/VoiceAssistant.jsx` | Components | `VoiceAssistant` | Web Speech API TTS Handler |
| `src/pages/landing/LandingMaster.jsx` | Landing | `LandingMaster` | System Gateway Portal |
| `src/pages/kiosk/KioskLogin.jsx` | Kiosk | `KioskLogin` | Customer OTP Keypad Auth |
| `src/pages/kiosk/KioskTriage.jsx` | Kiosk | `KioskTriage` | Voice, FAQ & QR Triage Screen |
| `src/pages/mobile/DocumentUpload.jsx` | Mobile | `DocumentUpload` | Camera Capture & Upload PWA |
| `src/pages/mobile/StatusPoller.jsx` | Mobile | `StatusPoller` | Real-time Ticket Status Poller |
| `src/pages/teller/TellerLogin.jsx` | Teller | `TellerLogin` | Staff Employee Keyboard Auth |
| `src/pages/teller/Dashboard.jsx` | Teller | `Dashboard` | HITL Document Inspection Dashboard |
| `src/pages/teller/QueueList.jsx` | Teller | `QueueList` | Pending Ticket Queue Sidebar |
| `src/pages/teller/SecureImageDisplay.jsx` | Teller | `SecureImageDisplay` | Zoomable Document Viewer |
| `src/pages/teller/ApprovalControls.jsx` | Teller | `ApprovalControls` | Approve / Reject Decision Bar |
| `src/pages/teller/TellerAccounts.jsx` | Teller | `TellerAccounts` | Account Registry & Link Overrides |
| `src/pages/ocr/OcrDemoPage.jsx` | OCR Demo | `OcrDemoPage` | Standalone Gemini Vision Playground |
| `src/pages/sandbox/SandboxDashboard.jsx` | Sandbox | `SandboxDashboard` | Test Ticket Seeder & Reset Tool |
