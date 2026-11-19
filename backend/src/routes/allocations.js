const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth);

function mapAllocation(row) {
  return {
    id: row.id,
    assetId: row.asset_id,
    assetCode: row.asset_code,
    assetName: row.asset_name,
    employeeId: row.employee_id,
    assignedTo: row.assigned_to,
    allocatedBy: row.allocated_by,
    allocatedByUserId: row.allocated_by_user_id,
    returnedByUserId: row.returned_by_user_id,
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
    const result = await query(`${SELECT_JOIN} ${where} ORDER BY al.allocated_at DESC`, params);
    return res.json({ allocations: result.rows.map(mapAllocation) });
  } catch (err) {
    console.error('List allocations error:', err.message);
    return res.status(500).json({ error: 'Failed to list allocations' });
  }
});

router.post('/', requireRoles('Admin', 'Staff'), async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const employeeId = req.body.employeeId ? Number(req.body.employeeId) : null;
    const assignedTo = String(req.body.assignedTo || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const returnBy = req.body.returnBy ? String(req.body.returnBy).trim() : null;

    if (!Number.isInteger(assetId) || assetId < 1) {
      return res.status(400).json({ error: 'Valid assetId is required' });
    }

    const result = await withTransaction(async (client) => {
      const asset = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [assetId]);
      if (asset.rows.length === 0) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      if (['retired', 'missing', 'maintenance', 'in_use'].includes(asset.rows[0].status)) {
        const err = new Error(`Cannot allocate asset with status ${asset.rows[0].status}`);
        err.status = 400;
        throw err;
      }

      let empName = assignedTo;
      let empId = employeeId;
      if (employeeId) {
        const emp = await client.query(
          `SELECT * FROM employees WHERE id = $1 AND active = TRUE`,
          [employeeId]
        );
        if (emp.rows.length === 0) {
          const err = new Error('Employee not found');
          err.status = 404;
          throw err;
        }
        empName = emp.rows[0].full_name;
        empId = emp.rows[0].id;
      }
      if (!empName) {
        const err = new Error('assignedTo or employeeId is required');
        err.status = 400;
        throw err;
      }

      const active = await client.query(
        `SELECT id FROM allocations WHERE asset_id = $1 AND status = 'allocated' LIMIT 1`,
        [assetId]
      );
      if (active.rows.length > 0) {
        const err = new Error('Asset already has an active allocation');
        err.status = 409;
        throw err;
      }

      const inserted = await client.query(
        `INSERT INTO allocations
           (asset_id, employee_id, assigned_to, allocated_by, allocated_by_user_id, return_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [assetId, empId, empName, req.user.name, req.user.id, returnBy, notes]
      );

      await client.query(
        `UPDATE assets SET status='in_use', last_handover_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [assetId]
      );

      await logActivity({
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'allocation.create',
        entityType: 'allocation',
        entityId: inserted.rows[0].id,
        assetId,
        summary: `Allocated ${asset.rows[0].asset_code} to ${empName}`,
        client,
      });

      return inserted.rows[0].id;
    });

    const row = await query(`${SELECT_JOIN} WHERE al.id = $1`, [result]);
    return res.status(201).json({ allocation: mapAllocation(row.rows[0]) });
  } catch (err) {
    console.error('Create allocation error:', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to create allocation' });
  }
});

router.post('/:id/return', requireRoles('Admin', 'Staff'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid allocation id' });
    }

    await withTransaction(async (client) => {
      const existing = await client.query(`SELECT * FROM allocations WHERE id = $1 FOR UPDATE`, [id]);
      if (existing.rows.length === 0) {
        const err = new Error('Allocation not found');
        err.status = 404;
        throw err;
      }
      if (existing.rows[0].status !== 'allocated') {
        const err = new Error('Allocation is already returned');
        err.status = 400;
        throw err;
      }

      await client.query(
        `UPDATE allocations
         SET status='returned', returned_at=NOW(), returned_by_user_id=$1
         WHERE id=$2`,
        [req.user.id, id]
      );
      await client.query(`UPDATE assets SET status='available', updated_at=NOW() WHERE id=$1`, [
        existing.rows[0].asset_id,
      ]);

      await logActivity({
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'allocation.return',
        entityType: 'allocation',
        entityId: id,
        assetId: existing.rows[0].asset_id,
        summary: `Returned allocation #${id}`,
        client,
      });
    });

    const result = await query(`${SELECT_JOIN} WHERE al.id = $1`, [id]);
    return res.json({ allocation: mapAllocation(result.rows[0]) });
  } catch (err) {
    console.error('Return allocation error:', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to return allocation' });
  }
});

module.exports = router;
