const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { email: user.email, name: user.display_name },
      process.env.JWT_SECRET,
      {
        subject: String(user.id),
        expiresIn: process.env.JWT_EXPIRES_IN || '8h',
      }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
