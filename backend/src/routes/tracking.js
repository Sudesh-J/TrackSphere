const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/** Simulated RFID scan — finds asset by tag ID, writes event, updates last_scanned_at */
router.post('/scan', async (req, res) => {
  try {
    const rfidTagId = String(req.body.rfidTagId || '').trim();
    const locationOverride = req.body.location
      ? String(req.body.location).trim()
      : null;
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    if (!rfidTagId) {
      return res.status(400).json({ error: 'rfidTagId is required' });
    }

    const assetResult = await query(
      'SELECT * FROM assets WHERE rfid_tag_id = $1',
      [rfidTagId]
    );

    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No asset found for this RFID tag',
        simulation: true,
      });
    }

    const asset = assetResult.rows[0];
    const location = locationOverride || asset.location;

    const eventResult = await query(
      `INSERT INTO tracking_events (asset_id, rfid_tag_id, location, source, notes)
       VALUES ($1, $2, $3, 'rfid_simulation', $4)
       RETURNING *`,
      [asset.id, rfidTagId, location, notes]
    );

    const updatedAsset = await query(
      `UPDATE assets
       SET last_scanned_at = $1, location = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [eventResult.rows[0].scanned_at, location, asset.id]
    );

    return res.status(201).json({
      simulation: true,
      message: 'RFID scan simulated successfully',
      asset: {
        id: updatedAsset.rows[0].id,
        assetCode: updatedAsset.rows[0].asset_code,
        name: updatedAsset.rows[0].name,
        category: updatedAsset.rows[0].category,
        location: updatedAsset.rows[0].location,
        rfidTagId: updatedAsset.rows[0].rfid_tag_id,
        status: updatedAsset.rows[0].status,
        lastScannedAt: updatedAsset.rows[0].last_scanned_at,
      },
      event: {
        id: eventResult.rows[0].id,
        location: eventResult.rows[0].location,
        scannedAt: eventResult.rows[0].scanned_at,
        source: eventResult.rows[0].source,
      },
    });
  } catch (err) {
    console.error('RFID scan error:', err.message);
    return res.status(500).json({ error: 'Failed to process RFID scan' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await query(
      `SELECT t.id, t.rfid_tag_id, t.location, t.scanned_at, t.source, t.notes,
              a.asset_code, a.name AS asset_name, a.status
       FROM tracking_events t
       JOIN assets a ON a.id = t.asset_id
       ORDER BY t.scanned_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      events: result.rows.map((row) => ({
        id: row.id,
        rfidTagId: row.rfid_tag_id,
        location: row.location,
        scannedAt: row.scanned_at,
        source: row.source,
        notes: row.notes,
        assetCode: row.asset_code,
        assetName: row.asset_name,
        status: row.status,
      })),
    });
  } catch (err) {
    console.error('List events error:', err.message);
    return res.status(500).json({ error: 'Failed to list tracking events' });
  }
});

module.exports = router;
