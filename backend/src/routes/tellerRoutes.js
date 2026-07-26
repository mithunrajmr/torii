// backend/src/routes/tellerRoutes.js
// All teller endpoints require TELLER role JWT — enforced via requireRole middleware.
import { Router } from 'express';
import { requireRole } from '../middleware/rbac.js';
import {
  getPendingTickets,
  getTicketMedia,
  handleTellerAction,
  getFaqGaps,
} from '../controllers/tellerController.js';
import {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
} from '../controllers/accountController.js';

const router = Router();

// Apply TELLER RBAC to all routes in this router
router.use(requireRole('TELLER'));

// ── HITL ticket queue ─────────────────────────────────────────────────────────
router.get('/tickets', getPendingTickets);
router.get('/media/:id', getTicketMedia);
router.post('/action', handleTellerAction);
router.get('/faq-gaps', getFaqGaps);

// ── Account CRUD (teller-managed) ─────────────────────────────────────────────
router.get('/accounts',       listAccounts);    // GET  /api/teller/accounts?search=
router.get('/accounts/:id',   getAccount);      // GET  /api/teller/accounts/:id
router.post('/accounts',      createAccount);   // POST /api/teller/accounts
router.put('/accounts/:id',   updateAccount);   // PUT  /api/teller/accounts/:id

export default router;
