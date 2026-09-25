# Arquitectura

Estado: septiembre 2026. Bot de WhatsApp de ToyLoco, pensado para reutilizarse en otros negocios.

## Vista general

```
Cliente (WhatsApp)
      │
      ▼
Meta WhatsApp Cloud API ──webhook POST /webhook──▶ server.js (Railway)
                                                       │
                          ┌────────────────────────────┼───────────────────────┐
                          ▼                            ▼                       ▼
                       bot.js                    catalogo.js             notificar.js
                (flujo de conversación)   (lee pestaña BOT como CSV)  (plantilla al dueño)
                          │                            │
                          ▼                            ▼
                    mensajes.js                 Google Sheets (CSV publicado)
             (texto, botones, listas,
              límites de Meta, respaldo)
```

## Módulos

| Archivo | Responsabilidad |
|---|---|
| `server.js` | Servidor HTTP sin dependencias: verificación del webhook, firma HMAC, límite de body, deduplicación por `message.id`, envío a la API, apagado limpio (SIGTERM). |
| `bot.js` | Flujo de conversación. Recibe una entrada (`texto`, `seleccion` con id, `otro`) y devuelve un mensaje. No envía nada. |
| `mensajes.js` | Constructores de mensajes (texto, botones, lista), truncado a los límites de Meta y versión en texto plano de respaldo. |
| `negocio.js` / `negocio.json` | Configuración por negocio: nombre, moneda, etiquetas de categoría, textos, botones y unidades de stock. Se valida al arrancar. |
| `catalogo.js` | Lee el catálogo público (CSV), caché en memoria, filtra lo ofrecible, busca por nombre/tema/línea. |
| `notificar.js` | Aviso al dueño con una plantilla de WhatsApp. Nunca lanza errores hacia el cliente. |
| `inventario-demo.json` | Datos ficticios para desarrollo y demos. |
| `prueba-local.js` | Simula un mensaje o clic de Meta contra el servidor local. |
| `test/` | Pruebas con `node --test` (`npm test`). |

## Principios de diseño

- **Sin dependencias externas.** Solo Node 18+ (fetch nativo).
- **El bot no conoce a Meta.** `bot.js` devuelve objetos de mensaje; `server.js` los convierte a payloads.
- **Un fallo secundario no rompe la conversación.** Un aviso al dueño o un catálogo caído nunca deja al cliente sin respuesta.
- **Interactivo con respaldo.** Si Meta rechaza un mensaje con botones o lista, se reenvía en texto plano.
- **Sin estado por cliente.** Los botones llevan ids estables, así que no hay memoria de conversación. Solo hay caché de catálogo y anti-repetición de avisos, ambos en memoria.

## Flujo de un mensaje

1. Meta hace `POST /webhook`. Se valida la firma (`x-hub-signature-256`) sobre los bytes crudos.
2. Se responde 200 de inmediato y se procesa después.
3. Por cada mensaje nuevo (no duplicado): se marca como leído, `entradaDe()` lo traduce, `responder()` decide, `enviar()` lo manda.
4. En "Me interesa" y "Hablar con alguien", `bot.js` dispara `avisar()` sin esperar; `notificar.js` envía la plantilla al dueño.

## Configuración (variables de entorno)

Ver `.env.example`. Obligatorias en producción: `VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, `APP_SECRET`, `NODE_ENV=production`, `CATALOGO_URL`. Opcionales: `DUENO_WHATSAPP`, `PLANTILLA_AVISO`, `PLANTILLA_IDIOMA`, `CATALOGO_TTL_SEG`, `NEGOCIO_ARCHIVO`, `DRY_RUN`, `LOG_CONTENIDO`.

## Multi-negocio

Cada negocio tiene su propio servicio, número y variables (un despliegue por cliente). Lo específico del negocio vive en `negocio.json` (o el archivo de `NEGOCIO_ARCHIVO`), no en el código. Cambiar de negocio es cambiar ese archivo y el catálogo (`CATALOGO_URL`). Una prueba automática verifica que otro negocio funciona sin tocar código.

Lo que sigue fijo en el código: el orden del flujo (saludo → categoría → productos → ficha → me interesa / persona), las palabras de saludo y las de datos pendientes (horario, ubicación).
