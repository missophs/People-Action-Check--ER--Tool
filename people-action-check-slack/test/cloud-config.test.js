import test from 'node:test';
import assert from 'node:assert/strict';
import { readCloudConfig } from '../src/cloud-config.js';
const env = { SLACK_BOT_TOKEN: 'xoxb-test', SLACK_SIGNING_SECRET: 'test-secret', SLACK_TEAM_ID: 'TTEST', HR_USER_IDS: 'UONE,UTWO,UONE', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' };
test('cloud configuration preserves reviewer limits and validates retention before scheduled deletion', () => {
  assert.deepEqual(readCloudConfig(env), { hrs: ['UONE', 'UTWO'], retentionDays: 0 });
  for (const value of ['-1', '1.5', 'NaN', '3651']) assert.throws(() => readCloudConfig({ ...env, RETENTION_DAYS: value }));
  for (const value of ['0', '1', '3650']) assert.equal(readCloudConfig({ ...env, RETENTION_DAYS: value }).retentionDays, Number(value));
  assert.throws(() => readCloudConfig({ ...env, HR_USER_IDS: Array.from({ length: 21 }, (_, i) => `U${i}`).join(',') }));
  assert.throws(() => readCloudConfig({ ...env, HR_USER_IDS: ',' }));
  assert.throws(() => readCloudConfig({ ...env, SLACK_SIGNING_SECRET: '' }));
});
