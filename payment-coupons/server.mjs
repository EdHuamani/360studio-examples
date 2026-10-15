import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_BASE = 'https://sandbox.api.360studio.app/v1';
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
const isId = (value) => /^[a-f0-9]{24}$/i.test(value);
const fail = (status, message) => Object.assign(new Error(message), { status });

export function configuration(env = process.env) {
  const config = {
    apiKey: (env.STUDIO_API_KEY ?? '').trim(),
    workspaceId: (env.STUDIO_WORKSPACE_ID ?? '').trim(),
    paymentPrefix: (env.STUDIO_PAYMENT_PREFIX ?? '').trim().toUpperCase(),
    port: Number(env.PORT ?? 3000),
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT debe ser un puerto válido.');
  }
  if (config.apiKey && !config.apiKey.startsWith('pk_test_')) {
    throw new Error('Este ejemplo admite únicamente credenciales pk_test_ de sandbox.');
  }
  if (config.workspaceId && !isId(config.workspaceId)) {
    throw new Error('STUDIO_WORKSPACE_ID debe ser un ObjectId de 24 caracteres.');
  }
  if (config.paymentPrefix && !/^[A-Z0-9]{1,13}$/.test(config.paymentPrefix)) {
    throw new Error('STUDIO_PAYMENT_PREFIX debe ser un prefijo alfanumérico válido.');
  }
  return config;
}

const missingConfiguration = (config) => [
  ['STUDIO_API_KEY', config.apiKey],
  ['STUDIO_WORKSPACE_ID', config.workspaceId],
  ['STUDIO_PAYMENT_PREFIX', config.paymentPrefix],
].filter(([, value]) => !value).map(([name]) => name);

async function readJson(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw fail(415, 'Envía Content-Type: application/json.');
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16_384) throw fail(413, 'La solicitud supera 16 KiB.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw fail(400, 'El cuerpo debe ser un objeto JSON válido.'); }
}

function couponInput(body, prefix) {
  const allowed = ['customer_name', 'payment_coupon_code', 'amount', 'currency', 'external_ref', 'description', 'expiry_date'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) {
    throw fail(400, 'Este ejemplo acepta solo los campos documentados del cupón.');
  }
  const text = (name, max) => {
    const value = typeof body[name] === 'string' ? body[name].trim() : '';
    if (!value || value.length > max) throw fail(400, `${name} es obligatorio y admite hasta ${max} caracteres.`);
    return value;
  };
  const code = text('payment_coupon_code', 14).toUpperCase();
  if (!/^[A-Z0-9]+$/.test(code) || !code.startsWith(prefix)) {
    throw fail(400, 'payment_coupon_code debe ser alfanumérico y comenzar con el prefijo del negocio.');
  }
  const amount = body.amount;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    throw fail(400, 'amount debe ser positivo, en PEN y con hasta dos decimales.');
  }
  if (body.currency !== undefined && body.currency !== 'PEN') throw fail(400, 'La moneda admitida es PEN.');
  const expiry = text('expiry_date', 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(expiry) || Number.isNaN(Date.parse(expiry))) {
    throw fail(400, 'expiry_date debe ser una fecha ISO 8601 con zona horaria.');
  }
  return {
    customer_name: text('customer_name', 200), payment_coupon_code: code,
    amount, currency: 'PEN', external_ref: text('external_ref', 160),
    description: text('description', 500), expiry_date: expiry,
  };
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export function createApp(config, upstreamFetch = fetch) {
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host ?? '';
      if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw fail(403, 'Usa este ejemplo desde localhost.');
      if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') {
        throw fail(403, 'No se permiten solicitudes desde otro origen.');
      }
      const url = new URL(req.url, `http://${host}`);
      if (url.search) throw fail(400, 'Esta ruta no acepta parámetros adicionales.');
      if (req.method === 'GET' && files.has(url.pathname)) {
        const [name, type] = files.get(url.pathname);
        const content = await readFile(new URL(`./public/${name}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': type }); res.end(content); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/config') {
        const missing = missingConfiguration(config);
        json(res, 200, { api_base_url: API_BASE, configured: missing.length === 0, missing,
          workspace_id: config.workspaceId, payment_prefix: config.paymentPrefix }); return;
      }
      const create = req.method === 'POST' && url.pathname === '/api/coupons';
      const detail = req.method === 'GET' && /^\/api\/coupons\/[a-f0-9]{24}$/i.test(url.pathname);
      if (!create && !detail) throw fail(404, 'Ruta no encontrada.');
      if (missingConfiguration(config).length) throw fail(503, 'Completa la configuración de sandbox en .env y reinicia el servidor.');
      const body = create ? couponInput(await readJson(req), config.paymentPrefix) : undefined;
      let upstream;
      try {
        upstream = await upstreamFetch(`${API_BASE}/payment-coupons${detail ? `/${url.pathname.split('/').pop()}` : ''}`, {
          method: create ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { Accept: 'application/json', Authorization: `Bearer ${config.apiKey}`,
            'x-workspace-id': config.workspaceId, ...(create ? { 'Content-Type': 'application/json' } : {}) },
          ...(create ? { body: JSON.stringify(body) } : {}),
        });
      } catch { throw fail(502, 'No se recibió respuesta de sandbox. Si estabas creando, reintenta con el mismo external_ref y los mismos datos.'); }
      let raw;
      try { raw = await upstream.text(); }
      catch { throw fail(502, 'Se interrumpió la respuesta de sandbox. Si estabas creando, reintenta con el mismo external_ref y los mismos datos.'); }
      let payload;
      try { payload = JSON.parse(raw); } catch { throw fail(502, `Sandbox respondió HTTP ${upstream.status} sin JSON válido.`); }
      // Redacción defensiva: la credencial nunca debe llegar a la respuesta local.
      const sanitized = JSON.parse(JSON.stringify(payload).split(config.apiKey).join('[REDACTED]'));
      if (upstream.ok && (sanitized?.success !== true || !sanitized.data)) {
        throw fail(502, 'Sandbox devolvió una respuesta de cupón inesperada.');
      }
      json(res, upstream.status, sanitized);
    } catch (error) {
      json(res, error.status ?? 500, { success: false, error: error.status ? error.message : 'No se pudo procesar la solicitud.' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = configuration();
    const server = createApp(config);
    server.on('error', (error) => {
      console.error(error.code === 'EADDRINUSE' ? 'El puerto está ocupado. Cambia PORT en .env.' : `No se pudo iniciar el servidor (${error.code ?? 'error'}).`);
      process.exitCode = 1;
    });
    server.listen(config.port, '127.0.0.1', () => {
      console.log(`360Pay · ejemplo sandbox: http://localhost:${config.port}`);
      if (missingConfiguration(config).length) console.log('Completa .env para habilitar la creación de cupones.');
    });
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
