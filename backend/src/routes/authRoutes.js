// backend/src/routes/authRoutes.js
// All kiosk auth endpoints wired with appropriate RBAC middleware.
//
// Public (no auth):
//   POST /api/auth/otp/request
//   POST /api/auth/otp/verify
//
// Protected (CUSTOMER role + Redis session):
//   POST   /api/auth/qr/generate
//   GET    /api/auth/session/validate
//   DELETE /api/auth/session

import { Router } from 'express';
import { requireRole } from '../middleware/rbac.js';
import {
  requestOTP,
  verifyOTP,
  generateQRToken,
  validateSession,
  deleteSession,
  staffLogin,
  getLoginSwarm,
} from '../controllers/authController.js';

const router = Router();

// ── Public endpoints ──────────────────────────────────────────────────────────
router.post('/otp/request', requestOTP);
router.post('/otp/verify', verifyOTP);
router.post('/staff-login', staffLogin);   // teller/staff login → TELLER JWT

// ── Protected endpoints (CUSTOMER) ───────────────────────────────────────────
router.post('/qr/generate', requireRole('CUSTOMER'), generateQRToken);
router.get('/session/validate', requireRole('CUSTOMER'), validateSession);
router.get('/login-swarm', requireRole('CUSTOMER'), getLoginSwarm);
router.delete('/session', requireRole('CUSTOMER'), deleteSession);

export default router;
