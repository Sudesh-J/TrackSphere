const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { generateGeminiContent, isGeminiConfigured } = require('../utils/gemini');
const { query } = require('../db/pool');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth, requireRoles('Admin', 'Staff'));

const uploadRoot = path.join(__dirname, '..', '..', 'uploads', 'invoices');
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `inv-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      /^image\/(jpeg|png|webp)$/.test(file.mimetype);
    if (!ok) return cb(new Error('Only PDF, JPEG, PNG, or WebP files are allowed (max 8MB)'));
    return cb(null, true);
  },
});

router.get('/status', (_req, res) => {
  return res.json({
    geminiConfigured: isGeminiConfigured(),
    message: isGeminiConfigured()
      ? 'Gemini is configured for invoice extraction'
      : 'GEMINI_API_KEY is missing. You can still enter invoice details manually.',
  });
});

router.post('/extract', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    if (!isGeminiConfigured()) {
      return res.status(503).json({
        error: 'Gemini is not configured (GEMINI_API_KEY missing). Enter details manually.',
        manualFallback: true,
        suggestion: {
          vendor: '',
          invoiceDate: '',
          description: '',
          serialNumber: '',
          purchaseCost: '',
        },
      });
    }

    const bytes = fs.readFileSync(req.file.path);
    const base64 = bytes.toString('base64');
    const mime = req.file.mimetype;

    const prompt = `Extract asset purchase fields from this invoice image/PDF.
Return ONLY valid JSON with keys:
vendor (string), invoiceDate (YYYY-MM-DD or empty), description (string),
serialNumber (string or empty), purchaseCost (number or empty).
If unsure, use empty string. No markdown.`;

    let suggestion = {
      vendor: '',
      invoiceDate: '',
      description: '',
      serialNumber: '',
      purchaseCost: '',
    };

    try {
      const { result } = await generateGeminiContent([
        { text: prompt },
        { inlineData: { data: base64, mimeType: mime } },
      ]);
      const text = result.response.text();
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        suggestion = {
          vendor: String(parsed.vendor || ''),
          invoiceDate: String(parsed.invoiceDate || ''),
          description: String(parsed.description || ''),
          serialNumber: String(parsed.serialNumber || ''),
          purchaseCost:
            parsed.purchaseCost === '' || parsed.purchaseCost == null
              ? ''
              : Number(parsed.purchaseCost),
        };
      }
    } catch (extractErr) {
      console.error('Gemini extract failed:', extractErr.message);
      return res.status(502).json({
        error: 'Gemini extraction failed. Enter details manually.',
        manualFallback: true,
        suggestion,
      });
    } finally {
      // Do not expose uploads publicly — delete after processing
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        /* ignore */
      }
    }

    return res.json({
      suggestion,
      note: 'Review and edit values before creating an asset. Nothing is saved until you confirm.',
    });
  } catch (err) {
    console.error('Invoice extract error:', err.message);
    return res.status(500).json({ error: 'Invoice extraction failed' });
  }
});

router.post('/confirm-asset', requireRoles('Admin'), async (req, res) => {
  try {
    const confirmed = Boolean(req.body.confirmed);
    if (!confirmed) {
      return res.status(400).json({
        error: 'Confirmation required',
        requiresConfirmation: true,
        draft: req.body,
      });
    }

    const assetCode = String(req.body.assetCode || '').trim();
    const name = String(req.body.name || req.body.description || '').trim();
    const category = String(req.body.category || 'Uncategorized').trim();
    const location = String(req.body.location || 'Intake').trim();
    const vendor = String(req.body.vendor || '').trim() || null;
    const serialNumber = String(req.body.serialNumber || '').trim() || null;
    const purchaseDate = String(req.body.purchaseDate || req.body.invoiceDate || '').trim() || null;
    const purchaseCost =
      req.body.purchaseCost !== undefined && req.body.purchaseCost !== ''
        ? Number(req.body.purchaseCost)
        : null;

    if (!assetCode || !name) {
      return res.status(400).json({ error: 'assetCode and name/description are required' });
    }

    const result = await query(
      `INSERT INTO assets (
         asset_code, name, category, location, status, vendor, serial_number,
         purchase_cost, purchase_date, residual_value
       ) VALUES ($1,$2,$3,$4,'available',$5,$6,$7,$8,0)
       RETURNING id, asset_code`,
      [assetCode, name, category, location, vendor, serialNumber, purchaseCost, purchaseDate]
    );

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'invoice.asset_create',
      entityType: 'asset',
      entityId: result.rows[0].id,
      assetId: result.rows[0].id,
      summary: `Created asset ${result.rows[0].asset_code} from invoice intake`,
    });

    return res.status(201).json({
      message: 'Asset created from confirmed invoice intake',
      assetId: result.rows[0].id,
      assetCode: result.rows[0].asset_code,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset code already exists' });
    }
    console.error('Invoice confirm error:', err.message);
    return res.status(500).json({ error: 'Failed to create asset from invoice' });
  }
});

module.exports = router;
