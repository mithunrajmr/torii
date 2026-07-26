// backend/src/routes/sandboxRoutes.js
// Sandbox control plane routes — DEV/TEST ONLY.
//
// This router is only mounted when NODE_ENV !== 'production'.
// Attempting to import this in production will not cause an error, but
// the guard in index.js prevents it from being registered on the app.
//
// Routes:
//   GET    /api/sandbox/personas          — list available seeding personas
//   POST   /api/sandbox/seed/:personaId   — seed a specific persona
//   DELETE /api/sandbox/reset             — global factory reset
//   POST   /api/sandbox/transaction       — inject a custom transaction
//   GET    /api/sandbox/ledger            — live account ledger snapshot
//   POST   /api/sandbox/chaos             — set chaos rules (latency / errors)
//   GET    /api/sandbox/chaos             — get current chaos rules

import { Router } from 'express';
import multer from 'multer';
import {
  listPersonas,
  seedPersonaHandler,
  resetSandbox,
  injectTransaction,
  getLedger,
  setChaosRules,
  getChaosRules,
  seedTickets,
  testOcrHandler,
} from '../controllers/sandboxController.js';
import { chaosInterceptor } from '../middleware/chaosInterceptor.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Gemini OCR Live Demo Testing ──────────────────────────────────────────────
router.post('/test-ocr', upload.single('document'), testOcrHandler);

// ── Persona seeding ───────────────────────────────────────────────────────────

router.get('/personas', listPersonas);
router.post('/seed/:personaId', seedPersonaHandler);

// ── Demo ticket seeding ───────────────────────────────────────────────────────
// Creates realistic PENDING/PENDING_MANUAL_REVIEW tickets in the teller queue.
// Call after seeding personas so the accounts exist.
router.post('/seed-tickets', seedTickets);

// ── Global reset ──────────────────────────────────────────────────────────────
router.delete('/reset', resetSandbox);

// ── Custom transaction injection ──────────────────────────────────────────────
router.post('/transaction', injectTransaction);

// ── Live ledger inspector ─────────────────────────────────────────────────────
router.get('/ledger', getLedger);

// ── Chaos rules management ────────────────────────────────────────────────────
router.post('/chaos', setChaosRules);
router.get('/chaos', getChaosRules);

export { chaosInterceptor };
export default router;
