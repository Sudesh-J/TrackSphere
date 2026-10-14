const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const RETIREMENT_TYPES = ['scrap', 'sale', 'donate'];

function mapRetirement(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    retirementType: row.retirement_type,
    reason: row.reason,
    requestedBy: row.requested_by,
    notes: row.notes,
    status: row.status,
    reviewComment: row.review_comment,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

const SELECT_JOIN = `
  SELECT r.*, a.asset_code, a.name AS asset_name
  FROM retirements r
  JOIN assets a ON a.id = r.asset_id
`;

router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const params = [];
    let where = '';
    if (status) {
      if (!['pending', 'retired', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be pending, retired, or rejected' });
      }
      params.push(status);
      where = `WHERE r.status = $${params.length}`;
    }

    const result = await query(
      `${SELECT_JOIN} ${where} ORDER BY r.created_at DESC`,
      params
    );
    return res.json({ retirements: result.rows.map(mapRetirement) });
  } catch (err) {
    console.error('List retirements error:', err.message);
    return res.status(500).json({ error: 'Failed to list retirements' });
  }
});

router.post('/', async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const retirementType = String(req.body.retirementType || '').trim().toLowerCase();
    const reason = String(req.body.reason || '').trim();
    const requestedBy = String(req.body.requestedBy || req.user?.name || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    if (!Number.isInteger(assetId) || assetId < 1) {
      return res.status(400).json({ error: 'Valid assetId is required' });
    }
    if (!RETIREMENT_TYPES.includes(retirementType)) {
      return res.status(400).json({
        error: `retirementType must be one of: ${RETIREMENT_TYPES.join(', ')}`,
      });
    }
    if (!reason) {
      return res.status(400).json({ error: 'reason is required' });
    }
    if (!requestedBy) {
      return res.status(400).json({ error: 'requestedBy is required' });
    }

    const asset = await query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (asset.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    if (asset.rows[0].status === 'retired') {
      return res.status(400).json({ error: 'Asset is already retired' });
    }

    const pending = await query(
      `SELECT id FROM retirements WHERE asset_id = $1 AND status = 'pending' LIMIT 1`,
      [assetId]
    );
    if (pending.rows.length > 0) {
      return res.status(409).json({ error: 'Asset already has a pending retirement' });
    }

    const inserted = await query(
      `INSERT INTO retirements (asset_id, retirement_type, reason, requested_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [assetId, retirementType, reason, requestedBy, notes]
    );

    const result = await query(`${SELECT_JOIN} WHERE r.id = $1`, [inserted.rows[0].id]);
    return res.status(201).json({ retirement: mapRetirement(result.rows[0]) });
  } catch (err) {
    console.error('Create retirement error:', err.message);
    return res.status(500).json({ error: 'Failed to create retirement' });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reviewedBy = String(req.body.reviewedBy || req.user?.name || '').trim();
    const reviewComment = req.body.comment ? String(req.body.comment).trim() : null;

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid retirement id' });
    }
    if (!reviewedBy) {
      return res.status(400).json({ error: 'reviewedBy is required' });
    }

    const existing = await query('SELECT * FROM retirements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Retirement not found' });
    }
    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending retirements can be approved' });
    }

    await query(
      `UPDATE retirements
       SET status = 'retired', reviewed_by = $1, review_comment = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [reviewedBy, reviewComment, id]
    );

    await query(
      `UPDATE assets SET status = 'retired', updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].asset_id]
    );

    // Close any open allocation if the asset is retired
    await query(
      `UPDATE allocations
       SET status = 'returned', returned_at = NOW()
       WHERE asset_id = $1 AND status = 'allocated'`,
      [existing.rows[0].asset_id]
    );

    const result = await query(`${SELECT_JOIN} WHERE r.id = $1`, [id]);
    return res.json({ retirement: mapRetirement(result.rows[0]) });
  } catch (err) {
    console.error('Approve retirement error:', err.message);
    return res.status(500).json({ error: 'Failed to approve retirement' });
  }
});

router.post('/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const reviewedBy = String(req.body.reviewedBy || req.user?.name || '').trim();
    const reviewComment = req.body.comment ? String(req.body.comment).trim() : null;

    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid retirement id' });
    }
    if (!reviewedBy) {
      return res.status(400).json({ error: 'reviewedBy is required' });
    }

    const existing = await query('SELECT * FROM retirements WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Retirement not found' });
    }
    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Only pending retirements can be rejected' });
    }

    await query(
      `UPDATE retirements
       SET status = 'rejected', reviewed_by = $1, review_comment = $2, reviewed_at = NOW()
       WHERE id = $3`,
      [reviewedBy, reviewComment, id]
    );

    const result = await query(`${SELECT_JOIN} WHERE r.id = $1`, [id]);
    return res.json({ retirement: mapRetirement(result.rows[0]) });
  } catch (err) {
    console.error('Reject retirement error:', err.message);
    return res.status(500).json({ error: 'Failed to reject retirement' });
  }
});

module.exports = router;
