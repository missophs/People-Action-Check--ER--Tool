import { Store } from '../src/store.js';
import { CloudStore } from '../src/cloud-store.js';

for (const key of ['DATA_PATH', 'SLACK_TEAM_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  if (!process.env[key]) throw Error(`Configure ${key} before migration.`);
const source = new Store(process.env.DATA_PATH);
const target = new CloudStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let records = 0, audits = 0;
try {
  for (const kind of ['check', 'submission', 'policy']) for (const data of source.list(kind)) {
    const row = source.db.prepare('select owner from records where id=?').get(data.id);
    await target.save(kind, row.owner, data); records++;
  }
  const events = source.db.prepare('select * from audit_events where team=? order by created_at').all(process.env.SLACK_TEAM_ID)
    .map(row => ({ ...row, details: JSON.parse(row.details) }));
  for (const event of events) {
    await target.audit({ team: event.team, actor: event.actor, action: event.action, targetKind: event.target_kind,
      targetId: event.target_id, details: { ...event.details, migratedFrom: 'sqlite', originalCreatedAt: event.created_at } });
    audits++;
  }
} finally { source.close(); }
console.log(JSON.stringify({ migratedRecords: records, migratedAuditEvents: audits }));
