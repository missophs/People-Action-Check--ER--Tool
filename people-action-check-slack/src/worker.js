import { readCloudConfig } from './cloud-config.js';
import bolt from '@slack/bolt';
import { CloudStore } from './cloud-store.js';
import { registerHandlers } from './handlers.js';
import { handleSlackHttp } from './slack-http.js';
import { slackFetchAdapter } from './fetch-adapter.js';

class WorkerReceiver { init(app) { this.app = app; } start() { return Promise.resolve(); } stop() { return Promise.resolve(); } }
let cached;

function application(env) {
  if (cached) return cached;
  const config = readCloudConfig(env), receiver = new WorkerReceiver();
  const app = new bolt.App({ token: env.SLACK_BOT_TOKEN, receiver, clientOptions: { adapter: slackFetchAdapter } });
  registerHandlers(app, { store: new CloudStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY), team: env.SLACK_TEAM_ID,
    hrs: config.hrs, retentionDays: config.retentionDays });
  cached = app;
  return app;
}
export default {
  async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (path === '/health') return new Response('ok');
    if (path === '/health/storage') {
      try { await new CloudStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY).list('policy', env.SLACK_TEAM_ID); return new Response('ok'); }
      catch (error) { console.error(JSON.stringify({ event: 'pac_storage_health_failed', type: error?.name || 'Error' })); return new Response('unavailable', { status: 503 }); }
    }
    try { return await handleSlackHttp(request, application(env), env.SLACK_SIGNING_SECRET, context); }
    catch (error) { console.error(JSON.stringify({ event: 'pac_worker_error', type: error?.name || 'Error' })); return new Response('Server unavailable', { status: 503 }); }
  },
  async scheduled(_event, env, context) {
    const config = readCloudConfig(env), store = new CloudStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    context.waitUntil(store.purgeExpired(config.retentionDays));
  }
};
