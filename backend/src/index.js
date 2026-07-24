// backend/src/index.js
// Main Express API Gateway server for Torii
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import authRoutes from './routes/authRoutes.js';
import mobileRoutes from './routes/mobileRoutes.js';
import tellerRoutes from './routes/tellerRoutes.js';

dotenv.config();

// Default env fallbacks for local dev if missing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'torii-secret-key-123456789';
process.env.DOMAIN = process.env.DOMAIN || 'localhost:3000';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', system: 'TORII Compliance Engine', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/teller', tellerRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[TORII Server Error]', err);
  res.status(500).json({ error: 'ERR_INTERNAL_SERVER_ERROR', message: err.message });
});

// ── Dev-only: generate a TELLER JWT for dashboard testing ─────────────────────
// Usage: POST /api/dev/teller-token
// Returns a signed JWT with role=TELLER — paste into browser localStorage or
// use with any REST client to test the teller dashboard API.
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/dev/teller-token', (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
      {
        sub: 'teller-dev-user-0001',
        name: 'Dev Teller',
        role: 'TELLER',
        jti: uuidv4(),
        iat: now,
        exp: now + 28800, // 8 hours
      },
      process.env.JWT_SECRET || 'torii-secret-key-123456789'
    );
    res.json({
      teller_jwt: token,
      note: 'Add as Authorization: Bearer <token> header. Valid for 8 hours. Dev mode only.',
    });
  });
}

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[TORII Engine] Backend API running on port ${PORT}`);
  });
}

export default app;
