import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

function result(query) {
  return query.then(({ data, error }) => { if (error) throw Error(`Storage operation failed: ${error.code || error.message || 'unknown'}`); return data; });
}

export class CloudStore {
  constructor(url, serviceRoleKey) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) }) } });
  }
  async save(kind, owner, value) {
    const now = new Date().toISOString();
    const data = { ...value, id: value.id || randomUUID() };
    const existing = await result(this.client.from('pac_records').select('kind,owner,data').eq('id', data.id).maybeSingle());
    if (existing && (existing.kind !== kind || existing.owner !== owner)) throw Error('Record unavailable');
    const previous = existing?.data || null;
    const stored = { ...data, createdAt: previous?.createdAt || data.createdAt || now, updatedAt: now };
    await result(this.client.from('pac_records').upsert({ id: stored.id, kind, owner, data: stored, updated_at: now }, { onConflict: 'id' }).select('id').single());
    return stored;
  }
  async list(kind, owner) {
    let query = this.client.from('pac_records').select('data').eq('kind', kind).order('updated_at', { ascending: false });
    if (owner) query = query.eq('owner', owner);
    return (await result(query)).map(row => row.data);
  }
  async get(id, owner, kind) {
    const row = await result(this.client.from('pac_records').select('kind,owner,data').eq('id', id).maybeSingle());
    if (!row || (owner && owner !== row.owner) || (kind && kind !== row.kind)) throw Error('Record unavailable');
    return row.data;
  }
  async delete(id, owner, kind) {
    await this.get(id, owner, kind);
    await result(this.client.from('pac_records').delete().eq('id', id));
  }
  async deleteAll(kind, owner) {
    const rows = await result(this.client.from('pac_records').delete().eq('kind', kind).eq('owner', owner).select('id'));
    return rows.length;
  }
  async audit({ team, actor, action, targetKind, targetId, details = {} }) {
    const event = { id: randomUUID(), team, actor, action, targetKind, targetId, createdAt: new Date().toISOString(), details };
    await result(this.client.from('pac_audit_events').insert({ id: event.id, team, actor, action, target_kind: targetKind,
      target_id: targetId, created_at: event.createdAt, details }));
    return event;
  }
  async listAudit(team, limit = 25, offset = 0) {
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const rows = await result(this.client.from('pac_audit_events').select('*').eq('team', team).order('created_at', { ascending: false }).range(safeOffset, safeOffset + safeLimit - 1));
    return rows.map(row => ({ id: row.id, team: row.team, actor: row.actor, action: row.action, targetKind: row.target_kind,
      targetId: row.target_id, createdAt: row.created_at, details: row.details || {} }));
  }
  async purgeExpired(retentionDays, now = new Date()) {
    if (!Number.isInteger(retentionDays) || retentionDays <= 0) return 0;
    const cutoff = new Date(now.getTime() - retentionDays * 86400000).toISOString();
    const rows = await result(this.client.from('pac_records').delete().in('kind', ['check', 'submission']).lt('updated_at', cutoff).select('id'));
    return rows.length;
  }
}
