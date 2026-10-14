const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_STATUSES = ['available', 'in_use', 'maintenance', 'missing', 'retired'];

function validateAssetBody(body, { partial = false } = {}) {
  const errors = [];
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  const category = body.category !== undefined ? String(body.category).trim() : undefined;
  const location = body.location !== undefined ? String(body.location).trim() : undefined;
  const rfidTagId = body.rfidTagId !== undefined ? String(body.rfidTagId).trim() : undefined;
  const assetCode = body.assetCode !== undefined ? String(body.assetCode).trim() : undefined;
  const status = body.status !== undefined ? String(body.status).trim() : undefined;

  if (!partial || name !== undefined) {
    if (!name) errors.push('name is required');
  }
  if (!partial || category !== undefined) {
    if (!category) errors.push('category is required');
  }
  if (!partial || location !== undefined) {
    if (!location) errors.push('location is required');
  }
  if (!partial || rfidTagId !== undefined) {
    if (!rfidTagId) errors.push('rfidTagId is required');
  }
  if (!partial) {
    if (!assetCode) errors.push('assetCode is required');
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}`);
  }

  return {
    errors,
    values: {
      assetCode,
      name,
      category,
      location,
      rfidTagId,
      status: status || 'available',
    },
  };
}

function mapAsset(row) {
  return {
    id: row.id,
    assetCode: row.asset_code,
    name: row.name,
    category: row.category,
    location: row.location,
    rfidTagId: row.rfid_tag_id,
    status: row.status,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const clauses = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      clauses.push(
        `(asset_code ILIKE $${params.length} OR name ILIKE $${params.length} OR rfid_tag_id ILIKE $${params.length} OR location ILIKE $${params.length})`
      );
    }

    if (status) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
      }
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM assets ${where} ORDER BY asset_code ASC`,
      params
    );

    return res.json({ assets: result.rows.map(mapAsset) });
  } catch (err) {
    console.error('List assets error:', err.message);
    return res.status(500).json({ error: 'Failed to list assets' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid asset id' });
    }

    const result = await query('SELECT * FROM assets WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return res.json({ asset: mapAsset(result.rows[0]) });
  } catch (err) {
    console.error('Get asset error:', err.message);
    return res.status(500).json({ error: 'Failed to get asset' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { errors, values } = validateAssetBody(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const result = await query(
      `INSERT INTO assets (asset_code, name, category, location, rfid_tag_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        values.assetCode,
        values.name,
        values.category,
        values.location,
        values.rfidTagId,
        values.status,
      ]
    );

    return res.status(201).json({ asset: mapAsset(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset code or RFID tag already exists' });
    }
    console.error('Create asset error:', err.message);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
});

router.put('/:id', async (req, res) => {
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
    };

    const result = await query(
      `UPDATE assets
       SET name = $1, category = $2, location = $3, rfid_tag_id = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [next.name, next.category, next.location, next.rfidTagId, next.status, id]
    );

    return res.json({ asset: mapAsset(result.rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'RFID tag already exists on another asset' });
    }
    console.error('Update asset error:', err.message);
    return res.status(500).json({ error: 'Failed to update asset' });
  }
});

module.exports = router;
