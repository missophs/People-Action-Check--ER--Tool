const encoder = new TextEncoder();
function fixedTimeEqual(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
function hexBytes(value) { return /^[0-9a-f]{64}$/i.test(value) ? Uint8Array.from(value.match(/../g), x => parseInt(x, 16)) : null; }
export async function verifySlackRequest(request, rawBody, secret, now = Date.now()) {
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');
  if (!/^\d+$/.test(timestamp || '') || !signature?.startsWith('v0=') || Math.abs(now - Number(timestamp) * 1000) > 300000) return false;
  const received = hexBytes(signature.slice(3)); if (!received) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`v0:${timestamp}:${rawBody}`)));
  return fixedTimeEqual(signed, received);
}
function parseBody(request, raw) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return JSON.parse(raw);
  if (type.includes('application/x-www-form-urlencoded')) { const fields = Object.fromEntries(new URLSearchParams(raw)); return fields.payload ? JSON.parse(fields.payload) : fields; }
  throw Error('Unsupported content type');
}
function response(value) { if (value == null) return new Response('', { status: 200 }); if (typeof value === 'string') return new Response(value); return Response.json(value); }
export async function handleSlackHttp(request, app, secret, context) {
  const path = new URL(request.url).pathname;
  if (path === '/health' && request.method === 'GET') return new Response('ok');
  if (path !== '/slack/events' || request.method !== 'POST') return new Response('Not found', { status: 404 });
  const declared = Number(request.headers.get('content-length')); if (Number.isFinite(declared) && declared > 1048576) return new Response('Payload too large', { status: 413 });
  const raw = await request.text(); if (encoder.encode(raw).length > 1048576) return new Response('Payload too large', { status: 413 });
  if (!secret || !(await verifySlackRequest(request, raw, secret))) return new Response('Unauthorized', { status: 401 });
  let body; try { body = parseBody(request, raw); } catch { return new Response('Bad request', { status: 400 }); }
  if (body.ssl_check === '1') return new Response('ok');
  if (body.type === 'url_verification') return new Response(body.challenge || '');
  let resolveAck, acknowledged = false;
  const ackResponse = new Promise(resolve => { resolveAck = resolve; });
  const ack = value => { if (acknowledged) throw Error('Request already acknowledged'); acknowledged = true; resolveAck(response(value)); };
  const work = Promise.resolve().then(() => app.processEvent({ body, ack, retryNum: Number(request.headers.get('x-slack-retry-num')) || undefined, customProperties: {} }))
    .then(() => { if (!acknowledged) resolveAck(new Response('No acknowledgement', { status: 500 })); })
    .catch(error => { console.error(JSON.stringify({ event: 'pac_http_error', type: error?.name || 'Error' })); if (!acknowledged) resolveAck(new Response('Request failed', { status: 500 })); });
  context.waitUntil(work);
  if (body.type === 'event_callback') return new Response('');
  let timer; try { return await Promise.race([ackResponse, new Promise(resolve => { timer = setTimeout(() => resolve(new Response('Timed out', { status: 503 })), 2700); })]); } finally { clearTimeout(timer); }
}
