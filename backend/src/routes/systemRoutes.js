// backend/src/routes/systemRoutes.js
// Public system endpoints — no authentication required.
// Mounted at /api/system in index.js.

import { Router } from 'express';
import { getSystemRadar } from '../controllers/systemController.js';

const router = Router();

// GET /api/system/radar — proactive compliance failure radar
// Public read — returns masked account metadata only, no PAN/email/UUIDs
router.get('/radar', getSystemRadar);

export default router;
