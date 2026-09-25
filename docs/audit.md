# Auditoría

Última revisión: septiembre 2026. Solo lectura de código y configuración; no se expusieron secretos.

## Corregido

| Hallazgo | Riesgo | Estado |
|---|---|---|
| Firma HMAC calculada sobre texto concatenado | Rechazaba mensajes legítimos con acentos/emojis al activar `APP_SECRET` | Corregido (Buffer) |
| Sin `APP_SECRET`, no se validaba la firma | Cualquiera con la URL podía enviar mensajes falsos y hacer que el bot escribiera con el token | Corregido (obligatorio en producción) |
| `VERIFY_TOKEN` por defecto, impreso en logs y en `.env.example` | Token adivinable | Corregido |
| Sin límite de body | Consumo de memoria | Corregido (1 MB, 413) |
| Sin deduplicación | Respuestas duplicadas por reintentos de Meta | Corregido |
| Un fallo de envío abortaba el lote | Mensajes sin respuesta | Corregido (try/catch por mensaje) |
| Logs con teléfono, nombre y texto | Datos personales | Corregido (enmascarado; texto solo con `LOG_CONTENIDO=1`) |
| Sin `.gitignore` | Riesgo de subir `.env` | Corregido |
| Textos y flujo heredados de una papelería | Información falsa a clientes | Corregido |
| Prueba local enviaba mensajes reales con el `.env` real | Envíos accidentales (ocurrió una vez, 2 mensajes al número de prueba) | Mitigado con `DRY_RUN=1` y advertencia en README |

## Riesgos abiertos

| Riesgo | Impacto | Sugerencia |
|---|---|---|
| **URL del CSV público.** Cualquiera que la conozca ve la pestaña `BOT`. | Bajo (precios y stock públicos), pero no debe contener nada más. | Mantener la pestaña solo con columnas públicas; revisar periódicamente. |
| **Aviso al dueño sin plantilla aprobada** | Los avisos fallan en silencio (solo log). | Monitorear `[aviso-dueno-error]`; confirmar aprobación. |
| **Estado en memoria** (caché y anti-repetición) | Se pierde al reiniciar; puede repetir un aviso tras un redeploy. | Aceptable hoy. |
| **Interactivos en otros dispositivos** | Probados en el WhatsApp del dueño (25-sep-2026) y se ven bien; falta ver versiones antiguas. | Hay respaldo en texto plano. |
| **Disponibilidad desfasada** (venta en otro canal, hoja sin actualizar) | El bot ofrece algo ya vendido. | Aviso "sujeto a confirmación"; mantener la hoja al día. |
| **Sin monitoreo ni alertas** | Una caída o token caducado pasa desapercibida. | Definir una alerta mínima (ver `roadmap.md`). |
| **Un solo proceso, sin cola** | Picos de mensajes se procesan en serie. | Suficiente para el volumen actual. |
| **Sin límite de tasa por cliente** | Un cliente puede generar muchas búsquedas. | Bajo riesgo; vigilar. |
| **Datos de terceros en el libro de inventario** (nombres de clientes en ventas) | Fuga si se publica el documento completo. | Publicar solo la pestaña `BOT`. Nunca "Documento completo". |
| **Dependencia de la verificación de negocio de Meta** | Bloquea coexistencia y aviso de escala. | Ver D11. |

## Casos límite cubiertos por pruebas

Catálogo con HTML en lugar de CSV, precios con `$` y comas, productos vendidos/sin stock/sin precio, plurales y frases naturales, más de 10 resultados, clic de un producto que ya no existe, imagen o audio, fallo del aviso al dueño, respaldo sin configuración de dueño.

## Por auditar más adelante

- Comportamiento real de listas y botones en distintas versiones de WhatsApp.
- Reintentos de Meta ante caídas largas del servicio.
- Límites de mensajería al pasar de 250 a niveles superiores.
