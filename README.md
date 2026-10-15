# 360Studio · ejemplos de integración

Ejemplos ejecutables para integrar sistemas con las APIs de 360Studio.

| Ejemplo | Qué permite probar | Ambiente |
| --- | --- | --- |
| [Cupones y enlaces de pago](payment-coupons/) | Crear y consultar cupones, usar sus enlaces y verificar firmas de webhooks. | Sandbox |

## Inicio rápido: cupones

Necesitas Node.js 22 o posterior. El ejemplo no tiene dependencias externas.

```bash
git clone https://github.com/EdHuamani/360studio-examples.git
cd 360studio-examples/payment-coupons
cp .env.example .env
```

Completa `.env` con tu API key de sandbox, Workspace autorizado y prefijo de
recaudo del negocio.

Este ejemplo usa la API de clientes `/v1`: el header `x-workspace-id` es
obligatorio. Consulta cómo [configurar el Workspace en el backend](payment-coupons/README.md#workspace-en-la-api-de-clientes).

Luego inicia el ejemplo:

```bash
npm start
```

Abre **http://localhost:3000**. Consulta el [README del ejemplo](payment-coupons/README.md)
para los scopes, el payload, los comandos cURL y el uso de ambos tipos de enlace.

## Recursos de integración

- [Capturas de la página de pago](payment-coupons/docs/screenshots/README.md).
- [Guía para comprobar tu integración](payment-coupons/docs/VALIDATION.md).
- [Presentación para clientes en PDF](payment-coupons/presentation/README.md).
- [Ejemplos de respuestas y webhooks](payment-coupons/examples/README.md).

Nunca subas credenciales ni datos personales. La API key queda en el servidor
local. Sandbox corresponde a la API y la web 360Pay; los destinos bancarios son
apps o webs reales, por lo que la demo termina antes de confirmar un pago.
