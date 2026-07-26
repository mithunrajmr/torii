// backend/src/routes/mobileRoutes.js
import { Router } from 'express';
import multer from 'multer';
import { uploadMobileDocument, getMobileStatus, testOcrHandler } from '../controllers/mobileController.js';

const router = Router();


// Store file in memory buffer so visionAgent can pass it directly to Orchestrate.
// 10 MB limit matches the frontend's stated maximum.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are accepted'));
    }
    cb(null, true);
  },
});

// Multer error handler for this router
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'ERR_FILE_TOO_LARGE', message: err.message });
  }
  if (err) {
    return res.status(400).json({ error: 'ERR_INVALID_FILE', message: err.message });
  }
  next();
}

router.post('/upload', upload.single('document'), handleMulterError, uploadMobileDocument);
router.post('/test-ocr', upload.single('document'), handleMulterError, testOcrHandler);
router.get('/status/:token', getMobileStatus);


export default router;
