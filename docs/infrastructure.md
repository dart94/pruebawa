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

## Requisitos de la cuenta de Meta

- **Método de pago en la cuenta de WhatsApp Business.** Sin él, los mensajes con plantilla (como el aviso al dueño) se aceptan con 200 pero Meta los reporta `failed` al entregarlos. Sin método de pago solo se puede responder dentro de las 24 h posteriores a que el cliente escribe.
- Plantillas aprobadas en WhatsApp Manager (hoy: `aviso_cliente`, es_MX).

## Monitoreo

| Ruta | Qué comprueba | Uso |
|---|---|---|
| `GET /` | El proceso responde | Healthcheck de Railway. No usar `/health` ahí: un token vencido bloquearía los deploys. |
| `GET /health` | Catálogo legible y con productos; token de Meta válido (caché de 5 min) | Monitor externo. 200 sano, 503 con la lista de fallas. |

El monitor debe estar fuera del servicio: los fallos graves (servicio caído, token vencido, Meta caído) impiden que el propio bot avise.
Opciones evaluadas para el monitor externo (verificar los términos antes de contratar):
- UptimeRobot: plan gratis de 5 min con avisos por correo, pero **solo para uso personal y no comercial** (desde dic-2024). No sirve para ToyLoco ni para clientes.
- Better Stack: plan gratis de 10 monitores con revisión cada 3 min; no se confirmó si permite uso comercial.
- HetrixTools y UptimeSignal: según sus páginas permiten uso comercial en el plan gratis; no verificado en sus términos.
Pendiente de decidir y configurar (lo hace el dueño; requiere una cuenta).

## Pendiente

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
