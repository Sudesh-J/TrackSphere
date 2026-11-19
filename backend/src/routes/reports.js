const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { calculateStraightLineNbv, calculateNpv } = require('../utils/depreciation');

const router = express.Router();
router.use(requireAuth);

router.get('/assets', async (req, res) => {
  try {
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const status = String(req.query.status || '').trim();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;

    const clauses = [];
    const params = [];

    if (location) {
      params.push(`%${location}%`);
      clauses.push(`a.location ILIKE $${params.length}`);
    }
    if (category) {
      params.push(category);
      clauses.push(`a.category = $${params.length}`);
    }
    if (status) {
      params.push(status);
      clauses.push(`a.status = $${params.length}`);
    }
    if (employeeId) {
      params.push(employeeId);
      clauses.push(`al.employee_id = $${params.length} AND al.status = 'allocated'`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT a.*,
              e.full_name AS assignee_name,
              e.email AS assignee_email,
              al.allocated_at
       FROM assets a
       LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'allocated'
       LEFT JOIN employees e ON e.id = al.employee_id
       ${where}
       ORDER BY a.asset_code ASC`,
      params
    );

    const rows = result.rows.map((row) => {
      const dep = calculateStraightLineNbv({
        purchaseCost: row.purchase_cost,
        residualValue: row.residual_value,
        usefulLifeYears: row.useful_life_years,
        purchaseDate: row.purchase_date,
      });
      return {
        assetCode: row.asset_code,
        name: row.name,
        location: row.location,
        category: row.category,
        status: row.status,
        currentAssignee: row.assignee_name || null,
        lastScanOrHandover: row.last_handover_at || row.last_scanned_at,
        purchaseCost: row.purchase_cost !== null ? Number(row.purchase_cost) : null,
        accumulatedDepreciation: dep.accumulatedDepreciation,
        nbv: dep.nbv,
      };
    });

    return res.json({
      generatedAt: new Date().toISOString(),
      formula:
        'NBV = purchaseCost - min((purchaseCost - residualValue) / usefulLifeYears * yearsElapsed, purchaseCost - residualValue); floored at residualValue. Straight-line, day-fraction years (365.25). NBV ≠ NPV.',
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error('Report error:', err.message);
    return res.status(500).json({ error: 'Failed to build report' });
  }
});

router.get('/assets.csv', async (req, res) => {
  try {
    // Reuse same filters via internal call pattern
    req.url = '/assets?' + new URLSearchParams(req.query).toString();
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const status = String(req.query.status || '').trim();
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : null;
    const clauses = [];
    const params = [];
    if (location) {
      params.push(`%${location}%`);
      clauses.push(`a.location ILIKE $${params.length}`);
    }
    if (category) {
      params.push(category);
      clauses.push(`a.category = $${params.length}`);
    }
    if (status) {
      params.push(status);
      clauses.push(`a.status = $${params.length}`);
    }
    if (employeeId) {
      params.push(employeeId);
      clauses.push(`al.employee_id = $${params.length} AND al.status = 'allocated'`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT a.*, e.full_name AS assignee_name
       FROM assets a
       LEFT JOIN allocations al ON al.asset_id = a.id AND al.status = 'allocated'
       LEFT JOIN employees e ON e.id = al.employee_id
       ${where}
       ORDER BY a.asset_code ASC`,
      params
    );

    const header = [
      'assetCode',
      'name',
      'location',
      'category',
      'status',
      'currentAssignee',
      'lastScanOrHandover',
      'purchaseCost',
      'accumulatedDepreciation',
      'nbv',
    ];
    const lines = [header.join(',')];
    for (const row of result.rows) {
      const dep = calculateStraightLineNbv({
        purchaseCost: row.purchase_cost,
        residualValue: row.residual_value,
        usefulLifeYears: row.useful_life_years,
        purchaseDate: row.purchase_date,
      });
      const vals = [
        row.asset_code,
        row.name,
        row.location,
        row.category,
        row.status,
        row.assignee_name || '',
        row.last_handover_at || row.last_scanned_at || '',
        row.purchase_cost ?? '',
        dep.accumulatedDepreciation ?? '',
        dep.nbv ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(vals.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tracksphere-asset-report.csv"');
    return res.send(lines.join('\n'));
  } catch (err) {
    console.error('CSV report error:', err.message);
    return res.status(500).json({ error: 'Failed to export CSV' });
  }
});

router.post('/npv', async (req, res) => {
  try {
    const cashFlows = req.body.cashFlows;
    const discountRatePercent = req.body.discountRatePercent;
    const result = calculateNpv(cashFlows, discountRatePercent);
    return res.json({
      note: 'NPV calculator is separate from asset NBV / depreciation reports.',
      ...result,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
