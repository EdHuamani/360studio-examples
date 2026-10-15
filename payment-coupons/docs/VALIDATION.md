# Comprobar tu integración en sandbox

## Preparación

Configura tu API key de sandbox, el Workspace autorizado y el prefijo de recaudo
asignado a tu negocio. Guarda las credenciales en el backend y utiliza datos
ficticios para los cupones de prueba.

## Comprobaciones locales

Desde `payment-coupons/`, ejecuta:

```bash
npm run check
npm test
npm run demo:webhook
```

Las pruebas HTTP usan un servidor local controlado. La demostración HMAC usa un
secreto ficticio, verifica los bytes originales y rechaza un body alterado.
Estas comprobaciones no crean cupones ni envían pagos.

## Emisión y consulta por API

1. Ejecuta `npm start` y abre `http://localhost:3000`.
2. Crea un cupón con una referencia propia. Espera HTTP **201** y guarda
   `data.id`, `data.workspace_id`, `external_ref` y los enlaces recibidos.
3. Repite exactamente el mismo cobro: espera HTTP **200**,
   `meta.idempotent_replay=true` y el mismo cupón.
4. Si cambias el importe conservando la referencia, espera HTTP **409**.
5. Consulta `GET /v1/payment-coupons/{id}` con el mismo `x-workspace-id`.

El header `x-workspace-id` es obligatorio. El body no acepta `workspace_id`.
La API key autoriza el acceso al Workspace; el header lo selecciona.

## Enlaces de pago

- Abre el valor completo de `data.payment_url` para ver el importe, el estado
  y las opciones de pago.
- Usa los valores no nulos de `data.bank_deeplinks` sin reconstruirlos.
  Ábrelos en un celular con la app bancaria instalada.
- Para Yape, BCP e Interbank, revisa que el código y el importe estén
  precargados. BBVA usa su menú de servicios; Scotiabank utiliza la guía manual.
- Abrir un enlace no confirma un pago. Consulta el estado del cupón o recibe
  el webhook para conocer el resultado.

Los destinos bancarios son apps o webs reales. Las capturas muestran la
experiencia de uso; crea tus propios cupones para obtener enlaces de prueba.

## Recepción del webhook y firma HMAC

1. Configura el webhook desde Client y guarda el secreto completo en tu backend.
2. Usa una URL HTTPS pública para el receptor; `localhost` no es un destino público.
3. Conserva los bytes originales del body y verifica
   `HMAC-SHA256(secreto, timestamp + "." + rawBody)` antes de procesar el evento.
4. Rechaza con **401** firmas inválidas, cuerpos alterados o timestamps fuera
   de la ventana de 5 minutos.
5. Guarda `X-360Studio-Event-Id` de forma durable. Un evento repetido debe
   recibir **200** sin repetir sus efectos.
6. Responde **2xx** cuando hayas persistido o procesado el evento. Consulta la
   entrega desde Client para comprobar el resultado.

Al rotar el secreto desde Client, actualiza tu receptor con el nuevo valor.
Las entregas ya encoladas y sus reintentos conservan el secreto anterior:
coordina la transición antes de retirarlo.

Consulta los [ejemplos de respuesta y webhooks](../examples/README.md) y el
[manual en PDF](../presentation/README.md).
