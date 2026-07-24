// backend/src/middleware/rbac.js
// JWT role-based access control middleware.
//
// CUSTOMER role: requires active Redis kiosk session (session:{jti} key must exist).
// TELLER role:   requires valid JWT with role=TELLER; no Redis session binding
//                (teller sessions are long-lived staff tokens, not kiosk-scoped).

import jwt from 'jsonwebtoken';
import { getKioskSession } from '../cache/sessionManager.js';

const secret = process.env.JWT_SECRET || 'torii-secret-key-123456789';

// Roles that are backed by a Redis session record and require live key validation
const REDIS_BACKED_ROLES = new Set(['CUSTOMER']);

export function requireRole(requiredRole) {
  return async function rbacMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'ERR_NO_TOKEN' });
    }

    const token = authHeader.slice(7);

    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ error: 'ERR_SESSION_EXPIRED' });
    }

    if (decoded.role !== requiredRole) {
      return res.status(403).json({ error: 'ERR_FORBIDDEN' });
    }

    // CUSTOMER sessions are bound to a live Redis key — verify it still exists
    if (REDIS_BACKED_ROLES.has(requiredRole)) {
      const accountId = await getKioskSession(decoded.jti);
      if (!accountId) {
        return res.status(401).json({ error: 'ERR_SESSION_EXPIRED' });
      }
    }

    req.auth = {
      accountId: decoded.sub,
      accountNumber: decoded.account_number,
      role: decoded.role,
      jti: decoded.jti,
    };

    return next();
  };
}

export default { requireRole };
