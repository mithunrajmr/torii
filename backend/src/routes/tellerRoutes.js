// backend/src/routes/tellerRoutes.js
// All teller endpoints require TELLER role JWT — enforced via requireRole middleware.
import { Router } from 'express';
import { requireRole } from '../middleware/rbac.js';
import {
  getPendingTickets,
  getTicketMedia,
  handleTellerAction,
} from '../controllers/tellerController.js';

const router = Router();

// Apply TELLER RBAC to all routes in this router
router.use(requireRole('TELLER'));

router.get('/tickets', getPendingTickets);
router.get('/media/:id', getTicketMedia);
router.post('/action', handleTellerAction);

export default router;
