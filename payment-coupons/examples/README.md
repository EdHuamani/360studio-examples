# Ejemplos de respuesta y webhooks

Ejemplos del contrato de la API de clientes. Los IDs,
referencias y tokens son ficticios. Los enlaces y la firma de ejemplo no son
operativos ni contienen credenciales.

| Archivo | Uso |
| --- | --- |
| [Creación HTTP 201](coupon-created.response.json) | Respuesta de `/v1/payment-coupons` con `data.id`, ambos tipos de enlace y `meta.idempotent_replay=false`. |
| [Replay HTTP 200](coupon-replayed.response.json) | Mismo cupón y enlaces con `meta.idempotent_replay=true`. |
| [Pago confirmado](payment-paid.webhook.json) | Payload estándar de `payment_coupon.paid` para el hook `PAYMENT_PAID`. |
| [Headers](webhook-headers.example.json) | Metadatos de entrega. El timestamp y la firma incluidos son ilustrativos. |
| [Verificador HMAC](verify-webhook-signature.mjs) | Función para incorporar en un receptor Node.js, usando el body original y su secreto de hook. |
| [Demostración ejecutable HMAC](verify-webhook-demo.mjs) | Firma un fixture con un secreto ficticio, verifica los bytes originales y rechaza una alteración. Sin red ni credenciales. |

## Obtener y rotar el secreto desde Client

Crea el webhook desde **Client > Administración > Integraciones > API y
webhooks > Webhooks > Nuevo webhook**. Selecciona **Pago confirmado**, configura
la URL HTTPS de tu receptor y guarda. Client muestra el secreto completo una
sola vez: guárdalo en la configuración privada de tu backend y úsalo como texto
UTF-8 en el verificador HMAC.

Para cambiarlo, abre el webhook y pulsa **Rotar secreto**, confirma y guarda
el nuevo valor completo en tu backend receptor. La vista parcial que queda en
el panel no sustituye ese secreto. Las entregas ya encoladas y sus reintentos
conservan el anterior; coordina la transición del receptor antes de retirarlo.

La API pública de cupones es `/v1`. La configuración y rotación de webhooks se
realizan desde el panel de Client. El secreto HMAC es distinto de la API key de
cupones y permanece en tu backend; no lo publiques ni lo incluyas en el frontend.
Consulta la [guía de configuración](../README.md#webhook-de-pago-confirmado).

## Headers del webhook

| Header | Significado |
| --- | --- |
| `X-360Studio-Event-Id` | ID estable del evento para idempotencia durable. |
| `X-360Studio-Delivery-Id` | ID de la entrega para seguimiento. |
| `X-360Studio-Webhook-Id` | Hook emisor; permite elegir su secreto en el receptor. |
| `X-360Studio-Timestamp` | Fecha ISO que participa en la firma. |
| `X-360Studio-Signature` | HMAC-SHA256 con formato `sha256=<hex>`. |
| `X-360Studio-Attempt` | Número de intento, sin cambiar el estado de negocio. |

El ID de evento está en el header. Busca el cupón por `data.payment_coupon_id`,
que corresponde a `data.id` de la creación, y recupera su Business y Workspace
del registro guardado. `external_ref` solo es único dentro de un Workspace:
úsalo como comprobación adicional en ese scope. El payload estándar de pago no
agrega `workspace_id` ni `payment_coupon_code`.

La firma cubre `timestamp + "." + rawBody`. El verificador recibe los headers
normalizados de Node.js y rechaza datos alterados, timestamps inválidos o fuera
de 5 minutos y firmas malformadas. Verificar la firma no sustituye validar el
payload ni registrar el evento de forma durable antes de responder 2xx.
Usa el secreto como texto UTF-8. Si la firma no es válida, responde 401 y no
proceses el evento.

Desde `payment-coupons/`, ejecuta:

```bash
npm run demo:webhook
```

La demostración genera headers firmados con un timestamp actual y un secreto
ficticio. Usa el fixture como bytes originales y comprueba que una alteración
se rechaza. En tu receptor, verifica la firma recibida con el secreto real del
hook. El archivo de headers estático de esta carpeta sigue siendo ilustrativo.

360Studio hace un intento inicial y hasta 3 reintentos. Responde 200 también
ante un evento ya procesado, sin repetir efectos. Usa una restricción única
por `X-360Studio-Event-Id` en el almacenamiento de eventos de tu receptor.

Si configuras `payload_mapping`, `include_unmapped_fields` o `additional_fields`,
el JSON puede variar. Un pago simulado puede incluir `data.simulated=true`.

## Validación y alcance

Las pruebas locales generan firmas con un secreto ficticio y ejercitan el
verificador contra bytes originales y alterados. **No representan una entrega
real de un webhook de sandbox ni un pago bancario.** Consulta la
[guía para comprobar tu integración](../docs/VALIDATION.md) para probar el
recorrido con tus propios cupones y receptor. Ningún secreto real forma parte
de estos fixtures.

El servidor `server.mjs` conserva su alcance de emisión y consulta. La URL
registrada en un hook debe pertenecer al receptor HTTPS público de tu backend;
`localhost` no es un destino público válido. La API key de cupones y el secreto
HMAC del hook se administran por separado.

Fuentes: [OpenAPI de clientes](https://sandbox.api.360studio.app/docs/json/api),
[guía de webhooks](https://sandbox.api.360studio.app/docs/webhooks) y
[explicación del ejemplo](../README.md#webhook-de-pago-confirmado).
