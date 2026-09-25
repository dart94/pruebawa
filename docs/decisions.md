# Decisiones

Formato: decisión, motivo, alternativas descartadas o pendientes. Lo que no es una decisión firme está marcado.

## D1. Empezar por endurecer la base, sin funciones nuevas (sept 2026)
Se corrigieron: lectura del body como Buffer (la firma HMAC fallaba con acentos y emojis), `APP_SECRET` obligatorio en producción, `VERIFY_TOKEN` sin valor por defecto y fuera de los logs, límite de body de 1 MB, deduplicación de mensajes, errores por mensaje, apagado limpio.

## D2. Producción en Railway
Es suficiente para un servicio Node siempre encendido. Sin cambiar de plataforma. Migración hecha y verificada con una conversación real.

## D3. Número de WhatsApp de ToyLoco
El número con terminación 9049 es el que se usa. Es real y está en Cloud API.

## D4. Un despliegue por cliente
Cada negocio tendrá su servicio, número y variables. Más simple y aísla datos. Multi-tenant queda para cuando haya varios clientes de verdad.

## D5. ToyLoco es el cliente cero
Sirve para validar el producto y como demostración para vender a otros negocios. Se prueba una hipótesis (el dueño atiende desde su celular) con ToyLoco y con un piloto pequeño antes de invertir en una plataforma.

## D6. Catálogo desde una pestaña pública `BOT`
El libro de inventario mezcla datos internos (costos, ventas con nombres de clientes). El bot solo lee una pestaña con formato fijo, publicada como CSV. Ese formato es el "contrato" reutilizable para otros negocios. Nunca se publica el documento completo.

## D7. En producción no hay datos de demo
Sin `CATALOGO_URL` o con la hoja caída y sin copia previa, el bot avisa que no puede consultar el inventario. Es preferible a mostrar productos falsos.

## D8. Precios fijos y disponibilidad "sujeta a confirmación"
Piezas únicas vendidas por varios canales: el bot no garantiza disponibilidad. Una persona confirma.

## D9. Conversación con botones y listas, tono cercano
Menos texto, más toques. Horario y ubicación ocultos hasta tener los datos. Texto libre se interpreta como búsqueda. Respaldo en texto plano si Meta rechaza el mensaje.

## D10. Aviso al dueño por plantilla de WhatsApp
El dueño se entera de "Me interesa" y "Hablar con alguien" por un mensaje de plantilla, y atiende escribiéndole al cliente desde su propio WhatsApp. Se descartó "mandar un mensaje cada 24 h": la ventana de 24 h solo se abre cuando el otro lado escribe al número del negocio, no cuando el negocio envía.
**Abierto:** la plantilla está pendiente de aprobación y Meta la clasificó como Marketing (más cara y con más restricciones que Utilidad). Tarifas sin verificar.

## D11. Coexistencia (dueño contestando desde la app) — pendiente, no bloquea
Meta la ofrece solo a Tech Providers o Solution Partners. Ser Tech Provider exige verificar el negocio ante Meta, y hoy la verificación está bloqueada por falta de documentación (no hay razón social/RFC registrados ante Meta).
Caminos: A) ser Tech Provider; B) usar un proveedor (360dialog, Wati, Twilio…); C) aviso al dueño por WhatsApp/Telegram (lo actual).
Decisión provisional: C para el piloto con ToyLoco. Se retoma A o B cuando exista identidad verificable o un cliente real que lo pida.
Antes de diseñar coexistencia, verificar: cómo se enteran el bot de los mensajes que el dueño manda desde la app (para callarse), tarifas, y cobertura en México.

## D12. Configuración por negocio en `negocio.json`
Textos, etiquetas de categoría, moneda, unidades de stock y nombre salen de un archivo JSON, no del código. Se edita y se hace deploy (no se edita desde la hoja de Google). Se valida al arrancar: un error de captura hace fallar el deploy, no la conversación con un cliente. Se descartó por ahora que el dueño edite los textos por sí mismo desde una hoja: agrega una dependencia más y un punto de fallo.
Lo que sigue en el código: el orden del flujo y las palabras clave de saludo y de datos pendientes.
