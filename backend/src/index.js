require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { pool } = require('./db/pool');

const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');
const trackingRoutes = require('./routes/tracking');
const dashboardRoutes = require('./routes/dashboard');
const agentRoutes = require('./routes/agents');
const analyticsRoutes = require('./routes/analytics');
const allocationRoutes = require('./routes/allocations');
const transferRoutes = require('./routes/transfers');
const retirementRoutes = require('./routes/retirements');
const approvalRoutes = require('./routes/approvals');

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, service: 'tracksphere-api', database: 'up' });
  } catch {
    return res.status(503).json({ ok: false, service: 'tracksphere-api', database: 'down' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/retirements', retirementRoutes);
app.use('/api/approvals', approvalRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    console.error('Missing DATABASE_URL or JWT_SECRET in .env');
    process.exit(1);
  }

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('Cannot connect to PostgreSQL:', err.message);
    console.error('Start the database with: docker compose up -d');
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`TrackSphere API listening on http://localhost:${port}`);
  });
}

start();
