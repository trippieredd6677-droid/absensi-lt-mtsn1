const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const absensiRoutes = require('./routes/absensi');
const adminRoutes = require('./routes/admin');
const kelasRoutes = require('./routes/kelas');
const shiftRoutes = require('./routes/shift');
const jadwalRoutes = require('./routes/jadwal');
const { runMigrations } = require('./migrations');

const app = express();

// Benar, supaya req.ip akurat di belakang reverse proxy (Nginx)
app.set('trust proxy', 1);

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
  next();
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Produksi: HANYA origin yang terdaftar. Dev: biarkan (buat preview lokal gampang).
    if (process.env.NODE_ENV === 'production') {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting untuk endpoint sensitif (anti brute-force) — aktif di produksi saja
const rateLimit = require('express-rate-limit');
if (process.env.NODE_ENV === 'production') {
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true, // hanya hitung percobaan login gagal
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);
  app.use('/api/auth/verify-otp', authLimiter);
}

// Static files for uploads (cache privat, no execution)
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/absensi', absensiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kelas', kelasRoutes);
app.use('/api/shift', shiftRoutes);
app.use('/api/jadwal', jadwalRoutes);

// Serve frontend build (produksi) — single-origin deploy (Render/server host).
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));

// SPA fallback: route client-side (BrowserRouter) → kembalikan index.html
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(clientDist, 'index.html'));
  }
  next();
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.message === 'Tipe file tidak valid. Hanya JPEG, PNG, GIF, PDF yang diizinkan.') {
    return res.status(400).json({ message: err.message });
  }

  if (err.message.includes('File size exceeds limit')) {
    return res.status(413).json({ message: 'Ukuran file melebihi batas' });
  }

  res.status(500).json({ 
    message: 'Kesalahan server',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

const PORT = process.env.PORT || 5000;

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
    });
  })
  .catch((err) => {
    console.error('Migration error:', err);
    process.exit(1);
  });
