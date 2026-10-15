import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { createApp, configuration, API_BASE } from '../server.mjs';

const credentials = { STUDIO_API_KEY: 'pk_test_synthetic_fixture_not_a_real_key', STUDIO_WORKSPACE_ID: '507f1f77bcf86cd799439013', STUDIO_PAYMENT_PREFIX: 'DEMO' };
const coupon = { customer_name: 'Cliente Demo', payment_coupon_code: 'DEMO000042', amount: 10.5, currency: 'PEN', external_ref: 'DEMO-LOCAL-001', description: 'Cuota de demostración', expiry_date: '2030-10-31T23:59:59.000Z' };
const couponId = '507f1f77bcf86cd799439011';

async function listen(server, t) {
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((done) => server.close(done)); });
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (base, body = coupon, headers = {}) => fetch(`${base}/api/coupons`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
const withHost = (url, host) => new Promise((done, reject) => {
  const request = httpRequest(url, { headers: { Host: host } }, (response) => {
    response.resume(); response.on('end', () => done(response.statusCode));
  });
  request.on('error', reject); request.end();
});

test('el servidor sin credencial permite ver el ejemplo y no emite cupones', async (t) => {
  let called = false;
  const base = await listen(createApp(configuration({}), () => { called = true; }), t);
  assert.equal((await fetch(base)).status, 200);
  const config = await (await fetch(`${base}/api/config`)).json();
  assert.equal(config.configured, false); assert.ok(!('apiKey' in config));
  assert.equal((await post(base)).status, 503); assert.equal(called, false);
});

test('crear, repetir y consultar conservan el contrato HTTP, la referencia y los headers de autenticación', async (t) => {
  const received = [];
  const upstream = await listen(createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    received.push({ method: req.method, path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined });
    const data = { id: couponId, ...coupon, status: req.method === 'GET' ? 'paid' : 'active',
      payment_url: 'https://360pay-site.web.app/p/synthetic_coupon_token_00042', bank_deeplinks: { scotiabank: null } };
    res.writeHead(req.method === 'GET' || received.length > 1 ? 200 : 201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data, meta: { idempotent_replay: received.length > 1 } }));
  }), t);
  const base = await listen(createApp(configuration(credentials), (url, init) => {
    assert.ok(url.startsWith(`${API_BASE}/payment-coupons`));
    return fetch(url.replace(API_BASE, upstream), init);
  }), t);
  assert.equal((await post(base)).status, 201);
  const replay = await post(base); assert.equal(replay.status, 200);
  assert.equal((await replay.json()).meta.idempotent_replay, true);
  const detail = await fetch(`${base}/api/coupons/${couponId}`);
  assert.equal((await detail.json()).data.status, 'paid');
  assert.deepEqual(received[0].body, received[1].body);
  assert.equal(received[0].headers.authorization, `Bearer ${credentials.STUDIO_API_KEY}`);
  assert.equal(received[0].headers['x-workspace-id'], credentials.STUDIO_WORKSPACE_ID);
  assert.equal(received[2].path, `/payment-coupons/${couponId}`);
  const exposed = await Promise.all(['/', '/app.js', '/api/config'].map(async (path) => (await fetch(base + path)).text()));
  assert.ok(exposed.every((text) => !text.includes(credentials.STUDIO_API_KEY)));
});

test('datos inválidos y campos de tenancy en el cuerpo se rechazan antes de llamar a sandbox', async (t) => {
  let calls = 0;
  const base = await listen(createApp(configuration(credentials), () => { calls += 1; }), t);
  for (const body of [{ ...coupon, amount: 0 }, { ...coupon, amount: 10.501 },
    { ...coupon, payment_coupon_code: 'OTRO001' }, { ...coupon, business_id: couponId }, { ...coupon, currency: 'USD' }]) {
    assert.equal((await post(base, body)).status, 400);
  }
  assert.equal(calls, 0);
});

test('otro origen, otro Host y rutas arbitrarias no pueden usar la credencial local', async (t) => {
  let calls = 0;
  const base = await listen(createApp(configuration(credentials), () => { calls += 1; }), t);
  assert.equal((await post(base, coupon, { Origin: 'https://otro.example' })).status, 403);
  assert.equal(await withHost(`${base}/api/config`, 'otro.example:3000'), 403);
  assert.equal((await fetch(`${base}/api/coupons/not-an-id`)).status, 404);
  assert.equal((await fetch(`${base}/api/config?target=otro`)).status, 400);
  assert.equal(calls, 0);
});

test('errores HTTP conservan su status y redactan una credencial reflejada por el upstream', async (t) => {
  const upstream = await listen(createServer((_req, res) => {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: `Too many requests ${credentials.STUDIO_API_KEY}` }));
  }), t);
  const base = await listen(createApp(configuration(credentials), (url, init) => fetch(url.replace(API_BASE, upstream), init)), t);
  const response = await post(base); assert.equal(response.status, 429);
  const body = await response.text(); assert.ok(!body.includes(credentials.STUDIO_API_KEY)); assert.match(body, /REDACTED/);
});

test('una respuesta no JSON produce un error útil sin exponer el cuerpo del upstream', async (t) => {
  const upstream = await listen(createServer((_req, res) => { res.writeHead(503); res.end('<html>upstream privado</html>'); }), t);
  const base = await listen(createApp(configuration(credentials), (url, init) => fetch(url.replace(API_BASE, upstream), init)), t);
  const response = await post(base); assert.equal(response.status, 502);
  const body = await response.text(); assert.match(body, /HTTP 503/); assert.ok(!body.includes('upstream privado'));
});
