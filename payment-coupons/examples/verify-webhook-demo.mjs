import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { verify360StudioWebhook } from './verify-webhook-signature.mjs';

// Demostración local: este secreto es ficticio y no habilita acceso a un hook.
const signingSecret = 'synthetic_webhook_fixture_not_a_real_secret';
const rawBody = await readFile(new URL('./payment-paid.webhook.json', import.meta.url));
const timestamp = new Date().toISOString();
const headers = {
  'x-360studio-timestamp': timestamp,
  'x-360studio-signature': 'sha256=' + createHmac('sha256', signingSecret)
    .update(`${timestamp}.`, 'utf8').update(rawBody).digest('hex')
};
const originalVerified = verify360StudioWebhook(rawBody, headers, signingSecret);
const alteredBody = Buffer.from(rawBody.toString('utf8').replace('10.5', '11.5'));
const alteredRejected = !verify360StudioWebhook(alteredBody, headers, signingSecret);
assert.equal(originalVerified, true);
assert.equal(alteredRejected, true);
console.log(JSON.stringify({ original_verified: originalVerified, altered_rejected: alteredRejected }, null, 2));
