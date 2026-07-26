frontend/src/pages/sandbox/
├── SandboxDashboard.jsx     # Master Bento Grid (4-column layout)
├── components/
    ├── PersonaSeeder.jsx    # Bento Card (Span 2x2): 6x 1-click persona seeding buttons
    ├── LedgerInspector.jsx  # Bento Card (Span 4x2): Inset table of active accounts
    ├── TxInjector.jsx       # Bento Card (Span 2x2): Inset form to inject custom errors
    └── ChaosControl.jsx     # Bento Card (Span 2x1): Toggle switches for API latency



   frontend/src/pages/landing/
├── LandingMaster.jsx        # Root responsive 4-column Bento CSS Grid container
├── components/
│   ├── HeroPulseCard.jsx    # Span 2x2: Overview, primary CTA, inset AI telemetry well
│   ├── WorkspaceCards.jsx   # 4x Span 1x1: Extruded launchpads for /kiosk, /mobile, /teller, /sandbox
│   ├── SectionGRadar.jsx    # Span 4x1: Proactive Interception banner card with dynamic idle/alert states
│   ├── DomainShowcase.jsx   # 5x Span 1x1: Horizontal grid of the 5 Omni-Issue service cards + Test triggers
│   └── MetricsWell.jsx      # Span 1x1: Depressed inset well showing 34s resolution & 90% teller ROI
└── copilot/
    ├── CopilotOrb.jsx       # Floating bottom-right circular toggle (fixed bottom-8 right-8)
    ├── CopilotDrawer.jsx    # Extruded chat drawer with inset message stream well
    └── ActionChip.jsx       # Neumorphic clickable pill button rendered inside chat replies