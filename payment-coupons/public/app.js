const form = document.querySelector('#coupon-form');
const createButton = document.querySelector('#create-button');
const feedback = document.querySelector('#feedback');
const bankNames = { yape: 'Yape', bcp: 'BCP', interbank: 'Interbank', bbva: 'BBVA', scotiabank: 'Scotiabank' };
const stateNames = { active: 'Activo', pending_confirmation: 'Por confirmar', paid: 'Pagado', voided: 'Anulado' };
let config;
let currentCoupon;
let busy = false;

function newReference() {
  form.elements.external_ref.value = `DEMO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
function payload() {
  return {
    customer_name: form.elements.customer_name.value.trim(),
    payment_coupon_code: form.elements.payment_coupon_code.value.trim().toUpperCase(),
    amount: Number(form.elements.amount.value), currency: 'PEN',
    external_ref: form.elements.external_ref.value.trim(),
    description: form.elements.description.value.trim(),
    expiry_date: `${form.elements.expiry_day.value}T23:59:59.000Z`,
  };
}
function updateRequest() {
  document.querySelector('#request-preview').textContent =
    `POST https://sandbox.api.360studio.app/v1/payment-coupons\nAuthorization: Bearer <API_KEY_SANDBOX>\nx-workspace-id: ${config?.workspace_id || '<WORKSPACE_ID>'}\nContent-Type: application/json\n\n${JSON.stringify(payload(), null, 2)}`;
}
function message(text, error = false) {
  feedback.textContent = text;
  feedback.classList.toggle('error', error);
}
function setBusy(value, action = 'create') {
  busy = value;
  createButton.disabled = value || !config?.configured;
  createButton.textContent = value && action === 'create' ? 'Creando cupón…' : 'Crear cupón en sandbox →';
  document.querySelector('#refresh-coupon').disabled = value;
  document.querySelector('#refresh-coupon').textContent = value && action === 'read' ? 'Consultando estado…' : 'Consultar estado del cupón';
  document.querySelector('#new-reference').disabled = value;
  for (const input of form.querySelectorAll('input')) input.disabled = value;
}
function paymentUrl(value, kind, bank) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const expected = kind === 'payment' ? /^\/p\/[A-Za-z0-9_-]{20,512}$/ : new RegExp(`^/l/[A-Za-z0-9_-]{20,512}/${bank}$`);
    return url.origin === 'https://360pay-site.web.app' && !url.username && !url.password && !url.search && !url.hash && expected.test(url.pathname) ? value : null;
  } catch { return null; }
}
function render(coupon) {
  currentCoupon = coupon;
  document.querySelector('#empty-state').hidden = true;
  document.querySelector('#coupon-result').hidden = false;
  document.querySelector('#result-amount').textContent = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(coupon.amount);
  document.querySelector('#result-status').textContent = stateNames[coupon.status] ?? coupon.status;
  document.querySelector('#result-code').textContent = coupon.payment_coupon_code ?? 'No disponible';
  document.querySelector('#copy-code').disabled = !coupon.payment_coupon_code;
  const publicLink = document.querySelector('#payment-link');
  const url = paymentUrl(coupon.payment_url, 'payment');
  publicLink.hidden = !url;
  if (url) publicLink.href = url; else publicLink.removeAttribute('href');
  let invalidLink = !url;
  const container = document.querySelector('#bank-links');
  container.replaceChildren();
  for (const [bank, name] of Object.entries(bankNames)) {
    const original = coupon.bank_deeplinks?.[bank];
    const destination = paymentUrl(original, 'bank', bank);
    if (original && !destination) invalidLink = true;
    const available = Boolean(destination && coupon.status === 'active');
    const item = document.createElement(available ? 'a' : 'span');
    item.className = `bank-link${available ? '' : ' disabled'}`;
    item.textContent = name;
    const arrow = document.createElement('span');
    arrow.textContent = available ? '↗' : bank === 'scotiabank' ? 'Guía manual' : 'No disponible';
    item.append(arrow);
    if (available) {
      item.href = destination; item.target = '_blank'; item.rel = 'noopener noreferrer'; item.referrerPolicy = 'no-referrer';
    }
    container.append(item);
  }
  if (invalidLink) message('La API devolvió enlaces fuera del origen esperado de sandbox. Se bloqueó su apertura; verifica la configuración del ambiente antes de compartirlos.', true);
  return !invalidLink;
}
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', redirect: 'error' });
  const data = await response.json();
  document.querySelector('#response-preview').textContent = JSON.stringify(data, null, 2);
  document.querySelector('#http-status').textContent = `HTTP ${response.status}`;
  document.querySelector('#response-details').open = true;
  if (!response.ok || data.success !== true) throw new Error(`HTTP ${response.status}: ${data.error ?? 'No se pudo completar la solicitud.'}`);
  return data;
}

form.addEventListener('input', updateRequest);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !config?.configured) return;
  message(''); setBusy(true);
  currentCoupon = undefined;
  document.querySelector('#coupon-result').hidden = true;
  document.querySelector('#empty-state').hidden = false;
  try {
    const result = await request('/api/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()) });
    if (render(result.data)) message(result.meta?.idempotent_replay ? 'Cupón recuperado: este cobro ya existía. Conserva sus enlaces originales.' : 'Cupón creado en sandbox. Ya puedes abrir la página de pago o un banco.');
  } catch (error) { message(error.message || 'No se recibió respuesta. Reintenta con la misma referencia y los mismos datos.', true); }
  finally { setBusy(false); }
});
document.querySelector('#new-reference').addEventListener('click', () => {
  if (busy) return;
  newReference(); updateRequest(); currentCoupon = undefined;
  document.querySelector('#coupon-result').hidden = true;
  document.querySelector('#empty-state').hidden = false;
  document.querySelector('#response-preview').textContent = 'Crea el nuevo cobro para ver su respuesta.';
  document.querySelector('#http-status').textContent = 'Esperando solicitud';
  message('Nueva referencia preparada. Se creará un cobro distinto al enviar el formulario.');
});
document.querySelector('#refresh-coupon').addEventListener('click', async () => {
  if (!currentCoupon || busy) return;
  const id = currentCoupon.id;
  if (!/^[a-f0-9]{24}$/i.test(id)) { message('La respuesta no contiene un ID válido para consultar el cupón.', true); return; }
  setBusy(true, 'read'); message('Consultando estado…');
  try {
    const result = await request(`/api/coupons/${id}`);
    if (render(result.data)) message(`Estado informado por la API: ${stateNames[result.data.status] ?? result.data.status}.`);
  } catch (error) { message(error.message, true); }
  finally { setBusy(false); }
});
document.querySelector('#copy-code').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(currentCoupon.payment_coupon_code); message('Código de pago copiado.'); }
  catch { message('Selecciona y copia el código mostrado en el cupón.', true); }
});

newReference();
form.elements.expiry_day.value = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
updateRequest();
try {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error();
  config = await response.json();
  const connection = document.querySelector('#connection');
  connection.classList.toggle('unconfigured', !config.configured);
  connection.textContent = config.configured
    ? 'Sandbox configurado. Utiliza datos ficticios y detén la demo antes de confirmar un pago en el banco.'
    : `Para conectar con sandbox, completa ${config.missing.join(', ')} en .env y reinicia el servidor.`;
  if (config.payment_prefix) {
    form.elements.payment_coupon_code.value = `${config.payment_prefix}000042`.slice(0, 14);
    document.querySelector('#prefix-hint').textContent = `Prefijo del negocio configurado: ${config.payment_prefix}. Máximo 14 caracteres alfanuméricos.`;
  }
  updateRequest(); setBusy(false);
} catch { message('No se pudo cargar la configuración. Verifica que el servidor local esté disponible.', true); }
