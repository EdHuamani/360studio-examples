import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verify360StudioWebhook } from '../examples/verify-webhook-signature.mjs';

const secret = 'synthetic_webhook_fixture_not_a_real_secret';
const timestamp = '2030-10-14T15:30:00.000Z';
const now = Date.parse(timestamp);
const rawBody = await readFile(new URL('../examples/payment-paid.webhook.json', import.meta.url));
function signedHeaders(body = rawBody, at = timestamp, key = secret) {
  return { 'x-360studio-timestamp': at, 'x-360studio-signature': 'sha256=' +
    createHmac('sha256', key).update(`${at}.`, 'utf8').update(body).digest('hex') };
}

test('acepta la firma contractual del body original, como Buffer o texto UTF-8', () => {
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(), secret, now), true);
  assert.equal(verify360StudioWebhook(rawBody.toString('utf8'), signedHeaders(), secret, now), true);
});

test('rechaza cambios del body y la reserialización de un JSON auténtico', () => {
  const changed = Buffer.from(rawBody.toString('utf8').replace('10.5', '11.5'));
  const compact = JSON.stringify(JSON.parse(rawBody.toString('utf8')));
  assert.equal(verify360StudioWebhook(changed, signedHeaders(), secret, now), false);
  assert.equal(verify360StudioWebhook(compact, signedHeaders(), secret, now), false);
});

test('rechaza un secreto distinto o una firma alterada', () => {
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(), 'otro_secreto_ficticio', now), false);
  const headers = signedHeaders();
  headers['x-360studio-signature'] = 'sha256=' + '0'.repeat(64);
  assert.equal(verify360StudioWebhook(rawBody, headers, secret, now), false);
});

test('rechaza timestamps expirados, futuros fuera de ventana e inválidos', () => {
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(), secret, now + 300001), false);
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(), secret, now - 300001), false);
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(rawBody, 'invalid'), secret, now), false);
});

test('rechaza headers ausentes o malformados sin lanzar errores', () => {
  for (const headers of [undefined, {}, { 'x-360studio-timestamp': timestamp },
    { 'x-360studio-timestamp': [timestamp], 'x-360studio-signature': signedHeaders()['x-360studio-signature'] },
    { 'x-360studio-timestamp': timestamp, 'x-360studio-signature': 'sha256=abc' },
    { 'x-360studio-timestamp': timestamp, 'x-360studio-signature': 'sha256=' + 'z'.repeat(64) }]) {
    assert.equal(verify360StudioWebhook(rawBody, headers, secret, now), false);
  }
  assert.equal(verify360StudioWebhook({}, signedHeaders(), secret, now), false);
  assert.equal(verify360StudioWebhook(rawBody, signedHeaders(), '', now), false);
});
