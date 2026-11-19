const express = require('express');
const { query } = require('../db/pool');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const params = [];
    let where = 'WHERE active = TRUE';
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (full_name ILIKE $1 OR email ILIKE $1 OR department ILIKE $1 OR employee_code ILIKE $1)`;
    }
    const result = await query(
      `SELECT id, employee_code, full_name, email, department, active, created_at
       FROM employees ${where}
       ORDER BY full_name ASC`,
      params
    );
    return res.json({
      employees: result.rows.map((e) => ({
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        email: e.email,
        department: e.department,
        active: e.active,
        createdAt: e.created_at,
      })),
      note: 'Fictional demo employee directory — recipients only, no login accounts',
    });
  } catch (err) {
    console.error('List employees error:', err.message);
    return res.status(500).json({ error: 'Failed to list employees' });
  }
});

router.post('/', requireRoles('Admin'), async (req, res) => {
  try {
    const employeeCode = String(req.body.employeeCode || '').trim();
    const fullName = String(req.body.fullName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const department = String(req.body.department || '').trim();

    if (!employeeCode || !fullName || !email || !department) {
      return res.status(400).json({
        error: 'employeeCode, fullName, email, and department are required',
      });
    }

    const result = await query(
      `INSERT INTO employees (employee_code, full_name, email, department)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [employeeCode, fullName, email, department]
    );
    const e = result.rows[0];

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'employee.create',
      entityType: 'employee',
      entityId: e.id,
      summary: `Created employee ${e.full_name}`,
    });

    return res.status(201).json({
      employee: {
        id: e.id,
        employeeCode: e.employee_code,
        fullName: e.full_name,
        email: e.email,
        department: e.department,
        active: e.active,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Employee code already exists' });
    }
    console.error('Create employee error:', err.message);
    return res.status(500).json({ error: 'Failed to create employee' });
  }
});

module.exports = router;
