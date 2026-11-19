const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth);

function mapTransfer(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    fromLocation: row.from_location,
    toLocation: row.to_location,
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
  SELECT t.*, a.asset_code, a.name AS asset_name
  FROM transfers t
  JOIN assets a ON a.id = t.asset_id
`;

router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const params = [];
    let where = '';
    if (status) {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be pending, approved, or rejected' });
      }
      params.push(status);
      where = `WHERE t.status = $${params.length}`;
    }
    const result = await query(`${SELECT_JOIN} ${where} ORDER BY t.created_at DESC`, params);
    return res.json({ transfers: result.rows.map(mapTransfer) });
  } catch (err) {
    console.error('List transfers error:', err.message);
    return res.status(500).json({ error: 'Failed to list transfers' });
  }
});

router.post('/', requireRoles('Admin', 'Staff'), async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const toLocation = String(req.body.toLocation || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    let fromLocation = req.body.fromLocation ? String(req.body.fromLocation).trim() : '';

    if (!Number.isInteger(assetId) || assetId < 1) {
      return res.status(400).json({ error: 'Valid assetId is required' });
    }
    if (!toLocation) return res.status(400).json({ error: 'toLocation is required' });

    const asset = await query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (asset.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    if (asset.rows[0].status === 'retired') {
      return res.status(400).json({ error: 'Cannot transfer a retired asset' });
    }
    if (!fromLocation) fromLocation = asset.rows[0].location;

    const pending = await query(
      `SELECT id FROM transfers WHERE asset_id = $1 AND status = 'pending' LIMIT 1`,
      [assetId]
    );
    if (pending.rows.length > 0) {
      return res.status(409).json({ error: 'Asset already has a pending transfer' });
    }

    const inserted = await query(
      `INSERT INTO transfers (asset_id, from_location, to_location, requested_by, requested_by_user_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [assetId, fromLocation, toLocation, req.user.name, req.user.id, notes]
    );

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'transfer.request',
      entityType: 'transfer',
      entityId: inserted.rows[0].id,
      assetId,
      summary: `Requested transfer of ${asset.rows[0].asset_code} to ${toLocation}`,
    });

    const result = await query(`${SELECT_JOIN} WHERE t.id = $1`, [inserted.rows[0].id]);
    return res.status(201).json({ transfer: mapTransfer(result.rows[0]) });
  } catch (err) {
    console.error('Create transfer error:', err.message);
    return res.status(500).json({ error: 'Failed to create transfer' });
  }
});

async function reviewTransfer(req, res, decision) {
  try {
    const id = Number(req.params.id);
    const reviewComment = req.body.comment ? String(req.body.comment).trim() : null;
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid transfer id' });
    }

    const existing = await query('SELECT * FROM transfers WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Transfer not found' });
    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `Only pending transfers can be ${decision}` });
    }

    await query(
      `UPDATE transfers
       SET status = $1, reviewed_by = $2, reviewed_by_user_id = $3, review_comment = $4, reviewed_at = NOW()
       WHERE id = $5`,
      [decision === 'approve' ? 'approved' : 'rejected', req.user.name, req.user.id, reviewComment, id]
    );

    if (decision === 'approve') {
      await query(`UPDATE assets SET location = $1, updated_at = NOW() WHERE id = $2`, [
        existing.rows[0].to_location,
        existing.rows[0].asset_id,
      ]);
    }

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: decision === 'approve' ? 'transfer.approve' : 'transfer.reject',
      entityType: 'transfer',
      entityId: id,
      assetId: existing.rows[0].asset_id,
      summary: `${decision === 'approve' ? 'Approved' : 'Rejected'} transfer #${id}`,
      details: { comment: reviewComment },
    });

    const result = await query(`${SELECT_JOIN} WHERE t.id = $1`, [id]);
    return res.json({ transfer: mapTransfer(result.rows[0]) });
  } catch (err) {
    console.error('Review transfer error:', err.message);
    return res.status(500).json({ error: 'Failed to review transfer' });
  }
}

router.post('/:id/approve', requireRoles('Admin', 'Approver'), (req, res) =>
  reviewTransfer(req, res, 'approve')
);
router.post('/:id/reject', requireRoles('Admin', 'Approver'), (req, res) =>
  reviewTransfer(req, res, 'reject')
);

module.exports = router;
