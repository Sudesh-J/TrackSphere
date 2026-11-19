const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const { query } = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');
const { calculateStraightLineNbv } = require('../utils/depreciation');

const router = express.Router();
const ALLOWED_STATUSES = ['available', 'in_use', 'maintenance', 'missing', 'retired'];

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads', 'assets');
fs.mkdirSync(uploadsRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `asset-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, or GIF images are allowed'));
    }
    return cb(null, true);
  },
});

function publicAppUrl() {
  return (process.env.APP_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function mapAsset(row) {
  const dep = calculateStraightLineNbv({
    purchaseCost: row.purchase_cost,
    residualValue: row.residual_value,
    usefulLifeYears: row.useful_life_years,
    purchaseDate: row.purchase_date,
  });

  return {
    id: row.id,
    assetCode: row.asset_code,
    name: row.name,
    category: row.category,
    location: row.location,
    rfidTagId: row.rfid_tag_id,
    qrToken: row.qr_token,
    qrUrl: row.qr_token ? `${publicAppUrl()}/handover/${row.qr_token}` : null,
    status: row.status,
    purchaseCost: row.purchase_cost !== null ? Number(row.purchase_cost) : null,
    purchaseDate: row.purchase_date,
    residualValue: row.residual_value !== null ? Number(row.residual_value) : null,
    usefulLifeYears: row.useful_life_years !== null ? Number(row.useful_life_years) : null,
    vendor: row.vendor,
    serialNumber: row.serial_number,
    photoUrl: row.photo_path ? `/api/assets/${row.id}/photo` : null,
    lastScannedAt: row.last_scanned_at,
    lastHandoverAt: row.last_handover_at,
    accumulatedDepreciation: dep.accumulatedDepreciation,
    nbv: dep.nbv,
    annualDepreciation: dep.annualDepreciation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentAssignee: row.assignee_name || null,
    currentAssigneeEmail: row.assignee_email || null,
    currentAllocationId: row.allocation_id || null,
  };
}

const ASSET_SELECT = `
  SELECT a.*,
         e.full_name AS assignee_name,
         e.email AS assignee_email,
         al.id AS allocation_id
  FROM assets a
  LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'allocated'
  LEFT JOIN employees e ON e.id = al.employee_id
`;

function validateAssetBody(body, { partial = false } = {}) {
  const errors = [];
  const pick = (key) => (body[key] !== undefined ? String(body[key]).trim() : undefined);

  const name = pick('name');
  const category = pick('category');
  const location = pick('location');
  const assetCode = pick('assetCode');
  const status = pick('status');
  const vendor = body.vendor !== undefined ? String(body.vendor || '').trim() || null : undefined;
  const serialNumber =
    body.serialNumber !== undefined ? String(body.serialNumber || '').trim() || null : undefined;
  const rfidTagId =
    body.rfidTagId !== undefined ? String(body.rfidTagId || '').trim() || null : undefined;

  const purchaseCost =
    body.purchaseCost !== undefined && body.purchaseCost !== ''
      ? Number(body.purchaseCost)
      : body.purchaseCost === '' || body.purchaseCost === null
        ? null
        : undefined;
  const residualValue =
    body.residualValue !== undefined && body.residualValue !== ''
      ? Number(body.residualValue)
      : body.residualValue === '' || body.residualValue === null
        ? null
        : undefined;
  const usefulLifeYears =
    body.usefulLifeYears !== undefined && body.usefulLifeYears !== ''
      ? Number(body.usefulLifeYears)
      : body.usefulLifeYears === '' || body.usefulLifeYears === null
        ? null
        : undefined;
  const purchaseDate =
    body.purchaseDate !== undefined ? String(body.purchaseDate || '').trim() || null : undefined;

  if (!partial || name !== undefined) if (!name) errors.push('name is required');
  if (!partial || category !== undefined) if (!category) errors.push('category is required');
  if (!partial || location !== undefined) if (!location) errors.push('location is required');
  if (!partial && !assetCode) errors.push('assetCode is required');
  if (status !== undefined && status && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }
  if (purchaseCost !== undefined && purchaseCost !== null && !Number.isFinite(purchaseCost)) {
    errors.push('purchaseCost must be a number');
  }
  if (residualValue !== undefined && residualValue !== null && !Number.isFinite(residualValue)) {
    errors.push('residualValue must be a number');
  }
  if (
    usefulLifeYears !== undefined &&
    usefulLifeYears !== null &&
    (!Number.isFinite(usefulLifeYears) || usefulLifeYears <= 0)
  ) {
    errors.push('usefulLifeYears must be a positive number');
  }

  return {
    errors,
    values: {
      assetCode,
      name,
      category,
      location,
      status: status || 'available',
      vendor,
      serialNumber,
      rfidTagId,
      purchaseCost,
      residualValue,
      usefulLifeYears,
      purchaseDate,
    },
  };
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const clauses = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      clauses.push(
        `(a.asset_code ILIKE $${params.length} OR a.name ILIKE $${params.length} OR a.serial_number ILIKE $${params.length} OR a.location ILIKE $${params.length} OR COALESCE(a.rfid_tag_id,'') ILIKE $${params.length})`
      );
    }
    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
      }
      params.push(status);
      clauses.push(`a.status = $${params.length}`);
    }
    if (location) {
      params.push(`%${location}%`);
      clauses.push(`a.location ILIKE $${params.length}`);
    }
    if (category) {
      params.push(category);
      clauses.push(`a.category = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(`${ASSET_SELECT} ${where} ORDER BY a.asset_code ASC`, params);
    return res.json({ assets: result.rows.map(mapAsset) });
  } catch (err) {
    console.error('List assets error:', err.message);
    return res.status(500).json({ error: 'Failed to list assets' });
  }
});

router.get('/by-token/:token', async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    const result = await query(`${ASSET_SELECT} WHERE a.qr_token = $1`, [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found for this QR code' });
    }
    return res.json({ asset: mapAsset(result.rows[0]) });
  } catch (err) {
    console.error('Get asset by token error:', err.message);
    return res.status(500).json({ error: 'Failed to get asset' });
  }
});

router.get('/:id/qr.png', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('SELECT id, qr_token, asset_code FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    const url = `${publicAppUrl()}/handover/${result.rows[0].qr_token}`;
    const png = await QRCode.toBuffer(url, { type: 'png', width: 320, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(png);
  } catch (err) {
    console.error('QR error:', err.message);
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

router.get('/:id/photo', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await query('SELECT photo_path FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0 || !result.rows[0].photo_path) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const full = path.join(uploadsRoot, path.basename(result.rows[0].photo_path));
    if (!fs.existsSync(full)) {
      return res.status(404).json({ error: 'Photo file missing' });
    }
    return res.sendFile(full);
  } catch (err) {
    console.error('Photo get error:', err.message);
    return res.status(500).json({ error: 'Failed to load photo' });
  }
});

router.post(
  '/:id/photo',
  requireRoles('Admin', 'Staff'),
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      return next();
    });
  },
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!req.file) {
        return res.status(400).json({ error: 'photo file is required' });
      }
      const existing = await query('SELECT * FROM assets WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Asset not found' });
      }

      const filename = req.file.filename;
      if (existing.rows[0].photo_path) {
        const old = path.join(uploadsRoot, path.basename(existing.rows[0].photo_path));
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }

      await query(`UPDATE assets SET photo_path = $1, updated_at = NOW() WHERE id = $2`, [
        filename,
        id,
      ]);

      await logActivity({
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'asset.photo_upload',
        entityType: 'asset',
        entityId: id,
        assetId: id,
        summary: `Uploaded photo for ${existing.rows[0].asset_code}`,
      });

      return res.json({ photoUrl: `/api/assets/${id}/photo` });
    } catch (err) {
      console.error('Photo upload error:', err.message);
      return res.status(500).json({ error: 'Failed to upload photo' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }
    const result = await query(`${ASSET_SELECT} WHERE a.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    return res.json({ asset: mapAsset(result.rows[0]) });
  } catch (err) {
    console.error('Get asset error:', err.message);
    return res.status(500).json({ error: 'Failed to get asset' });
  }
});

router.post('/', requireRoles('Admin'), async (req, res) => {
  try {
    const { errors, values } = validateAssetBody(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const result = await query(
      `INSERT INTO assets (
         asset_code, name, category, location, rfid_tag_id, status,
         purchase_cost, purchase_date, residual_value, useful_life_years,
         vendor, serial_number
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        values.assetCode,
        values.name,
        values.category,
        values.location,
        values.rfidTagId ?? null,
        values.status,
        values.purchaseCost ?? null,
        values.purchaseDate ?? null,
        values.residualValue ?? 0,
        values.usefulLifeYears ?? null,
        values.vendor ?? null,
        values.serialNumber ?? null,
      ]
    );

    const full = await query(`${ASSET_SELECT} WHERE a.id = $1`, [result.rows[0].id]);
    const asset = mapAsset(full.rows[0]);

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'asset.create',
      entityType: 'asset',
      entityId: asset.id,
      assetId: asset.id,
      summary: `Created asset ${asset.assetCode}`,
      details: { name: asset.name, status: asset.status },
    });

    return res.status(201).json({ asset });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset code or RFID tag already exists' });
    }
    console.error('Create asset error:', err.message);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', requireRoles('Admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const existing = await query('SELECT * FROM assets WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const { errors, values } = validateAssetBody(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const current = existing.rows[0];
    const next = {
      name: values.name !== undefined ? values.name : current.name,
      category: values.category !== undefined ? values.category : current.category,
      location: values.location !== undefined ? values.location : current.location,
      rfidTagId: values.rfidTagId !== undefined ? values.rfidTagId : current.rfid_tag_id,
      status: req.body.status !== undefined ? values.status : current.status,
      vendor: values.vendor !== undefined ? values.vendor : current.vendor,
      serialNumber: values.serialNumber !== undefined ? values.serialNumber : current.serial_number,
      purchaseCost: values.purchaseCost !== undefined ? values.purchaseCost : current.purchase_cost,
      purchaseDate: values.purchaseDate !== undefined ? values.purchaseDate : current.purchase_date,
      residualValue:
        values.residualValue !== undefined ? values.residualValue : current.residual_value,
      usefulLifeYears:
        values.usefulLifeYears !== undefined ? values.usefulLifeYears : current.useful_life_years,
    };

    await query(
      `UPDATE assets SET
         name=$1, category=$2, location=$3, rfid_tag_id=$4, status=$5,
         vendor=$6, serial_number=$7, purchase_cost=$8, purchase_date=$9,
         residual_value=$10, useful_life_years=$11, updated_at=NOW()
       WHERE id=$12`,
      [
        next.name,
        next.category,
        next.location,
        next.rfidTagId,
        next.status,
        next.vendor,
        next.serialNumber,
        next.purchaseCost,
        next.purchaseDate,
        next.residualValue,
        next.usefulLifeYears,
        id,
      ]
    );

    const full = await query(`${ASSET_SELECT} WHERE a.id = $1`, [id]);
    const asset = mapAsset(full.rows[0]);

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'asset.update',
      entityType: 'asset',
      entityId: asset.id,
      assetId: asset.id,
      summary: `Updated asset ${asset.assetCode}`,
    });

    return res.json({ asset });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'RFID tag already exists on another asset' });
    }
    console.error('Update asset error:', err.message);
    return res.status(500).json({ error: 'Failed to update asset' });
  }
});

module.exports = router;
