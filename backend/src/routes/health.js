const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireAgentToken } = require('../middleware/auth');

const router = express.Router();

/** Agent check-in — authenticated with AGENT_TOKEN, not user JWT */
router.post('/checkin', requireAgentToken, async (req, res) => {
  try {
    const deviceId = String(req.body.deviceId || '').trim();
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const cpu = req.body.cpuPercent !== undefined ? Number(req.body.cpuPercent) : null;
    const mem = req.body.memoryPercent !== undefined ? Number(req.body.memoryPercent) : null;
    const batt = req.body.batteryPercent !== undefined ? Number(req.body.batteryPercent) : null;
    let batteryHealth = req.body.batteryHealth ? String(req.body.batteryHealth).trim() : null;
    const isDemo = Boolean(req.body.isDemo);

    // Never invent battery health
    if (!batteryHealth) batteryHealth = 'Unavailable';

    const result = await query(
      `INSERT INTO device_checkins
         (device_id, cpu_percent, memory_percent, battery_percent, battery_health, is_demo, raw_meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        deviceId,
        Number.isFinite(cpu) ? cpu : null,
        Number.isFinite(mem) ? mem : null,
        Number.isFinite(batt) ? batt : null,
        batteryHealth,
        isDemo,
        JSON.stringify({ source: isDemo ? 'demo' : 'agent' }),
      ]
    );

    const row = result.rows[0];
    return res.status(201).json({
      checkin: {
        id: row.id,
        deviceId: row.device_id,
        checkedAt: row.checked_at,
        cpuPercent: row.cpu_percent !== null ? Number(row.cpu_percent) : null,
        memoryPercent: row.memory_percent !== null ? Number(row.memory_percent) : null,
        batteryPercent: row.battery_percent !== null ? Number(row.battery_percent) : null,
        batteryHealth: row.battery_health,
        isDemo: row.is_demo,
      },
    });
  } catch (err) {
    console.error('Health checkin error:', err.message);
    return res.status(500).json({ error: 'Failed to record check-in' });
  }
});

router.get('/devices', requireAuth, async (_req, res) => {
  try {
    const latest = await query(`
      SELECT DISTINCT ON (device_id)
        id, device_id, checked_at, cpu_percent, memory_percent, battery_percent, battery_health, is_demo
      FROM device_checkins
      ORDER BY device_id, checked_at DESC
    `);

    const recent = await query(`
      SELECT id, device_id, checked_at, cpu_percent, memory_percent, battery_percent, battery_health, is_demo
      FROM device_checkins
      ORDER BY checked_at DESC
      LIMIT 40
    `);

    const warnings = [];
    for (const d of latest.rows) {
      const cpu = d.cpu_percent !== null ? Number(d.cpu_percent) : null;
      const mem = d.memory_percent !== null ? Number(d.memory_percent) : null;
      const batt = d.battery_percent !== null ? Number(d.battery_percent) : null;
      if (cpu !== null && cpu >= 90) {
        warnings.push({
          deviceId: d.device_id,
          type: 'cpu_high',
          message: `CPU ${cpu}% (threshold 90%) — health warning, not predictive maintenance`,
          checkedAt: d.checked_at,
          isDemo: d.is_demo,
        });
      }
      if (mem !== null && mem >= 90) {
        warnings.push({
          deviceId: d.device_id,
          type: 'memory_high',
          message: `Memory ${mem}% (threshold 90%) — health warning, not predictive maintenance`,
          checkedAt: d.checked_at,
          isDemo: d.is_demo,
        });
      }
      if (batt !== null && batt <= 15) {
        warnings.push({
          deviceId: d.device_id,
          type: 'battery_low',
          message: `Battery ${batt}% (threshold 15%) — health warning, not predictive maintenance`,
          checkedAt: d.checked_at,
          isDemo: d.is_demo,
        });
      }
    }

    // Simple trend: last 3 CPU readings rising and above 70
    for (const deviceId of new Set(recent.rows.map((r) => r.device_id))) {
      const series = recent.rows
        .filter((r) => r.device_id === deviceId && r.cpu_percent !== null)
        .slice(0, 3)
        .map((r) => Number(r.cpu_percent))
        .reverse();
      if (
        series.length === 3 &&
        series[0] < series[1] &&
        series[1] < series[2] &&
        series[2] >= 70
      ) {
        warnings.push({
          deviceId,
          type: 'cpu_trend_up',
          message: `CPU trending up (${series.join(' → ')}%) — health warning, not predictive maintenance`,
          isDemo: recent.rows.find((r) => r.device_id === deviceId)?.is_demo,
        });
      }
    }

    return res.json({
      note: 'Laptop health agent telemetry. Warnings are threshold/trend based — not predictive maintenance.',
      devices: latest.rows.map((d) => ({
        deviceId: d.device_id,
        checkedAt: d.checked_at,
        cpuPercent: d.cpu_percent !== null ? Number(d.cpu_percent) : null,
        memoryPercent: d.memory_percent !== null ? Number(d.memory_percent) : null,
        batteryPercent: d.battery_percent !== null ? Number(d.battery_percent) : null,
        batteryHealth: d.battery_health || 'Unavailable',
        isDemo: d.is_demo,
      })),
      recent: recent.rows.map((d) => ({
        id: d.id,
        deviceId: d.device_id,
        checkedAt: d.checked_at,
        cpuPercent: d.cpu_percent !== null ? Number(d.cpu_percent) : null,
        memoryPercent: d.memory_percent !== null ? Number(d.memory_percent) : null,
        batteryPercent: d.battery_percent !== null ? Number(d.battery_percent) : null,
        batteryHealth: d.battery_health || 'Unavailable',
        isDemo: d.is_demo,
      })),
      warnings,
    });
  } catch (err) {
    console.error('Health devices error:', err.message);
    return res.status(500).json({ error: 'Failed to load device health' });
  }
});

/** Clearly labeled demo telemetry for presentations without a running agent */
router.post('/demo-checkin', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `INSERT INTO device_checkins
         (device_id, cpu_percent, memory_percent, battery_percent, battery_health, is_demo, raw_meta)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6)
       RETURNING *`,
      [
        'DEMO-LAPTOP-01',
        72.5,
        81.0,
        22.0,
        'Unavailable',
        JSON.stringify({ source: 'manual_demo' }),
      ]
    );
    return res.status(201).json({
      note: 'DEMO DATA — not from a real agent',
      checkin: result.rows[0],
    });
  } catch (err) {
    console.error('Demo checkin error:', err.message);
    return res.status(500).json({ error: 'Failed to insert demo check-in' });
  }
});

module.exports = router;
