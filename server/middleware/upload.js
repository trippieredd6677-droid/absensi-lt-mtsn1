const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directory if it doesn't exist
// ponytail: UPLOAD_DIR relatif harus resolve dari project root, bukan cwd proses
// (cwd beda = file kesimpen di tempat lain / ENOENT). Upgrade path: pindahkan
// nilai UPLOAD_DIR di .env jadi path absolut saat deploy.
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(PROJECT_ROOT, process.env.UPLOAD_DIR)
  : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const slug = (s) => String(s || '')
      .normalize('NFKD').replace(/[^\w\s-]/g, '')
      .trim().replace(/\s+/g, '-').toLowerCase()
      .slice(0, 30) || 'unknown';
    const stamp = Date.now();
    if (file.fieldname === 'photo') {
      const profilName = slug(req._guruName || (req.user && req.user.username) || (req.user && String(req.user.id)) || 'user');
      cb(null, `${profilName}_profil_${stamp}${ext}`);
      return;
    }
    const namaGuru = slug(req._guruName);
    const kelas = slug(req.body && req.body.kelas);
    const shift = slug(req.body && req.body.shift);
    const tanggal = slug(req.body && req.body.tanggal) || 'tanpa-tanggal';
    cb(null, `${tanggal}-${shift}_${namaGuru}_kelas-${kelas}_${stamp}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf'];
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF allowed.'));
  }
};

// Multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 8388608, // 8MB (sama dengan limit kompresi frontend)
  },
});

module.exports = upload;
