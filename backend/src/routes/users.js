const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { requireAuth, requireRoles, ROLES } = require('../middleware/auth');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth, requireRoles('Admin'));

router.get('/', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, email, display_name, role, created_at
       FROM users ORDER BY email ASC`
    );
    return res.json({
      users: result.rows.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        createdAt: u.created_at,
      })),
    });
  } catch (err) {
    console.error('List users error:', err.message);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const displayName = String(req.body.displayName || '').trim();
    const password = String(req.body.password || '');
    const role = String(req.body.role || 'Staff').trim();

    if (!email || !displayName || !password) {
      return res.status(400).json({ error: 'email, displayName, and password are required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, role, created_at`,
      [email, hash, displayName, role]
    );
    const u = result.rows[0];

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'user.create',
      entityType: 'user',
      entityId: u.id,
      summary: `Created user ${u.email} with role ${u.role}`,
    });

    return res.status(201).json({
      user: {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('Create user error:', err.message);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id/role', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const role = String(req.body.role || '').trim();
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${ROLES.join(', ')}` });
    }
    if (id === req.user.id && role !== 'Admin') {
      return res.status(400).json({ error: 'Cannot remove your own Admin role' });
    }

    const existing = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const before = existing.rows[0].role;

    const result = await query(
      `UPDATE users SET role = $1 WHERE id = $2
       RETURNING id, email, display_name, role, created_at`,
      [role, id]
    );
    const u = result.rows[0];

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'user.role_change',
      entityType: 'user',
      entityId: u.id,
      summary: `Changed role for ${u.email} from ${before} to ${u.role}`,
      details: { from: before, to: u.role },
    });

    return res.json({
      user: {
        id: u.id,
        email: u.email,
        displayName: u.display_name,
        role: u.role,
        createdAt: u.created_at,
      },
    });
  } catch (err) {
    console.error('Update role error:', err.message);
    return res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
