const { query } = require('../db/pool');

async function logActivity({
  actorUserId = null,
  actorName = null,
  action,
  entityType,
  entityId = null,
  assetId = null,
  summary,
  details = null,
  client = null,
}) {
  const runner = client ? client.query.bind(client) : query;
  await runner(
    `INSERT INTO activity_logs
      (actor_user_id, actor_name, action, entity_type, entity_id, asset_id, summary, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      actorUserId,
      actorName,
      action,
      entityType,
      entityId,
      assetId,
      summary,
      details ? JSON.stringify(details) : null,
    ]
  );
}

module.exports = { logActivity };
