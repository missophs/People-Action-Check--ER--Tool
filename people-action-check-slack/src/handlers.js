import { Document, Packer, Paragraph } from 'docx';
import { POLICY_CATEGORIES } from './content.js';
import * as v from './views.js';

export function values(view) {
  return Object.fromEntries(Object.entries(view.state?.values || {}).map(([key, fields]) => {
    const a = fields.value || {};
    return [key, a.files ?? a.selected_options?.map(x => x.value) ?? a.selected_option?.value ?? a.value ?? ''];
  }));
}
export async function deliverReport(client, user, record) {
  const dm = await client.conversations.open({ users: user });
  const file = await Packer.toBuffer(new Document({ sections: [{ children: v.report(record).split('\n').map(t => new Paragraph(t)) }] }));
  await client.files.uploadV2({ channel_id: dm.channel.id, file, filename: 'People-Action-Check.docx', title: 'People Action Check report' });
}
const metadata = view => JSON.parse(view.private_metadata || '{}');
const validText = (x, max) => typeof x === 'string' && Array.from(x).length <= max;
const completed = r => r.stage === 'done' && r.answers.length === v.questions(r).length && r.answers.every(a => ['yes', 'no', 'unknown'].includes(a));
const errorText = error => {
  const code = error?.data?.error;
  if (code === 'ratelimited' || error?.code === 'slack_webapi_rate_limited_error') return 'Slack is rate limiting requests. Wait a moment and retry.';
  if (code === 'missing_scope') return 'Slack permissions are missing. Ask the app administrator to reinstall using the supplied manifest.';
  if (code === 'invalid_auth' || code === 'token_revoked') return 'The Slack app connection needs administrator attention.';
  if (['Record unavailable', 'HR access required', 'This check changed. Close and resume from Home.', 'This record changed. Close and reopen it.'].includes(error.message)) return error.message;
  return 'The operation could not finish. Close and reopen from Home to check saved state, then retry. If this continues, contact the app administrator.';
};

export function registerHandlers(app, { store, team, hrs, retentionDays = 0, reportDelivery = deliverReport, logger = console }) {
  const owner = u => `${team}:${u}`;
  const isHR = u => hrs.includes(u);
  const hrRequired = u => { if (!isHR(u)) throw Error('HR access required'); };
  const visiblePolicies = async () => await policies();
  const own = async (id, u) => await store.get(id, owner(u), 'check');
  const policies = async () => await store.list('policy', team);
  const audit = async (actor, action, targetKind, targetId, details) => await store.audit({ team, actor, action, targetKind, targetId, details });
  const governance = async () => v.governanceCenter({ audits: await store.listAudit(team, 20), checks: (await store.list('check')).filter(r => String(r.id)).length,
    submissions: (await store.list('submission', team)).length, policies: (await policies()).length, reviewers: hrs.length, retentionDays });
  const save = async (r, u) => await store.save('check', owner(u), { ...r, revision: (r.revision || 0) + 1 });
  const open = (client, body, view) => client.views.open({ trigger_id: body.trigger_id, view });
  const update = (client, body, view) => client.views.update({ view_id: body.view.id, hash: body.view.hash, view });
  const publish = async (client, u) => client.views.publish({ user_id: u, view: v.home(await store.list('check', owner(u)), await policies(), isHR(u)) });
  const checked = async (view, u) => {
    const m = metadata(view), r = await own(m.id, u);
    if (r.revision !== m.revision) throw Error('This check changed. Close and resume from Home.');
    return r;
  };
  const getSubmission = async (id, user) => {
    const r = await store.get(id, team, 'submission');
    if (r.submittedBy !== user) throw Error('Record unavailable');
    return r;
  };
  // Logs deliberately contain no request bodies, token values, record IDs or employee content.
  const logFailure = (route, error) => logger.error(JSON.stringify({ event: 'pac_operation_failed', route,
    type: error?.name || 'Error', code: error?.code || error?.data?.error || 'unknown' }));
  const registrations = { command: [], event: [], action: [], view: [] };
  function register(kind, id, handler) {
    registrations[kind].push(id);
    app[kind](id, async args => {
      let acknowledged = false;
      const ack = async payload => { if (acknowledged) return; await args.ack(payload); acknowledged = true; };
      try {
        const t = args.body.team_id || args.body.team?.id || args.body.event?.team;
        if (t !== team) { if (args.ack) await ack(); return; }
        await handler({ ...args, ack });
      } catch (error) {
        logFailure(String(id), error);
        const text = errorText(error);
        try {
          if (!acknowledged && kind === 'view') await ack({ response_action: 'update', view: v.notice(text) });
          else {
            if (!acknowledged && args.ack) await ack();
            // Never update a Home view using views.update: Home views use views.publish.
            if (args.body.view?.type === 'modal') await update(args.client, args.body, v.notice(text));
            else if (args.body.trigger_id) await open(args.client, args.body, v.notice(text));
            else if (args.event?.user) await args.client.views.publish({ user_id: args.event.user,
              view: { type: 'home', blocks: [v.section(text), v.actions(v.button('Refresh', 'home_page', '0'))] } });
          }
        } catch { logFailure('error feedback unavailable'); }
      }
    });
  }
  // Unexpected Bolt/transport errors are still redacted.
  app.error(async () => logFailure('Slack transport'));
  register('command', '/people-check', async ({ ack, body, client }) => { await ack(); await open(client, body, v.picker()); });
  register('event', 'app_home_opened', async ({ event, client }) => { if (event.tab === 'home') await publish(client, event.user); });
  register('action', 'new', async ({ ack, body, client }) => { await ack(); await open(client, body, v.picker()); });
  register('action', 'refresh_home', async ({ ack, body, client }) => { await ack(); await publish(client, body.user.id); });
  register('action', 'my_history', async ({ ack, body, client }) => { await ack(); await open(client, body, v.history(await store.list('check', owner(body.user.id)))); });
  register('action', /^history_page(?:_nav\d+)?$/, async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.history(await store.list('check', owner(body.user.id)), Number(action.value))); });
  register('action', 'clear_history', async ({ ack, body, client }) => { await ack(); const count = (await store.list('check', owner(body.user.id))).length; await open(client, body, v.clearHistoryForm(count)); });
  register('action', 'governance', async ({ ack, body, client }) => { await ack(); hrRequired(body.user.id); const view = await governance(); await (body.view?.type === 'modal' ? update(client, body, view) : open(client, body, view)); });
  register('action', /^home_page(?:_nav\d+)?$/, async ({ ack, body, client }) => { await ack(); await publish(client, body.user.id); });
  register('action', 'open', async ({ ack, body, action, client }) => {
    await ack(); const r = await own(action.value, body.user.id);
    const view = completed(r) ? v.result(r) : v.wizard(r, await visiblePolicies(body.user.id));
    await (body.view?.type === 'modal' ? update(client, body, view) : open(client, body, view));
  });
  register('view', 'pick', async ({ ack, view, body, client }) => {
    const f = values(view), errors = {};
    if (!Array.isArray(f.scenarios) || !f.scenarios.length || f.scenarios.length > 10 || new Set(f.scenarios).size !== f.scenarios.length || f.scenarios.some(n => !v.names.includes(n))) errors.scenarios = 'Choose one or more valid situations.';
    if (!validText(f.employee, 150)) errors.employee = 'Use 150 characters or fewer.';
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    const r = await save({ scenarios: f.scenarios, employee: f.employee, scoringVersion: 2, answers: Array(f.scenarios.length * 5).fill(null), notes: Array(f.scenarios.length * 5).fill(''), stage: 'context', page: 0 }, body.user.id);
    await ack({ response_action: 'update', view: v.wizard(r) }); await publish(client, body.user.id);
  });
  register('view', 'context', async ({ ack, view, body }) => {
    let r = await checked(view, body.user.id);
    if (r.stage !== 'context') throw Error('This check changed. Close and resume from Home.');
    if (r.page < r.scenarios.length - 1) r.page++; else { r.page = 0; r.stage = 'questions'; }
    r = await save(r, body.user.id); await ack({ response_action: 'update', view: v.wizard(r, await visiblePolicies(body.user.id)) });
  });
  register('view', 'answers', async ({ ack, view, body, client }) => {
    let r = await checked(view, body.user.id);
    if (r.stage !== 'questions') throw Error('This check changed. Close and resume from Home.');
    const f = values(view), navKey = `nav_${r.page}_${r.revision}`, nav = f[navKey], errors = {};
    if (!['next', 'save', ...(r.page ? ['back'] : [])].includes(nav)) errors[navKey] = 'Choose where to go after saving.';
    for (let i = r.page * 5; i < r.page * 5 + 5; i++) {
      const answerKey = `q${i}_${r.revision}`, noteKey = `n${i}_${r.revision}`, answer = f[answerKey];
      if (answer && !['yes', 'no', 'unknown'].includes(answer)) errors[answerKey] = 'Choose a valid answer.';
      else if (!answer && nav === 'next') errors[answerKey] = 'Answer before continuing, or choose Save and close.';
      else r.answers[i] = answer || null;
      if (!validText(f[noteKey] ?? '', 1500)) errors[noteKey] = 'Use 1,500 characters or fewer.';
      else r.notes[i] = f[noteKey] || '';
    }
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    if (nav === 'back') r.page--;
    else if (nav === 'next') {
      if (r.page < r.scenarios.length - 1) r.page++;
      else if (!r.answers.every(Boolean)) r.page = Math.floor(r.answers.findIndex(x => !x) / 5);
      else { r.stage = 'done'; r.scoringVersion = 2; r.completedAt = new Date().toISOString(); }
    }
    r = await save(r, body.user.id);
    await ack(nav === 'save' ? { response_action: 'clear' } : { response_action: 'update', view: completed(r) ? v.result(r) : v.wizard(r, await visiblePolicies(body.user.id)) });
    await publish(client, body.user.id);
  });
  register('action', /^result_page_\d+$/, async ({ ack, body, action, client }) => {
    await ack(); const m = JSON.parse(action.value);
    if (m.hr) hrRequired(body.user.id);
    const r = m.hr ? await store.get(m.id, team, 'submission') : await own(m.id, body.user.id);
    if (!completed(r)) throw Error('This check changed. Close and resume from Home.');
    // Slack preserves same-ID input values on update; also retain the original revision
    // so paging cannot accidentally turn a stale review into a current edit.
    const reviewMeta = metadata(body.view);
    const next = v.result(r, m.page, Boolean(m.hr));
    if (m.hr) next.private_metadata = JSON.stringify({ id: r.id, revision: reviewMeta.revision });
    await update(client, body, next);
  });
  register('action', 'edit', async ({ ack, body, action, client }) => {
    await ack(); const r = await save({ ...await own(action.value, body.user.id), stage: 'questions', page: 0 }, body.user.id);
    await update(client, body, v.wizard(r, await visiblePolicies(body.user.id))); await publish(client, body.user.id);
  });
  register('action', 'rerun', async ({ ack, body, action, client }) => {
    await ack(); const old = await own(action.value, body.user.id);
    const r = await save({ scenarios: old.scenarios, employee: old.employee, scoringVersion: 2, answers: old.answers.map(() => null), notes: old.notes.map(() => ''), stage: 'context', page: 0 }, body.user.id);
    await update(client, body, v.wizard(r)); await publish(client, body.user.id);
  });
  register('action', 'attachments', async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.supportingForm(await own(action.value, body.user.id))); });
  register('action', 'clear_evidence_form', async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.supportingForm(await own(action.value, body.user.id), { clear: true })); });
  register('action', 'clear_answers', async ({ ack, body, action, client }) => {
    await ack(); const r = await own(action.value, body.user.id);
    if (r.stage !== 'questions') throw Error('This check changed. Close and resume from Home.');
    const cleared = { ...r, answers: [...r.answers], notes: [...r.notes] };
    for (let i = r.page * 5; i < r.page * 5 + 5; i++) { cleared.answers[i] = null; cleared.notes[i] = ''; }
    const saved = await save(cleared, body.user.id);
    await update(client, body, v.wizard(saved, await visiblePolicies(body.user.id))); await publish(client, body.user.id);
  });
  register('view', 'attachments_save', async ({ ack, body, view, client }) => {
    const r = await checked(view, body.user.id), f = values(view);
    if (!validText(f.links, 3000)) return ack({ response_action: 'errors', errors: { links: 'Use 3,000 characters or fewer.' } });
    const uploaded = Array.isArray(f.files) ? f.files.slice(0, 5).map(file => ({ id: file.id, name: file.name, title: file.title, mimetype: file.mimetype, permalink: file.permalink })) : [];
    const evidenceFiles = [...(r.evidenceFiles || []), ...uploaded].filter((file, index, all) => file.id && all.findIndex(x => x.id === file.id) === index).slice(0, 20);
    const saved = await save({ ...r, attachments: f.links, evidenceFiles }, body.user.id);
    await audit(body.user.id, 'evidence.updated', 'check', saved.id, { fileCount: evidenceFiles.length, hasContext: Boolean(f.links) });
    await ack({ response_action: 'update', view: v.result(saved) }); await publish(client, body.user.id);
  });
  register('action', 'export', async ({ ack, body, action, client }) => {
    await ack(); const r = await own(action.value, body.user.id);
    if (!completed(r)) throw Error('This check changed. Close and resume from Home.');
    await reportDelivery(client, body.user.id, r);
    await audit(body.user.id, 'report.exported', 'check', r.id, { destination: 'private_dm' });
    await update(client, body, v.notice('Your Word report was sent to your private app DM.'));
  });
  register('action', 'share', async ({ ack, body, action, client }) => {
    await ack(); const r = await own(action.value, body.user.id);
    if (!completed(r)) throw Error('This check changed. Close and resume from Home.');
    await update(client, body, v.shareForm(r, hrs));
  });

  const deliveriesInFlight = new Set();
  async function sendPending(id, client) {
    if (deliveriesInFlight.has(id)) return;
    deliveriesInFlight.add(id);
    try {
      const initial = await store.get(id, team, 'submission');
      for (const [user, item] of Object.entries(initial.delivery || {})) {
        if (item.status === 'sent') continue;
        let s = await store.get(id, team, 'submission');
        s.delivery[user] = { ...item, status: 'sending' }; await store.save('submission', team, s);
        let outcome;
        try {
          if (item.report) await reportDelivery(client, user, s);
          else {
            const dm = await client.conversations.open({ users: user });
            await client.chat.postMessage({ channel: dm.channel.id, ...v.hrMessage(s) });
          }
          outcome = { ...item, status: 'sent', error: undefined };
        } catch (error) { outcome = { ...item, status: 'failed', error: errorText(error) }; logFailure('delivery'); }
        // Re-read so an HR review arriving during network I/O is not overwritten.
        s = await store.get(id, team, 'submission'); s.delivery[user] = outcome; await store.save('submission', team, s);
      }
    } finally { deliveriesInFlight.delete(id); }
  }
  async function showDelivery(client, body, id) {
    // No stale hash after response_action:update. A closed modal is harmless: status
    // persists and remains reachable through the personal assessment.
    try { await client.views.update({ view_id: body.view.id, view: v.deliveryView(await store.get(id, team, 'submission')) }); }
    catch { logFailure('delivery status display'); }
  }
  register('view', 'share_confirm', async ({ ack, body, view, client }) => {
    const u = body.user.id, r = await checked(view, u);
    if (!completed(r)) throw Error('This check changed. Close and resume from Home.');
    const id = `${r.id}-submission-${r.revision}`;
    let snapshot;
    try { snapshot = await store.get(id, team, 'submission'); } catch (error) {
      if (error.message !== 'Record unavailable') throw error;
      snapshot = await store.save('submission', team, { ...r, id, checkId: r.id, submittedBy: u, submittedAt: new Date().toISOString(), reviewStatus: 'New', reviewRevision: 0,
        delivery: Object.fromEntries([...new Set([u, ...hrs])].map(user => [user, { status: 'pending', report: user === u }])) });
      await audit(u, 'submission.created', 'submission', id, { reviewerCount: hrs.length, riskLevel: v.score(r).level });
    }
    await ack({ response_action: 'update', view: v.deliveryView(snapshot) });
    await sendPending(id, client); await showDelivery(client, body, id);
  });
  register('action', 'submission_status', async ({ ack, body, action, client }) => {
    await ack(); await own(action.value, body.user.id);
    const s = (await store.list('submission', team)).find(s => s.submittedBy === body.user.id && (s.checkId === action.value || s.id.startsWith(action.value + '-submission-')));
    await update(client, body, s ? v.deliveryView(s) : v.notice('This check has not been submitted to HR.'));
  });
  register('action', 'delivery_status', async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.deliveryView(await getSubmission(action.value, body.user.id))); });
  register('action', 'retry_delivery', async ({ ack, body, action, client }) => {
    await ack(); await getSubmission(action.value, body.user.id);
    await sendPending(action.value, client); await showDelivery(client, body, action.value);
  });
  register('action', 'followup', async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.followupForm(await own(action.value, body.user.id))); });
  register('view', 'followup_save', async ({ ack, body, view, client }) => {
    const date = values(view).date;
    if (!validText(date, 10) || (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date))) return ack({ response_action: 'errors', errors: { date: 'Enter a valid date as YYYY-MM-DD.' } });
    const r = await checked(view, body.user.id); await save({ ...r, followup: date }, body.user.id);
    await ack({ response_action: 'clear' }); await publish(client, body.user.id);
  });
  register('action', 'inbox', async ({ ack, body, client }) => { await ack(); hrRequired(body.user.id); await open(client, body, v.inbox(await store.list('submission', team))); });
  register('action', /^inbox_page(?:_nav\d+)?$/, async ({ ack, body, action, client }) => { await ack(); hrRequired(body.user.id); await update(client, body, v.inbox(await store.list('submission', team), Number(action.value))); });
  register('action', 'review', async ({ ack, body, action, client }) => {
    await ack(); hrRequired(body.user.id); const view = v.result(await store.get(action.value, team, 'submission'), 0, true);
    await (body.view?.type === 'modal' ? update(client, body, view) : open(client, body, view));
  });
  register('view', 'result', async ({ ack, body, view, client }) => {
    hrRequired(body.user.id); const m = metadata(view), r = await store.get(m.id, team, 'submission'), f = values(view);
    if ((r.reviewRevision || 0) !== m.revision) throw Error('This record changed. Close and reopen it.');
    const errors = {};
    if (!['New', 'In review', 'Closed'].includes(f.status)) errors.status = 'Choose a review status.';
    if (!validText(f.reviewNote, 1500)) errors.reviewNote = 'Use 1,500 characters or fewer.';
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    const uploaded = Array.isArray(f.hrFiles) ? f.hrFiles.slice(0, 5).map(file => ({ id: file.id, name: file.name, title: file.title, mimetype: file.mimetype, permalink: file.permalink, addedBy: body.user.id })) : [];
    const hrEvidenceFiles = [...(r.hrEvidenceFiles || []), ...uploaded].filter((file, index, all) => file.id && all.findIndex(x => x.id === file.id) === index).slice(0, 20);
    const saved = await store.save('submission', team, { ...r, reviewStatus: f.status, reviewNote: f.reviewNote, hrEvidenceFiles, reviewRevision: (r.reviewRevision || 0) + 1, reviewedBy: body.user.id, reviewedAt: new Date().toISOString() });
    await audit(body.user.id, 'review.updated', 'submission', r.id, { status: f.status, fileCount: hrEvidenceFiles.length, hasNote: Boolean(f.reviewNote) });
    await ack({ response_action: 'clear' });
    try {
      const dm = await client.conversations.open({ users: saved.submittedBy });
      await client.chat.postMessage({ channel: dm.channel.id, ...v.managerReviewMessage(saved) });
      await audit(body.user.id, 'review.notification.sent', 'submission', r.id, { recipient: saved.submittedBy, status: f.status });
    } catch { logFailure('review notification'); await audit(body.user.id, 'review.notification.failed', 'submission', r.id, { recipient: saved.submittedBy, status: f.status }); }
  });
  register('action', 'policies', async ({ ack, body, client }) => {
    await ack(); const view = v.policyList(await policies(), isHR(body.user.id));
    if (body.view?.type === 'modal') await client.views.push({ trigger_id: body.trigger_id, view });
    else await open(client, body, view);
  });
  register('action', /^policy_page(?:_nav\d+)?$/, async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.policyList(await policies(), isHR(body.user.id), Number(action.value))); });
  register('action', 'read_policy', async ({ ack, body, action, client }) => { await ack(); await update(client, body, v.policyRead(await store.get(action.value, team, 'policy'))); });
  register('action', 'add_policy', async ({ ack, body, client }) => { await ack(); hrRequired(body.user.id); await open(client, body, v.policyForm()); });
  register('action', 'edit_policy', async ({ ack, body, action, client }) => { await ack(); hrRequired(body.user.id); await update(client, body, v.policyForm(await store.get(action.value, team, 'policy'))); });
  register('view', 'policy_save', async ({ ack, body, view }) => {
    hrRequired(body.user.id); const f = values(view), m = metadata(view), errors = {};
    if (!validText(f.name, 150) || !f.name.trim()) errors.name = 'Enter a document name (up to 150 characters).';
    if (!validText(f.content, 3000) || !f.content.trim()) errors.content = 'Enter policy text or a URL (up to 3,000 characters).';
    if (!POLICY_CATEGORIES.some(c => c.id === f.category)) errors.category = 'Choose a valid category.';
    if (Object.keys(errors).length) return ack({ response_action: 'errors', errors });
    if (m.id && (await store.get(m.id, team, 'policy').revision || 0) !== m.revision) throw Error('This record changed. Close and reopen it.');
    const saved = await store.save('policy', team, { id: m.id, name: f.name, category: f.category, content: f.content, revision: (m.revision || 0) + 1 });
    await audit(body.user.id, m.id ? 'policy.updated' : 'policy.created', 'policy', saved.id, { category: f.category });
    await ack({ response_action: 'update', view: v.policyList(await policies(), true) });
  });
  for (const type of ['check', 'policy']) register('action', 'delete_' + type, async ({ ack, body, action, client }) => {
    await ack(); if (type === 'policy') hrRequired(body.user.id);
    await store.get(action.value, type === 'policy' ? team : owner(body.user.id), type);
    await update(client, body, v.deleteForm(action.value, type));
  });
  register('view', 'delete_confirm', async ({ ack, body, view, client }) => {
    const m = metadata(view); if (!['check', 'policy'].includes(m.type)) throw Error('Record unavailable');
    if (m.type === 'policy') hrRequired(body.user.id);
    await store.delete(m.id, m.type === 'policy' ? team : owner(body.user.id), m.type);
    await audit(body.user.id, `${m.type}.deleted`, m.type, m.id);
    // Pop only the policy overlay, leaving any underlying assessment intact.
    await ack(m.type === 'policy' ? { response_action: 'update', view: v.policyList(await policies(), true) } : { response_action: 'clear' });
    await publish(client, body.user.id);
  });
  register('view', 'clear_history_confirm', async ({ ack, body, client }) => {
    const removed = await store.deleteAll('check', owner(body.user.id));
    await audit(body.user.id, 'history.cleared', 'check', body.user.id, { removed });
    await ack({ response_action: 'clear' }); await publish(client, body.user.id);
  });
  return { registrations };
}
