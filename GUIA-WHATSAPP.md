# WhatsApp Cloud API: guía de implementación

Receta probada de punta a punta en septiembre de 2026 con ToyLoco. Sirve como
plantilla para la papelería y para cualquier otro negocio que hoy atienda pedidos
por WhatsApp.

## Resultado alcanzado

Un cliente escribe al número del negocio, Meta entrega el mensaje al servidor por
webhook, y el bot contesta solo. El envío por API también funciona en ambos
sentidos: plantillas para iniciar conversación y texto libre para responder.

## Decisión de arranque: número nuevo o número existente

Esta es la decisión que más tiempo cuesta si se toma mal.

Un número que ya vive en la app de WhatsApp Business no se puede conectar a la API
sin más. Se detecta consultando el número por API: aparece `platform_type:
ON_PREMISE`, `is_on_biz_app: true`, `status: DISCONNECTED` y
`code_verification_status: NOT_VERIFIED`. En la interfaz solo se ve "Sin conexión",
sin ningún botón para activarlo, que es lo que confunde.

Hay tres caminos:

Número nuevo. Es el más rápido y el que funcionó. Se registra directo en Cloud API,
queda `CONNECTED` y `CLOUD_API` en minutos, y el negocio sigue operando su número
viejo mientras se arma el bot.

Migración del número existente. Se borra la cuenta desde la app del celular (Ajustes
→ Cuenta → Eliminar mi cuenta, no basta con desinstalar) y luego se registra por API
con `request_code`, `verify_code` y `register`. Se pierde la bandeja de chats: Cloud
API no tiene pantalla para contestar a mano, así que hace falta un inbox propio o de
un proveedor. Respaldar los chats antes.

Coexistencia. El número sigue en la app del celular y además responde por API. Es lo
ideal para un negocio que quiere seguir contestando desde el teléfono, pero se activa
con el flujo Embedded Signup de Meta, que normalmente exige ser proveedor tecnológico.
La vía práctica es un proveedor como 360dialog, Twilio o Wati.

Para la papelería, si el dueño quiere seguir contestando desde su celular, conviene
coexistencia con proveedor. Si acepta que el bot y un panel propio sustituyan a la
app, número nuevo o migración.

## Piezas que hay que reunir

El identificador de la cuenta de WhatsApp Business, o WABA ID. El Phone Number ID,
que no es el número telefónico sino un identificador largo. Un token de acceso que
empieza con EAA. Y una URL pública con HTTPS para el webhook.

Sobre el token: el de la pantalla de Configuración de la API dura 24 horas y deja
tirado al bot al día siguiente. El del usuario de sistema, generado en Configuración
del negocio, no caduca, y es el que debe ir en producción. Ese usuario necesita tener
asignada la cuenta de WhatsApp; si no, la API responde que el objeto no existe o
faltan permisos.

## Pasos

Registrar el número en Cloud API y confirmar por API que quedó `CONNECTED` y
`CLOUD_API`.

Suscribir la app a la cuenta de WhatsApp. Sin esto, el webhook queda perfectamente
configurado y aun así no llega ningún mensaje. Se revisa con un GET a
`/{WABA_ID}/subscribed_apps` y se arregla con un POST vacío a la misma ruta.

Levantar el servidor del webhook y exponerlo con HTTPS. Para probar, cloudflared
genera una URL sin pedir cuenta; para producción, Railway o un servidor propio.

Configurar el webhook en la app: la URL **con `/webhook` al final**, el token de
verificación que uno mismo inventa, y después suscribirse al campo `messages`.

Probar escribiendo al número desde un celular real.

## Los dos tokens que se confunden

El token de verificación es una palabra inventada que se escribe en la pantalla del
webhook y en la configuración del servidor. Solo sirve para que Meta compruebe que el
servidor es tuyo.

El token de acceso es el largo que empieza con EAA. Nunca se escribe en la pantalla
del webhook; solo lo usa el servidor para llamar a la API. Un 401 "Authentication
Error" al enviar significa que este caducó.

## Errores encontrados y qué significan

`Invalid OAuth access token - Cannot parse access token`: se está llamando a
`graph.instagram.com` con un token de Facebook. El dominio correcto es
`graph.facebook.com`.

`(#200) Provide valid app ID`: el token no manda sobre esa cuenta. Pasa al usar el
token del usuario de sistema contra la cuenta de prueba de Meta, que no es propia.

`Object with ID ... does not exist, cannot be loaded due to missing permissions`: al
usuario de sistema le falta que le asignen la cuenta de WhatsApp.

`(#131030) Recipient phone number not in allowed list`: con números de prueba solo se
puede escribir a destinatarios verificados previamente. Con número propio desaparece.

`(#131058) Hello World templates can only be sent from the Public Test Numbers`: la
plantilla `hello_world` solo existe en números de prueba. Con número propio hay que
crear plantillas propias y esperar aprobación de Meta.

La verificación del webhook falla sin más explicación: casi siempre es que la URL no
lleva `/webhook` al final, y Meta llama a la raíz.

## Límites que conviene saber antes de prometer nada

Sin método de pago válido, el negocio solo puede responder dentro de las 24 horas
posteriores a que el cliente escribe. Iniciar conversación requiere plantillas
aprobadas, y esas se cobran.

Las plantillas se crean en WhatsApp Manager y las revisa Meta, así que hay que
preverlo con tiempo.

Cloud API no trae bandeja de entrada. Si el negocio necesita que una persona conteste
a mano, hay que construir ese panel o contratar uno.

Los números en México se escriben sin `+`, sin espacios y sin el 1: `526623254234`.

## Estado de ToyLoco


## Qué falta

Mover el webhook a Railway o al servidor propio, para que deje de depender del túnel
y de la laptop encendida.

Agregar método de pago y crear las plantillas del negocio.

Guardar los pedidos en algún lado y avisar al dueño cuando entre uno.

Definir cómo atiende una persona cuando el bot no alcanza.

## Código

El servidor vive en esta misma carpeta, sin dependencias, solo Node 18 o superior.
`server.js` trae la verificación del webhook, validación opcional de la firma de Meta,
marcado de leído y el envío de respuestas. Las respuestas del bot están en la función
`responderA()`, que es lo único que hay que reescribir para cada negocio.
