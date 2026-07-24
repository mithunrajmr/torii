// backend/src/index.js
// Main Express API Gateway server for Torii
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[TORII Engine] Backend API running on port ${PORT}`);
  });
}

export default app;
