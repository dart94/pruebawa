# Infraestructura

## Estado actual

| Componente | Dónde vive | Notas |
|---|---|---|
| Servidor del bot | Railway (servicio Node, despliegue desde GitHub `main`) | Sin dependencia de la computadora local. |
| Código | Repo privado en GitHub | `.env` está en `.gitignore`. |
| Número de WhatsApp | Cloud API, estado `CONNECTED` | Es un número real, no de pruebas. Límite: 250 conversaciones iniciadas por el negocio cada 24 h (tier de mensajería). |
| Catálogo | Google Sheets, pestaña `BOT` publicada como CSV | Lectura por URL secreta; caché de 5 min. |
| Token de acceso | Variable en Railway (usuario de sistema, no caduca) | Nunca en el repo ni en documentación. |
| Persistencia | Ninguna | Todo el estado es en memoria; se pierde al reiniciar (aceptable hoy). |

## Ya no depende de la laptop

Webhook, proceso, variables de entorno, HTTPS y logs viven en Railway. Ya no se usa el túnel de cloudflared.

## Despliegue

1. Push a `main` en GitHub.
2. Railway detecta `package.json` y ejecuta `npm start`.
3. Comprobar: `GET https://<dominio>/` responde "Webhook de WhatsApp activo"; `POST /webhook` sin firma responde 401.

Variables en Railway: ver `.env.example`. Requeridas: `VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET`, `NODE_ENV=production`, `CATALOGO_URL`. No definir `PORT`.

En producción el servidor no arranca sin `APP_SECRET` ni `VERIFY_TOKEN`.

## Rollback

Desde Railway, redesplegar un deploy anterior. Alternativa: `git revert` del commit problemático y push.

## Pendiente

- Monitoreo: hoy solo hay logs de Railway. Falta una alerta si el servicio cae o si el token caduca.
- Backups: no aplican mientras no haya base de datos.
- Base de datos (Postgres de Railway): solo si se decide guardar pedidos o historial.
- Costos: revisar el precio vigente de Railway y las tarifas de Meta por plantilla antes de fijar precios a terceros.
- Dominio propio: no es necesario mientras Meta acepte el dominio de Railway.

## Dependencias externas y su riesgo

| Servicio | Si falla |
|---|---|
| Meta / WhatsApp | El bot no recibe ni envía. |
| Google Sheets (CSV) | Se usa la última copia en memoria; si no hay ninguna, el bot avisa que no puede consultar el inventario. En producción nunca muestra datos de demo. |
| Railway | El bot deja de responder. Meta reintenta entregas por un tiempo. |
