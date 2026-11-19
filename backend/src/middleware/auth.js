const jwt = require('jsonwebtoken');

const ROLES = ['Admin', 'Staff', 'Approver'];

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, headerToken] = header.split(' ');
  const queryToken = req.query.access_token ? String(req.query.access_token) : null;
  const token = scheme === 'Bearer' && headerToken ? headerToken : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: Number(payload.sub),
      email: payload.email,
      name: payload.name,
      role: payload.role || 'Staff',
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRoles(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires role ${allowed.join(' or ')}`,
      });
    }
    return next();
  };
}

function requireAgentToken(req, res, next) {
  const expected = process.env.AGENT_TOKEN;
  if (!expected) {
    return res.status(503).json({ error: 'Agent token is not configured on the server' });
  }
  const provided =
    req.headers['x-agent-token'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Invalid agent token' });
  }
  return next();
}

module.exports = { requireAuth, requireRoles, requireAgentToken, ROLES };
