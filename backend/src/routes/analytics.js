const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * Prototype analytics using transparent rules (not a trained AI model).
 * Rule: assets not scanned within N days are flagged as stale.
 */
router.get('/overview', async (req, res) => {
  try {
    const staleDays = Math.max(1, Number(req.query.staleDays) || 7);

    const byStatus = await query(`
      SELECT status, COUNT(*)::int AS count
      FROM assets
      GROUP BY status
      ORDER BY count DESC
    `);

    const byCategory = await query(`
      SELECT category, COUNT(*)::int AS count
      FROM assets
      GROUP BY category
      ORDER BY count DESC, category ASC
    `);

    const missing = await query(`
      SELECT COUNT(*)::int AS count FROM assets WHERE status = 'missing'
    `);

    const stale = await query(
      `SELECT id, asset_code, name, category, location, status, last_scanned_at
       FROM assets
       WHERE last_scanned_at IS NULL
          OR last_scanned_at < NOW() - ($1 || ' days')::interval
       ORDER BY last_scanned_at ASC NULLS FIRST`,
      [String(staleDays)]
    );

    return res.json({
      prototype: true,
      note: 'Rule-based prototype analytics — not a trained AI model',
      rules: {
        staleNotScannedDays: staleDays,
      },
      missingCount: missing.rows[0].count,
      byStatus: byStatus.rows,
      byCategory: byCategory.rows,
      staleAssets: stale.rows.map((a) => ({
        id: a.id,
        assetCode: a.asset_code,
        name: a.name,
        category: a.category,
        location: a.location,
        status: a.status,
        lastScannedAt: a.last_scanned_at,
      })),
    });
  } catch (err) {
    console.error('Analytics error:', err.message);
    return res.status(500).json({ error: 'Failed to load analytics' });
  }
});

module.exports = router;
