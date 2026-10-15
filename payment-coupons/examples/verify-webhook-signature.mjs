import { createHmac, timingSafeEqual } from 'node:crypto';

// Usa los bytes originales del body y los headers normalizados de Node.js.
// Esta función verifica autenticidad; el receptor valida y persiste el evento.
export function verify360StudioWebhook(rawBody, headers, signingSecret, now = Date.now()) {
  if ((!Buffer.isBuffer(rawBody) && typeof rawBody !== 'string') ||
      typeof signingSecret !== 'string' || !signingSecret || !Number.isFinite(now)) return false;
  const timestamp = headers?.['x-360studio-timestamp'];
  const signature = headers?.['x-360studio-signature'];
  if (typeof timestamp !== 'string' || typeof signature !== 'string' ||
      !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const signedAt = Date.parse(timestamp);
  if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > 5 * 60 * 1000) return false;
  const expected = createHmac('sha256', signingSecret)
    .update(`${timestamp}.`, 'utf8')
    .update(rawBody)
    .digest();
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), expected);
}
