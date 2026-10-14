const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/summary', async (req, res) => {
  try {
    const totals = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'available')::int AS available,
        COUNT(*) FILTER (WHERE status = 'missing')::int AS missing,
        COUNT(*) FILTER (WHERE status = 'maintenance')::int AS maintenance,
        COUNT(*) FILTER (WHERE status = 'in_use')::int AS in_use,
        COUNT(*) FILTER (WHERE status = 'retired')::int AS retired
      FROM assets
    `);

    const categories = await query(`
      SELECT category, COUNT(*)::int AS count
      FROM assets
      GROUP BY category
      ORDER BY count DESC, category ASC
    `);

    const recentEvents = await query(`
      SELECT t.id, t.rfid_tag_id, t.location, t.scanned_at, t.source,
             a.asset_code, a.name AS asset_name, a.status
      FROM tracking_events t
      JOIN assets a ON a.id = t.asset_id
      ORDER BY t.scanned_at DESC
      LIMIT 8
    `);

    const pendingApprovals = await query(`
      SELECT
        (SELECT COUNT(*)::int FROM transfers WHERE status = 'pending') +
        (SELECT COUNT(*)::int FROM retirements WHERE status = 'pending') AS count
    `);

    const activeAllocations = await query(`
      SELECT COUNT(*)::int AS count FROM allocations WHERE status = 'allocated'
    `);

    const row = totals.rows[0];

    return res.json({
      totals: {
        total: row.total,
        available: row.available,
        missing: row.missing,
        maintenance: row.maintenance,
        inUse: row.in_use,
        retired: row.retired,
      },
      lifecycle: {
        pendingApprovals: pendingApprovals.rows[0].count,
        activeAllocations: activeAllocations.rows[0].count,
      },
      categories: categories.rows,
      recentEvents: recentEvents.rows.map((e) => ({
        id: e.id,
        rfidTagId: e.rfid_tag_id,
        location: e.location,
        scannedAt: e.scanned_at,
        source: e.source,
        assetCode: e.asset_code,
        assetName: e.asset_name,
        status: e.status,
      })),
    });
  } catch (err) {
    console.error('Dashboard summary error:', err.message);
    return res.status(500).json({ error: 'Failed to load dashboard summary' });
  }
});

module.exports = router;
