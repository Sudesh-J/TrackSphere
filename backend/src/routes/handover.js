const express = require('express');
const { query, withTransaction } = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth);

const BLOCKED = ['missing', 'maintenance', 'retired', 'in_use'];

async function loadAssetBundle(assetIdOrToken, byToken = false) {
  const sql = `
    SELECT a.*,
           e.id AS employee_id, e.full_name AS assignee_name, e.email AS assignee_email,
           e.department AS assignee_department, e.employee_code AS assignee_code,
           al.id AS allocation_id, al.return_by, al.notes AS allocation_notes,
           al.allocated_at, al.status AS allocation_status
    FROM assets a
    LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'allocated'
    LEFT JOIN employees e ON e.id = al.employee_id
    WHERE ${byToken ? 'a.qr_token = $1' : 'a.id = $1'}
  `;
  const result = await query(sql, [assetIdOrToken]);
  return result.rows[0] || null;
}

function mapBundle(row) {
  return {
    asset: {
      id: row.id,
      assetCode: row.asset_code,
      name: row.name,
      status: row.status,
      location: row.location,
      category: row.category,
      qrToken: row.qr_token,
      photoUrl: row.photo_path ? `/api/assets/${row.id}/photo` : null,
    },
    currentAllocation: row.allocation_id
      ? {
          id: row.allocation_id,
          employeeId: row.employee_id,
          assigneeName: row.assignee_name,
          assigneeEmail: row.assignee_email,
          assigneeDepartment: row.assignee_department,
          assigneeCode: row.assignee_code,
          returnBy: row.return_by,
          notes: row.allocation_notes,
          allocatedAt: row.allocated_at,
          status: row.allocation_status,
        }
      : null,
  };
}

router.get('/asset/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await loadAssetBundle(id, false);
    if (!row) return res.status(404).json({ error: 'Asset not found' });
    return res.json(mapBundle(row));
  } catch (err) {
    console.error('Handover get error:', err.message);
    return res.status(500).json({ error: 'Failed to load handover asset' });
  }
});

router.get('/token/:token', async (req, res) => {
  try {
    const row = await loadAssetBundle(String(req.params.token).trim(), true);
    if (!row) return res.status(404).json({ error: 'Asset not found for QR token' });
    return res.json(mapBundle(row));
  } catch (err) {
    console.error('Handover token error:', err.message);
    return res.status(500).json({ error: 'Failed to load handover asset' });
  }
});

router.post('/assign', requireRoles('Admin', 'Staff'), async (req, res) => {
  try {
    const assetId = Number(req.body.assetId);
    const employeeId = Number(req.body.employeeId);
    const returnBy = req.body.returnBy ? String(req.body.returnBy).trim() : null;
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const confirmed = Boolean(req.body.confirmed);

    if (!Number.isInteger(assetId) || assetId < 1) {
      return res.status(400).json({ error: 'Valid assetId is required' });
    }
    if (!Number.isInteger(employeeId) || employeeId < 1) {
      return res.status(400).json({ error: 'Valid employeeId is required' });
    }
    if (!confirmed) {
      return res.status(400).json({
        error: 'Confirmation required. Resubmit with confirmed: true after reviewing the draft.',
        requiresConfirmation: true,
      });
    }

    const result = await withTransaction(async (client) => {
      const assetRes = await client.query('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [
        assetId,
      ]);
      if (assetRes.rows.length === 0) {
        const err = new Error('Asset not found');
        err.status = 404;
        throw err;
      }
      const asset = assetRes.rows[0];
      if (asset.status !== 'available') {
        const err = new Error(
          `Cannot handover asset with status "${asset.status}". Only available assets can be assigned.`
        );
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

      const emp = await client.query(
        `SELECT * FROM employees WHERE id = $1 AND active = TRUE`,
        [employeeId]
      );
      if (emp.rows.length === 0) {
        const err = new Error('Employee not found or inactive');
        err.status = 404;
        throw err;
      }

      const inserted = await client.query(
        `INSERT INTO allocations
           (asset_id, employee_id, assigned_to, allocated_by, allocated_by_user_id, return_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          assetId,
          employeeId,
          emp.rows[0].full_name,
          req.user.name,
          req.user.id,
          returnBy,
          notes,
        ]
      );

      await client.query(
        `UPDATE assets
         SET status = 'in_use', last_handover_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [assetId]
      );

      await logActivity({
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'handover.assign',
        entityType: 'allocation',
        entityId: inserted.rows[0].id,
        assetId,
        summary: `Handed over ${asset.asset_code} to ${emp.rows[0].full_name}`,
        details: {
          employeeId,
          returnBy,
          notes,
        },
        client,
      });

      return {
        allocation: inserted.rows[0],
        employee: emp.rows[0],
        asset,
      };
    });

    return res.status(201).json({
      message: 'Handover completed',
      allocation: {
        id: result.allocation.id,
        assetId,
        employeeId,
        assignedTo: result.employee.full_name,
        returnBy: result.allocation.return_by,
        allocatedAt: result.allocation.allocated_at,
        allocatedBy: req.user.name,
        status: 'allocated',
      },
    });
  } catch (err) {
    console.error('Handover assign error:', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Handover failed' });
  }
});

router.post('/return', requireRoles('Admin', 'Staff'), async (req, res) => {
  try {
    const allocationId = Number(req.body.allocationId);
    const confirmed = Boolean(req.body.confirmed);
    if (!Number.isInteger(allocationId) || allocationId < 1) {
      return res.status(400).json({ error: 'Valid allocationId is required' });
    }
    if (!confirmed) {
      return res.status(400).json({
        error: 'Confirmation required. Resubmit with confirmed: true.',
        requiresConfirmation: true,
      });
    }

    const result = await withTransaction(async (client) => {
      const al = await client.query(`SELECT * FROM allocations WHERE id = $1 FOR UPDATE`, [
        allocationId,
      ]);
      if (al.rows.length === 0) {
        const err = new Error('Allocation not found');
        err.status = 404;
        throw err;
      }
      if (al.rows[0].status !== 'allocated') {
        const err = new Error('Allocation is already returned');
        err.status = 400;
        throw err;
      }

      await client.query(
        `UPDATE allocations
         SET status = 'returned', returned_at = NOW(), returned_by_user_id = $1
         WHERE id = $2`,
        [req.user.id, allocationId]
      );

      await client.query(
        `UPDATE assets SET status = 'available', updated_at = NOW() WHERE id = $1`,
        [al.rows[0].asset_id]
      );

      const asset = await client.query('SELECT asset_code FROM assets WHERE id = $1', [
        al.rows[0].asset_id,
      ]);

      await logActivity({
        actorUserId: req.user.id,
        actorName: req.user.name,
        action: 'handover.return',
        entityType: 'allocation',
        entityId: allocationId,
        assetId: al.rows[0].asset_id,
        summary: `Returned ${asset.rows[0]?.asset_code || 'asset'} from ${al.rows[0].assigned_to}`,
        client,
      });

      return al.rows[0];
    });

    return res.json({
      message: 'Return completed',
      allocationId: result.id,
      returnedBy: req.user.name,
    });
  } catch (err) {
    console.error('Handover return error:', err.message);
    return res.status(err.status || 500).json({ error: err.message || 'Return failed' });
  }
});

module.exports = router;
