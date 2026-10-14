const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function mapAllocation(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    assignedTo: row.assigned_to,
    allocatedBy: row.allocated_by,
    returnBy: row.return_by,
    notes: row.notes,
    status: row.status,
    allocatedAt: row.allocated_at,
    returnedAt: row.returned_at,
  };
}

const SELECT_JOIN = `
  SELECT al.*, a.asset_code, a.name AS asset_name
  FROM allocations al
  JOIN assets a ON a.id = al.asset_id
`;

router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const params = [];
    let where = '';
    if (status) {
      if (!['allocated', 'returned'].includes(status)) {
        return res.status(400).json({ error: 'status must be allocated or returned' });
      }
      params.push(status);
      where = `WHERE al.status = $${params.length}`;
    }

    const result = await query(
      `${SELECT_JOIN} ${where} ORDER BY al.allocated_at DESC`,
      params
    );
    return res.json({ allocations: result.rows.map(mapAllocation) });
  } catch (err) {
    console.error('List allocations error:', err.message);
    return res.status(500).json({ error: 'Failed to list allocations' });
  }
});

router.post('/', async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const assignedTo = String(req.body.assignedTo || '').trim();
    const allocatedBy = String(req.body.allocatedBy || req.user?.name || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const returnBy = req.body.returnBy ? String(req.body.returnBy).trim() : null;

    if (!Number.isInteger(assetId) || assetId < 1) {
      return res.status(400).json({ error: 'Valid assetId is required' });
    }
    if (!assignedTo) {
      return res.status(400).json({ error: 'assignedTo is required' });
    }
    if (!allocatedBy) {
      return res.status(400).json({ error: 'allocatedBy is required' });
    }

    const asset = await query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (asset.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    if (asset.rows[0].status === 'retired') {
      return res.status(400).json({ error: 'Cannot allocate a retired asset' });
    }
    if (asset.rows[0].status === 'missing') {
      return res.status(400).json({ error: 'Cannot allocate a missing asset' });
    }

    const active = await query(
      `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'allocated' LIMIT 1`,
      [assetId]
    );
    if (active.rows.length > 0) {
      return res.status(409).json({ error: 'Asset already has an active allocation' });
    }

    const inserted = await query(
      `INSERT INTO allocations (asset_id, assigned_to, allocated_by, return_by, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [assetId, assignedTo, allocatedBy, returnBy || null, notes]
    );

    await query(
      `UPDATE assets SET status = 'in_use', updated_at = NOW() WHERE id = $1`,
      [assetId]
    );

    const result = await query(`${SELECT_JOIN} WHERE al.id = $1`, [inserted.rows[0].id]);
    return res.status(201).json({ allocation: mapAllocation(result.rows[0]) });
  } catch (err) {
    console.error('Create allocation error:', err.message);
    return res.status(500).json({ error: 'Failed to create allocation' });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid allocation id' });
    }

    const existing = await query('SELECT * FROM allocations WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }
    if (existing.rows[0].status !== 'allocated') {
      return res.status(400).json({ error: 'Allocation is already returned' });
    }

    await query(
      `UPDATE allocations
       SET status = 'returned', returned_at = NOW()
       WHERE id = $1`,
      [id]
    );

    await query(
      `UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].asset_id]
    );

    const result = await query(`${SELECT_JOIN} WHERE al.id = $1`, [id]);
    return res.json({ allocation: mapAllocation(result.rows[0]) });
  } catch (err) {
    console.error('Return allocation error:', err.message);
    return res.status(500).json({ error: 'Failed to return allocation' });
  }
});

module.exports = router;
