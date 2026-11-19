const express = require('express');
const { query } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { generateGeminiContent, isGeminiConfigured } = require('../utils/gemini');
const { logActivity } = require('../utils/activity');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_ACTIONS = new Set([
  'none',
  'find_assets',
  'summarize_inventory',
  'explain_app',
  'propose_create_asset',
]);

router.get('/status', (_req, res) => {
  return res.json({
    geminiConfigured: isGeminiConfigured(),
    message: isGeminiConfigured()
      ? 'Assistant is ready'
      : 'GEMINI_API_KEY is missing. Configure it in backend/.env to enable the assistant.',
  });
});

router.post('/chat', async (req, res) => {
  try {
    if (!isGeminiConfigured()) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY is missing. Configure it on the backend to use the assistant.',
        geminiConfigured: false,
      });
    }

    const message = String(req.body.message || '').trim();
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const counts = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status='available')::int AS available,
        COUNT(*) FILTER (WHERE status='in_use')::int AS in_use,
        COUNT(*) FILTER (WHERE status='missing')::int AS missing,
        COUNT(*) FILTER (WHERE status='maintenance')::int AS maintenance,
        COUNT(*) FILTER (WHERE status='retired')::int AS retired
      FROM assets
    `);

    const sample = await query(
      `SELECT asset_code, name, status, location, category
       FROM assets ORDER BY asset_code ASC LIMIT 40`
    );

    const system = `You are TrackSphere assistant for a student asset-management app.
User role: ${req.user.role}. User name: ${req.user.name}.
You may only help with: finding assets, summarizing inventory, explaining how to use the app,
and proposing a draft create-asset form for Admins.
Never invent SQL. Never claim you changed the database.
If proposing create_asset, role must be Admin; otherwise refuse.
Inventory snapshot: ${JSON.stringify(counts.rows[0])}
Sample assets: ${JSON.stringify(sample.rows)}

Respond with JSON ONLY:
{
  "reply": "markdown-friendly text for the user",
  "action": "none|find_assets|summarize_inventory|explain_app|propose_create_asset",
  "assets": [{"assetCode":"","name":"","status":"","location":""}],
  "draft": null | {
    "type": "create_asset",
    "assetCode": "",
    "name": "",
    "category": "",
    "location": "",
    "purchaseCost": null,
    "vendor": "",
    "serialNumber": ""
  }
}`;

    const { result } = await generateGeminiContent(`${system}\n\nUser: ${message}`);
    const text = result.response.text();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.json({ reply: text, action: 'none', assets: [], draft: null });
    }

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return res.json({ reply: text, action: 'none', assets: [], draft: null });
    }

    if (!ALLOWED_ACTIONS.has(parsed.action)) parsed.action = 'none';

    if (parsed.action === 'propose_create_asset' && req.user.role !== 'Admin') {
      parsed.action = 'none';
      parsed.draft = null;
      parsed.reply =
        (parsed.reply || '') +
        '\n\n(Note: only Admins can create assets. Draft creation was blocked by permissions.)';
    }

    if (parsed.action === 'find_assets' && message) {
      const q = `%${message.replace(/[^a-zA-Z0-9\- ]/g, '').slice(0, 60)}%`;
      const found = await query(
        `SELECT asset_code, name, status, location FROM assets
         WHERE asset_code ILIKE $1 OR name ILIKE $1 OR location ILIKE $1
         ORDER BY asset_code ASC LIMIT 15`,
        [q]
      );
      if (found.rows.length) {
        parsed.assets = found.rows.map((a) => ({
          assetCode: a.asset_code,
          name: a.name,
          status: a.status,
          location: a.location,
        }));
      }
    }

    return res.json({
      reply: parsed.reply || text,
      action: parsed.action || 'none',
      assets: parsed.assets || [],
      draft: parsed.draft || null,
      note: 'Any data-changing draft requires explicit confirmation via /api/assistant/confirm',
    });
  } catch (err) {
    console.error('Assistant chat error:', err.message);
    return res.status(500).json({ error: 'Assistant failed' });
  }
});

router.post('/confirm', async (req, res) => {
  try {
    const confirmed = Boolean(req.body.confirmed);
    const draft = req.body.draft;
    if (!confirmed) {
      return res.status(400).json({ error: 'confirmed:true is required', requiresConfirmation: true });
    }
    if (!draft || draft.type !== 'create_asset') {
      return res.status(400).json({ error: 'Unsupported draft type' });
    }
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can create assets' });
    }

    const assetCode = String(draft.assetCode || '').trim();
    const name = String(draft.name || '').trim();
    const category = String(draft.category || 'General').trim();
    const location = String(draft.location || 'Intake').trim();
    if (!assetCode || !name) {
      return res.status(400).json({ error: 'draft.assetCode and draft.name are required' });
    }

    const result = await query(
      `INSERT INTO assets (asset_code, name, category, location, status, vendor, serial_number, purchase_cost)
       VALUES ($1,$2,$3,$4,'available',$5,$6,$7)
       RETURNING id, asset_code`,
      [
        assetCode,
        name,
        category,
        location,
        draft.vendor || null,
        draft.serialNumber || null,
        draft.purchaseCost != null && draft.purchaseCost !== '' ? Number(draft.purchaseCost) : null,
      ]
    );

    await logActivity({
      actorUserId: req.user.id,
      actorName: req.user.name,
      action: 'assistant.create_asset',
      entityType: 'asset',
      entityId: result.rows[0].id,
      assetId: result.rows[0].id,
      summary: `Assistant-confirmed create of ${result.rows[0].asset_code}`,
    });

    return res.status(201).json({
      message: 'Asset created after confirmation',
      assetId: result.rows[0].id,
      assetCode: result.rows[0].asset_code,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Asset code already exists' });
    }
    console.error('Assistant confirm error:', err.message);
    return res.status(500).json({ error: 'Failed to confirm assistant action' });
  }
});

module.exports = router;
