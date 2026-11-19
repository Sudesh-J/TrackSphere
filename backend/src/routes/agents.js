const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

/**
 * Legacy edge-agent endpoint kept for compatibility.
 * Real device telemetry lives under /api/device-health.
 */
router.get('/', async (_req, res) => {
  return res.json({
    deprecated: true,
    simulation: true,
    message:
      'Seeded RFID edge agents are deprecated. Use Device Health (/api/device-health/devices) for the Windows laptop health agent. Any remaining rows are DEMO ONLY.',
    agents: [],
    recentScanEvents: [],
  });
});

module.exports = router;
