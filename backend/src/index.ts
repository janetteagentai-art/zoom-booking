import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { AppDataSource } from './config/data-source';
import authRoutes from './routes/auth';
import zoomAccountRoutes from './routes/zoomAccounts';
import bookingRoutes from './routes/bookings';
import adminRoutes from './routes/admin';
import { zoomService } from './services/zoomService';

const app = express();
const PORT = parseInt(process.env.PORT || '4000');

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? false // allow same-origin (Docker network)
    : ['http://localhost:3000', 'http://192.168.0.232:3000'],
  credentials: true,
}));
app.use(express.json());
app.set('trust proxy', 1);

// ── Rate limiting (auth routes) ─────────────────────────────────────────────
app.use('/auth', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Demasiados intentos, probá en 15 minutos' },
}));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/zoom-accounts', zoomAccountRoutes);
app.use('/bookings', bookingRoutes);
app.use('/admin', adminRoutes);

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    zoomConfigured: zoomService.isConfigured,
    timezone: process.env.TZ,
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'No encontrado' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
AppDataSource.initialize()
  .then(() => {
    console.log('✅ DB connected');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      if (!zoomService.isConfigured) {
        console.warn('⚠️  Zoom not configured — set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET in .env');
      }
    });
  })
  .catch((err) => {
    console.error('❌ DB connection error:', err);
    process.exit(1);
  });
