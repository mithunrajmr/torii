// backend/src/routes/kioskRoutes.js
// Routes for the kiosk voice/text query pipeline.

import { Router } from 'express';
import { handleKioskQuery, handlePublicCopilotQuery, handleKioskStream } from '../controllers/kioskController.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

// POST /api/kiosk/query  (authenticated — CUSTOMER JWT required)
router.post('/query', requireRole('CUSTOMER'), handleKioskQuery);

// POST/GET /api/kiosk/stream (authenticated SSE token streaming)
router.post('/stream', requireRole('CUSTOMER'), handleKioskStream);
router.get('/stream', requireRole('CUSTOMER'), handleKioskStream);

// Public streaming endpoints for landing page copilot
router.post('/public-stream', handleKioskStream);
router.get('/public-stream', handleKioskStream);

// POST /api/kiosk/voice  (public — no auth — used by landing page Copilot widget)
// Uses the local keyword fallback when watsonx is unavailable.
router.post('/voice', handlePublicCopilotQuery);

export default router;
