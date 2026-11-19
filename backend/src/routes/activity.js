const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const assetId = req.query.assetId ? Number(req.query.assetId) : null;
    const params = [];
    let where = '';
    if (assetId) {
      params.push(assetId);
      where = `WHERE asset_id = $${params.length}`;
    }
    params.push(limit);
    const result = await query(
      `SELECT id, actor_user_id, actor_name, action, entity_type, entity_id, asset_id,
              summary, details, created_at
       FROM activity_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params
    );
    return res.json({
      activities: result.rows.map((r) => ({
        id: r.id,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        assetId: r.asset_id,
        summary: r.summary,
        details: r.details,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('Activity list error:', err.message);
    return res.status(500).json({ error: 'Failed to load activity history' });
  }
});

module.exports = router;
