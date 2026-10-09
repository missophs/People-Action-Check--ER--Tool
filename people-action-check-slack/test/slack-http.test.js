import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleSlackHttp } from '../src/slack-http.js';
const secret = 'test-secret';
function request(body, { signed = true, age = 0 } = {}) {
  const raw = JSON.stringify(body), timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = signed ? 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:${raw}`).digest('hex') : 'v0=bad';
  return new Request('https://example.workers.dev/slack/events', { method: 'POST', body: raw,
    headers: { 'content-type': 'application/json', 'x-slack-request-timestamp': timestamp, 'x-slack-signature': signature } });
}
test('Worker rejects forged and stale Slack requests', async () => {
  assert.equal((await handleSlackHttp(request({}, { signed: false }), {}, secret, { waitUntil() {} })).status, 401);
  assert.equal((await handleSlackHttp(request({}, { age: 600 }), {}, secret, { waitUntil() {} })).status, 401);
});
test('Worker verifies URLs and acknowledges events before background work', async () => {
  const challenge = await handleSlackHttp(request({ type: 'url_verification', challenge: 'verified' }), {}, secret, { waitUntil() {} });
  assert.equal(await challenge.text(), 'verified');
  let work, processed = false;
  const response = await handleSlackHttp(request({ type: 'event_callback', event: { type: 'app_home_opened' } }),
    { async processEvent() { processed = true; } }, secret, { waitUntil(value) { work = value; } });
  assert.equal(response.status, 200); await work; assert.equal(processed, true);
});
