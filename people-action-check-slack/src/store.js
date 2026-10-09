import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT, owner TEXT, data TEXT);
      CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY, team TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target_kind TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL, details TEXT NOT NULL)`);
  }
  save(kind, owner, data) {
    const now = new Date().toISOString();
    data = { ...data, id: data.id || randomUUID() };
    const existing = this.db.prepare('SELECT kind,owner FROM records WHERE id=?').get(data.id);
    if (existing && (existing.kind !== kind || existing.owner !== owner)) throw Error('Record unavailable');
    const previous = existing ? this.get(data.id, owner, kind) : null;
    data = { ...data, createdAt: previous?.createdAt || data.createdAt || now, updatedAt: now };
    this.db.prepare('INSERT INTO records VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(data.id, kind, owner, JSON.stringify(data));
    return data;
  }
  list(kind, owner) {
    return this.db.prepare('SELECT data FROM records WHERE kind=?' + (owner ? ' AND owner=?' : '') + ' ORDER BY rowid DESC')
      .all(...(owner ? [kind, owner] : [kind])).map(r => JSON.parse(r.data));
  }
  get(id, owner, kind) {
    const r = this.db.prepare('SELECT data,owner,kind FROM records WHERE id=?').get(id);
    if (!r || (owner && owner !== r.owner) || (kind && kind !== r.kind)) throw Error('Record unavailable');
    return JSON.parse(r.data);
  }
  delete(id, owner, kind) {
    this.get(id, owner, kind);
    this.db.prepare('DELETE FROM records WHERE id=?').run(id);
  }
  deleteAll(kind, owner) {
    const result = this.db.prepare('DELETE FROM records WHERE kind=? AND owner=?').run(kind, owner);
    return Number(result.changes || 0);
  }
  audit({ team, actor, action, targetKind, targetId, details = {} }) {
    const event = { id: randomUUID(), team, actor, action, targetKind, targetId, createdAt: new Date().toISOString(), details };
    this.db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').run(event.id, team, actor, action, targetKind, targetId, event.createdAt, JSON.stringify(details));
    return event;
  }
  listAudit(team, limit = 25, offset = 0) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const safeOffset = Math.max(0, Number(offset) || 0);
    return this.db.prepare('SELECT * FROM audit_events WHERE team=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(team, safeLimit, safeOffset)
      .map(row => ({ id: row.id, team: row.team, actor: row.actor, action: row.action, targetKind: row.target_kind, targetId: row.target_id, createdAt: row.created_at, details: JSON.parse(row.details) }));
  }
  purgeExpired(retentionDays, now = new Date()) {
    if (!Number.isInteger(retentionDays) || retentionDays <= 0) return 0;
    const cutoff = new Date(now.getTime() - retentionDays * 86400000).toISOString();
    const rows = this.db.prepare("SELECT id,data FROM records WHERE kind IN ('check','submission')").all();
    let removed = 0;
    const del = this.db.prepare('DELETE FROM records WHERE id=?');
    for (const row of rows) {
      const record = JSON.parse(row.data), timestamp = record.updatedAt || record.submittedAt || record.completedAt || record.createdAt;
      if (timestamp && timestamp < cutoff) { del.run(row.id); removed++; }
    }
    return removed;
  }
  close() { this.db.close(); }
}
