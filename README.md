# ToyLoco - Webhook de WhatsApp

Servidor sin dependencias. Solo necesita Node 18 o superior.
Contexto y errores conocidos de Meta: `GUIA-WHATSAPP.md`.

## 1. Configurar

    copy .env.example .env

Variables (ver comentarios en `.env.example`):
- `VERIFY_TOKEN` (obligatorio): lo inventas tu, la vuelves a escribir en Meta.
- `WHATSAPP_TOKEN`: token del usuario de sistema.
- `PHONE_NUMBER_ID`: Phone Number ID del numero de ToyLoco.
- `APP_SECRET`: valida la firma de Meta. Obligatorio con `NODE_ENV=production`.
- `DRY_RUN=1`: no llama a Meta, solo registra.
- `LOG_CONTENIDO=1`: registra el texto de los mensajes (por defecto no).

## 2. Levantar el servidor

    node server.js

Escucha en http://localhost:3000

## 3. Probar sin Meta (sin enviar mensajes reales)

Si tu `.env` tiene token y Phone ID reales, el servidor SI enviara mensajes de WhatsApp
al numero de prueba. Para probar sin enviar nada, arranca con `DRY_RUN=1`:

    set DRY_RUN=1 && node server.js      (cmd)
    $env:DRY_RUN=1; node server.js       (PowerShell)

En otra terminal:

    node prueba-local.js "hola"
    node prueba-local.js "1"

## 4. Exponerlo a internet (solo para pruebas)

    cloudflared tunnel --url http://localhost:3000

Copia la URL https que te da.

## 5. Conectarlo en Meta

developers.facebook.com > app Responder > WhatsApp > Configuracion > Webhooks:
- URL de devolucion de llamada: `https://tu-url-publica/webhook`
- Token de verificacion: el mismo `VERIFY_TOKEN`
- Verificar y guardar, y suscribirse al campo `messages`

## 6. Catalogo

El bot consulta `catalogo.js`, que lee la pestana `BOT` de la hoja de inventario publicada como CSV
(`CATALOGO_URL`). Formato fijo de columnas: `id, categoria, producto, tema, linea, precio, cantidad, estado`.
Solo se ofrecen productos `Disponible` con cantidad y precio validos. Nunca publiques la hoja completa:
solo la pestana `BOT` (la hoja completa tiene costos y datos de clientes).

Sin `CATALOGO_URL`, en desarrollo se usa `inventario-demo.json` (datos ficticios).
En produccion no hay respaldo con datos de demo: si la hoja falla, se usa la ultima copia en memoria,
y si no la hay, el bot avisa que no puede consultar el inventario.

    npm test

## 7. Respuestas del bot

Estan en `responderA()` de `server.js`. Son provisionales: "hablar con una persona" aun no notifica a nadie.
