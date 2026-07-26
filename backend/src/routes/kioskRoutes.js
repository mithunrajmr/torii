// backend/src/routes/kioskRoutes.js
// Routes for the kiosk voice/text query pipeline.
// All routes require a valid kiosk JWT (CUSTOMER role).

import { Router } from 'express';
import { handleKioskQuery } from '../controllers/kioskController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// POST /api/kiosk/query
// Body: { query: string, language?: string }
// Auth: Bearer <kiosk JWT> (role: CUSTOMER)
//
// Runs the Localizer → Master Orchestrator → FAQ (if needed) pipeline.
// Returns intent classification, routing decision, and TTS voice response.
router.post('/query', requireRole('CUSTOMER'), handleKioskQuery);

export default router;
