// backend/src/routes/serviceRoutes.js
import { Router } from 'express';
import multer from 'multer';
import { requireRole } from '../middleware/rbac.js';
import {
  initiateServiceSession,
  getServiceConfig,
  submitServiceRequest,
  getServiceRequestStatus,
} from '../controllers/serviceController.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit for multi-doc files
});

// POST /api/services/initiate (authenticated — CUSTOMER JWT)
router.post('/initiate', requireRole('CUSTOMER'), initiateServiceSession);

// GET /api/services/config/:type (public read for Mobile PWA schema rendering)
router.get('/config/:type', getServiceConfig);

// POST /api/services/submit (multi-document & signature submission)
router.post('/submit', upload.any(), submitServiceRequest);

// GET /api/services/status/:id (status tracker polling)
router.get('/status/:id', getServiceRequestStatus);

export default router;
