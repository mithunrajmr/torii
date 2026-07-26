// backend/src/routes/kioskRoutes.js
// Routes for the kiosk voice/text query pipeline.

import { Router } from 'express';
import { handleKioskQuery, handlePublicCopilotQuery } from '../controllers/kioskController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// POST /api/kiosk/query  (authenticated — CUSTOMER JWT required)
router.post('/query', requireRole('CUSTOMER'), handleKioskQuery);

// POST /api/kiosk/voice  (public — no auth — used by landing page Copilot widget)
// Uses the local keyword fallback when watsonx is unavailable.
router.post('/voice', handlePublicCopilotQuery);

export default router;
