# Capturas de la página de pago

Capturas reales de 360Pay en sandbox para explicar el recorrido del cliente.
Los importes, códigos y referencias mostrados son datos de demostración;
crea tus propios cupones para obtener enlaces utilizables en tus pruebas.

| Captura | Qué muestra |
| --- | --- |
| [Payment URL](02-payment-url-sandbox-real.jpg) | Importe y selector de bancos dentro de `payment_url`. |
| [Guía manual](03-payment-url-guia-real.jpg) | Instrucciones de Scotiabank y código del cupón. |

Los deeplinks se usan **desde un celular con la app bancaria instalada**.
Yape, BCP e Interbank abren la sección de pago de 360Pay con el código
precargado. La app recupera el cupón y su importe para revisar y confirmar
el pago, sin escribir el código ni el monto. BBVA abre su menú de servicios
y requiere seleccionar 360Pay e ingresar el código. Scotiabank usa la guía manual.

El ejemplo utiliza los enlaces completos recibidos de la API. Las imágenes
no incluyen credenciales ni tokens completos. Abrir una página o una app
bancaria no confirma el pago: usa la consulta de estado o el webhook.

![Payment URL en sandbox](02-payment-url-sandbox-real.jpg)

![Guía manual dentro de payment_url](03-payment-url-guia-real.jpg)
