# Requirements Specification: Domain 1.5 — Master Landing Hub & Copilot

## 1. Domain Overview
The Master Landing Hub (`/`) serves as the central command portal for the TORII Autonomous Branch Operations Engine. It showcases the 5 Omni-Issue Banking Domains, provides 1-click transitions into the application's workspaces (Kiosk, Mobile, Teller, Sandbox), features a real-time Proactive Interception Radar (Section G) that binds directly to live ledger failures, and hosts the floating bottom-right TORII Copilot assistant.

---

## 2. Feature Requirements (EARS Notation)

### REQ-1501: Neo-Bento Navigation Grid & Workspace Launchpads
* **EARS Syntax:** When a user navigates to the root URL (`/`), the system shall render a responsive 4-column CSS Grid adhering strictly to Neo-Bento neumorphic surface design (`#e8ecf2` background, paired shadows), displaying the Hero Pulse card and 4 dedicated workspace launchpad cards.
* **Acceptance Criteria:**
  * **Given** a user accessing the home page,
  * **When** the page renders,
  * **Then** it shall display 4 distinct extruded workspace cards (Kiosk Portal, Mobile PWA, Teller HITL, Dev Sandbox) that physically depress (`active:shadow-inset`) when clicked and open their respective routes in a new browser tab or current window.

### REQ-1502: Section G — Proactive Interception Radar
* **EARS Syntax:** While the landing page is active, the Section G Banner Card shall poll the backend ledger (`GET /api/sandbox/ledger`) every 5 seconds to detect unassisted transaction failures and dynamically alter its layout and state based on the database response.
* **Acceptance Criteria:**
  * **Given** an idle ledger with zero failed transactions,
  * **When** the Section G polling cycle completes,
  * **Then** the card shall display a calm inset well with a green status ring and text reading: *"🟢 System Radar Active: Zero unassisted customer roadblocks detected."*
  * **Given** a database state containing a failed transaction (e.g., account `1000000001` with `ERR_PAN_MISSING_OVER_50K`),
  * **When** the polling cycle detects the record,
  * **Then** Section G shall transform instantly, displaying a pulsing amber/emerald border, the exact metadata of the roadblock, and a prominent primary CTA button labeled **[⚡ Execute Agentic Fix Now]**.
  * **Given** a user clicking the **[⚡ Execute Agentic Fix Now]** button,
  * **When** the click event fires,
  * **Then** the system shall automatically redirect the user to `/kiosk` with the target account number pre-loaded into session storage.

### REQ-1503: The 5 Omni-Issue Banking Domains Showcase
* **EARS Syntax:** The landing page shall render an interactive 5-card horizontal grid representing the core branch service domains (Compliance/Re-KYC, Payment Blocks, Mandates, Dispute Resolution, Credit Origination), each containing an automated test trigger.
* **Acceptance Criteria:**
  * **Given** the 5 Omni-Issue Domain cards rendered on the page,
  * **When** a user clicks the **[Test This Scenario]** pill button on any domain card (e.g., Compliance & Re-KYC),
  * **Then** the application shall execute `POST /api/sandbox/seed/:personaId` (e.g., seeding `PAN_BLOCKED`), trigger an immediate re-fetch of the Section G Radar so it displays the newly injected failure, and scroll smooth to Section G.

### REQ-1504: Floating TORII Copilot Bottom-Right Widget
* **EARS Syntax:** The application shall render a persistent, floating neumorphic orb fixed to the bottom-right viewport (`bottom-8 right-8`) across the landing page, which expands into an interactive AI chat drawer upon user interaction.
* **Acceptance Criteria:**
  * **Given** the collapsed Copilot orb,
  * **When** the user clicks the orb,
  * **Then** it shall animate into an extruded neumorphic drawer (`w-80 md:w-96 rounded-3xl`) featuring an inset message well and a text input field.
  * **Given** a user submitting a plain-English banking query (e.g., *"My debit card is blocked"*),
  * **When** the query is processed by the backend intent router (`POST /api/kiosk/voice` or intent endpoint),
  * **Then** the Copilot shall render a textual answer accompanied by a **Neo-Bento Action Chip** (a clickable extruded button) that auto-routes the user to the relevant remediation workflow when clicked.