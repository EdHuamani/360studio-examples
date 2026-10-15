# Manual de integración

Manual para compartir con clientes y prospectos, de **22 páginas** en formato
**16:9**, con las explicaciones y ejemplos de este repositorio.

[PDF para compartir](360studio-cupones-sandbox.pdf), con marcadores de navegación.

## Contenido

1. Cupones y enlaces de pago.
2. El ejemplo de integración.
3. Preparación en sandbox.
4. Workspace en la API de clientes.
5. Crear un cupón por API.
6. Respuesta completa HTTP 201 al crear el cupón, incluidos `payment_url` y `bank_deeplinks`.
7. Cupón creado en sandbox.
8. `payment_url`.
9. `bank_deeplinks` en el celular.
10. Comportamiento por banco.
11. Guía manual en `payment_url`.
12. Reintentos y estado del cupón.
13. Configuración del webhook.
14. Obtener el secreto HMAC desde Client y guardarlo en el backend.
15. Rotación del secreto HMAC desde el panel de Client.
16. Webhook de pago confirmado.
17. Headers del webhook.
18. Recepción segura e idempotente.
19. Verificación HMAC en Node.js y demostración ejecutable.
20. Comprobar webhooks y HMAC.
21. Errores frecuentes.
22. Repositorio y prueba del ejemplo.

El [JSON completo de la respuesta de creación](../examples/coupon-created.response.json)
se muestra en una sola página y también está disponible para copiarlo.

Las capturas reales de 360Pay muestran datos de demostración. El manual explica
los deeplinks para celulares con la app bancaria instalada y las excepciones
de BBVA y Scotiabank. Crea tus propios cupones para obtener enlaces de prueba.

Los ejemplos de respuesta y los payloads de webhook usan datos ficticios.
La creación y rotación del webhook se realizan desde Client. El secreto
completo se muestra una sola vez al crear o rotar el hook y se guarda en el
backend receptor. La vista parcial no permite verificar HMAC. Las entregas ya
encoladas conservan el secreto anterior, por lo que hay que coordinar el cambio
en el receptor.

El HMAC firma `timestamp + "." + rawBody` y se verifica con el secreto del hook,
una ventana de 5 minutos y comparación en tiempo constante. El repositorio
incluye una demostración local ejecutable con `npm run demo:webhook`.

Recursos: [README del ejemplo](../README.md),
[guía para comprobar tu integración](../docs/VALIDATION.md),
[capturas de la página de pago](../docs/screenshots/README.md) y
[ejemplos de respuesta y webhooks](../examples/README.md).
