# Global Steering Rules & System Boundaries

1. **Strict Separation of Concerns:**
   - Frontend UI (`/frontend`) must NEVER import or reference AWS, IBM Cloud, or Supabase admin SDKs directly. All external communication must route through `/backend/src/api`.
2. **AI Swarm Concurrency Rule:**
   - Any modifications to document processing (`/backend/src/controllers/mobileController.js`) MUST maintain the `Promise.all()` parallel execution structure for the OCR, Watchdog, and Advisor agents. Never execute these sequentially.
3. **Mandatory PII Redaction:**
   - You must NEVER log, console.log, or commit unmasked PAN numbers to any database table other than the designated secure storage column in `accounts`. All audit trails must pass through `governanceSidecar.js`.
4. **State Management Discipline:**
   - Do not use in-memory Node.js state (like `new Map()`) for session management. All tokens, timers, and OTP states must read/write directly to Upstash Redis to support stateless serverless horizontal scaling.