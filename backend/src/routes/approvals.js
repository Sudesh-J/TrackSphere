const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * Unified pending inbox for transfer + retirement requests.
 * Approve/reject still use /api/transfers/:id/* and /api/retirements/:id/*
 */
router.get('/pending', async (_req, res) => {
  try {
    const transfers = await query(`
      SELECT t.id, t.asset_id, t.from_location, t.to_location, t.requested_by,
             t.notes, t.status, t.created_at, a.asset_code, a.name AS asset_name
      FROM transfers t
      JOIN assets a ON a.id = t.asset_id
      WHERE t.status = 'pending'
      ORDER BY t.created_at ASC
    `);

    const retirements = await query(`
      SELECT r.id, r.asset_id, r.retirement_type, r.reason, r.requested_by,
             r.notes, r.status, r.created_at, a.asset_code, a.name AS asset_name
      FROM retirements r
      JOIN assets a ON a.id = r.asset_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC
    `);

    const items = [
      ...transfers.rows.map((t) => ({
        entityType: 'transfer',
        id: t.id,
        assetId: t.asset_id,
        assetCode: t.asset_code,
        assetName: t.asset_name,
        summary: `${t.from_location} → ${t.to_location}`,
        requestedBy: t.requested_by,
        notes: t.notes,
        status: t.status,
        createdAt: t.created_at,
        approvePath: `/api/transfers/${t.id}/approve`,
        rejectPath: `/api/transfers/${t.id}/reject`,
      })),
      ...retirements.rows.map((r) => ({
        entityType: 'retirement',
        id: r.id,
        assetId: r.asset_id,
        assetCode: r.asset_code,
        assetName: r.asset_name,
        summary: `${r.retirement_type}: ${r.reason}`,
        requestedBy: r.requested_by,
        notes: r.notes,
        status: r.status,
        createdAt: r.created_at,
        approvePath: `/api/retirements/${r.id}/approve`,
        rejectPath: `/api/retirements/${r.id}/reject`,
      })),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return res.json({
      count: items.length,
      items,
    });
  } catch (err) {
    console.error('Approvals pending error:', err.message);
    return res.status(500).json({ error: 'Failed to load pending approvals' });
  }
});

module.exports = router;
