# Implementation Tasks: Domain 1.5 — Master Landing Hub & Copilot

## Steering Commands
* **Build Command:** `npm run build`
* **Test Command:** `npm test --silent`
* **Lint Command:** `npm run lint`
* **UI Steering Ref:** Read and strictly follow `/ui-steering.md` during all component generation.

---

## Wave 1: Master Bento Grid & Workspace Launchpads (Zero Dependencies)
*These tasks scaffold the static layout and navigation structure.*

- [ ] TASK-1501: Build Root Landing Grid & Hero Pulse Card
  * **Requirement Ref:** REQ-1501
  * **Target Files:** `frontend/src/pages/landing/LandingMaster.jsx`, `frontend/src/pages/landing/components/HeroPulseCard.jsx`, `frontend/src/pages/landing/components/MetricsWell.jsx`
  * **Action:** Build responsive 4-column CSS Grid on `#e8ecf2` background. Create `HeroPulseCard` spanning 2x2 with extruded shadows (`shadow-[8px_8px_16px_#cbced1,-8px_-8px_16px_#ffffff]`), an inset telemetry readout well, and a primary blue CTA button. Create `MetricsWell` displaying ROI statistics inside a depressed inset container (`shadow-inset`).
  * **Verification:** Execute `npm run build` and visually verify grid responsiveness and shadow contrast.

- [ ] TASK-1502: Build Extruded Workspace Launchpad Cards
  * **Requirement Ref:** REQ-1501
  * **Target Files:** `frontend/src/pages/landing/components/WorkspaceCards.jsx`, `frontend/src/routes/index.jsx`
  * **Action:** Create 4 distinct Bento cards for Kiosk (`/kiosk`), Mobile (`/mobile`), Teller (`/teller`), and Sandbox (`/sandbox`). Apply physical depress animation on click (`active:shadow-inset`). Bind root route (`/`) in React Router to `LandingMaster.jsx`.
  * **Verification:** Run unit test `tests/frontend/LandingMaster.test.jsx` asserting all 4 workspace links exist and have correct href routes.

---

## Wave 2: Proactive Interception Radar & Domain Showcase (Depends on Wave 1)
*These tasks wire the landing page directly to the database and seeding engine.*

- [ ] TASK-1503: Implement Section G — Proactive Interception Radar
  * **Requirement Ref:** REQ-1502
  * **Dependencies:** [TASK-1501]
  * **Target Files:** `frontend/src/pages/landing/components/SectionGRadar.jsx`
  * **Action:** Build full-width span banner card. Set up `setInterval` polling every 5 seconds to `GET /api/sandbox/ledger`. Implement conditional rendering: if `activeFailures.length === 0`, render green idle well. If failures exist, render pulsing amber alert well with the **[⚡ Execute Agentic Fix Now]** button. On button click, save `target_account` to `localStorage` and navigate to `/kiosk`.
  * **Verification:** Execute component test `tests/frontend/SectionGRadar.test.jsx` mocking both empty and populated ledger API responses.

- [ ] TASK-1504: Build 5 Omni-Issue Domain Showcase & Auto-Seed Triggers
  * **Requirement Ref:** REQ-1503
  * **Dependencies:** [TASK-1503]
  * **Target Files:** `frontend/src/pages/landing/components/DomainShowcase.jsx`
  * **Action:** Build 5 horizontal Bento cards representing the service domains. In each card, embed a **[Test This Scenario]** pill button. Wire click handlers to call `POST /api/sandbox/seed/:personaId` according to the design mapping, followed by triggering an immediate state refresh on `SectionGRadar`.
  * **Verification:** Execute E2E suite `tests/e2e/landing_showcase_seed.spec.js` verifying clicking Card A (Compliance) seeds account `1000000001` and causes Section G to instantly transform to active alert state.

---

## Wave 3: Floating TORII Copilot Bottom-Right Widget (Depends on Wave 2)
*These tasks implement the interactive AI chat drawer and action chips.*

- [ ] TASK-1505: Build Neumorphic Copilot Orb & Chat Drawer
  * **Requirement Ref:** REQ-1504
  * **Dependencies:** [TASK-1501]
  * **Target Files:** `frontend/src/pages/landing/copilot/CopilotOrb.jsx`, `frontend/src/pages/landing/copilot/CopilotDrawer.jsx`
  * **Action:** Create fixed floating orb (`fixed bottom-8 right-8 z-50`) with lift animation on hover. On click, toggle visibility of `CopilotDrawer` (`w-80 md:w-96 rounded-3xl`). Style message history inside a depressed inset well and input field with `shadow-inset`.
  * **Verification:** Execute component test `tests/frontend/CopilotWidget.test.jsx` verifying drawer toggle state when orb is clicked.

- [ ] TASK-1506: Wire Copilot to Intent Router & Render Action Chips
  * **Requirement Ref:** REQ-1504
  * **Dependencies:** [TASK-1505]
  * **Target Files:** `frontend/src/pages/landing/copilot/CopilotDrawer.jsx`, `frontend/src/pages/landing/copilot/ActionChip.jsx`
  * **Action:** Connect chat input submission to existing backend intent router endpoint (`POST /api/kiosk/voice` or FAQ endpoint). Parse AI response; if response includes an action route, render an `ActionChip` component (an extruded clickable pill button) inside the chat stream that routes the user when clicked.
  * **Verification:** Execute integration test `tests/frontend/CopilotRouting.test.jsx` mocking an AI response containing an action chip and verifying button click triggers navigation.
