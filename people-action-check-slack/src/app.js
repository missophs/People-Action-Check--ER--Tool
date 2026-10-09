import bolt from '@slack/bolt';
import { readConfig, verifyWorkspace } from './config.js';
import { Store } from './store.js';
import { registerHandlers } from './handlers.js';
const config = readConfig();
const app = new bolt.App({ token: config.token, appToken: config.appToken, socketMode: true,
  clientOptions: { timeout: 10000, retryConfig: { retries: 2 } } });
await verifyWorkspace(app.client, config.team);
const store = new Store(config.dataPath);
const purged = store.purgeExpired(config.retentionDays);
if (purged) store.audit({ team: config.team, actor: 'SYSTEM', action: 'retention.purge', targetKind: 'system', targetId: config.team, details: { removed: purged, retentionDays: config.retentionDays } });
registerHandlers(app, { store, team: config.team, hrs: config.hrs, retentionDays: config.retentionDays });
await app.start();
console.log('People Action Check connected via Socket Mode.');
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  await app.stop(); store.close(); process.exit(0);
});
