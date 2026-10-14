const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/** Seeded edge-agent demo data — not real IoT infrastructure */
router.get('/', async (req, res) => {
  try {
    const agents = await query(
      `SELECT id, agent_code, display_name, location, status, last_heartbeat
       FROM edge_agents
       ORDER BY agent_code ASC`
    );

    const recentScans = await query(
      `SELECT t.id, t.rfid_tag_id, t.location, t.scanned_at, a.asset_code, a.name AS asset_name
       FROM tracking_events t
       JOIN assets a ON a.id = t.asset_id
       ORDER BY t.scanned_at DESC
       LIMIT 5`
    );

    return res.json({
      simulation: true,
      agents: agents.rows.map((a) => ({
        id: a.id,
        agentCode: a.agent_code,
        displayName: a.display_name,
        location: a.location,
        status: a.status,
        lastHeartbeat: a.last_heartbeat,
      })),
      recentScanEvents: recentScans.rows.map((e) => ({
        id: e.id,
        rfidTagId: e.rfid_tag_id,
        location: e.location,
        scannedAt: e.scanned_at,
        assetCode: e.asset_code,
        assetName: e.asset_name,
      })),
    });
  } catch (err) {
    console.error('Edge agents error:', err.message);
    return res.status(500).json({ error: 'Failed to load edge agents' });
  }
});

module.exports = router;
